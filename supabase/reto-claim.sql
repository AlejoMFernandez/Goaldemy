-- ════════════════════════════════════════════════════════════
--  RETO DEL DÍA — reclamo REAL de recompensas al crear cuenta
-- ════════════════════════════════════════════════════════════
--  Cierra el loop del funnel público /reto: el invitado juega sin cuenta,
--  ve la XP + Fichas que "ganó", y al registrarse las reclama DE VERDAD.
--
--  Diseño:
--   • Server-side y SECURITY DEFINER (el cliente no puede inflar el monto).
--   • Anti-cheat: total 1..20, corrects 0..total, y cap duro (150 XP / 60 Fichas).
--   • Idempotente: 1 reclamo por (usuario, día). Segundo intento → 'already_claimed'.
--   • Otorga XP con reason 'reto_welcome' (NO está en el mapeo de fichas del
--     trigger xp_to_fichas → evita doble crédito) y luego las Fichas exactas.
--
--  Correr en el SQL Editor de Supabase. Requiere award_xp() y award_fichas()
--  (esta última definida en mejoras11-currency-shop.sql).
-- ════════════════════════════════════════════════════════════

-- Registro de reclamos (evita doble cobro y sirve de auditoría)
CREATE TABLE IF NOT EXISTS public.reto_claims (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key    TEXT NOT NULL,
  corrects   INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  xp         INTEGER NOT NULL,
  fichas     INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day_key)
);

ALTER TABLE public.reto_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reto_claims read own" ON public.reto_claims;
CREATE POLICY "reto_claims read own" ON public.reto_claims
  FOR SELECT USING (auth.uid() = user_id);

-- RPC: reclama la recompensa del reto para el usuario autenticado
CREATE OR REPLACE FUNCTION public.claim_reto_reward(
  p_corrects INTEGER,
  p_total    INTEGER,
  p_day_key  TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid        UUID := auth.uid();
  v_total    INTEGER;
  v_corrects INTEGER;
  v_perfect  BOOLEAN;
  v_xp       INTEGER;
  v_fichas   INTEGER;
  v_day      TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'auth');
  END IF;

  -- Saneo / anti-cheat
  v_total    := LEAST(GREATEST(COALESCE(p_total, 0), 1), 20);
  v_corrects := LEAST(GREATEST(COALESCE(p_corrects, 0), 0), v_total);
  v_day      := COALESCE(NULLIF(btrim(p_day_key), ''), to_char(now(), 'YYYY-MM-DD'));
  v_perfect  := v_corrects >= v_total;

  -- Misma fórmula que computeRetoRewards() del front, con cap defensivo
  v_xp     := LEAST(v_corrects * 10 + (CASE WHEN v_perfect THEN 50 ELSE 0 END), 150);
  v_fichas := LEAST(v_corrects * 4  + (CASE WHEN v_perfect THEN 20 ELSE 0 END), 60);

  -- Un solo reclamo por (usuario, día)
  BEGIN
    INSERT INTO public.reto_claims (user_id, day_key, corrects, total, xp, fichas)
      VALUES (uid, v_day, v_corrects, v_total, v_xp, v_fichas);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END;

  -- Otorgar XP (reason fuera del mapeo de fichas → sin doble crédito)
  PERFORM public.award_xp(
    p_amount     => v_xp,
    p_reason     => 'reto_welcome',
    p_game_id    => NULL,
    p_session_id => NULL,
    p_meta       => json_build_object('day', v_day, 'corrects', v_corrects, 'total', v_total)::jsonb
  );

  -- Otorgar las Fichas exactas del teaser
  IF v_fichas > 0 THEN
    PERFORM public.award_fichas(
      p_uid    => uid,
      p_amount => v_fichas,
      p_reason => 'reto_welcome',
      p_meta   => json_build_object('day', v_day)::jsonb
    );
  END IF;

  RETURN json_build_object('ok', true, 'xp', v_xp, 'fichas', v_fichas);
END$$;

REVOKE ALL ON FUNCTION public.claim_reto_reward(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_reto_reward(INTEGER, INTEGER, TEXT) TO authenticated;
