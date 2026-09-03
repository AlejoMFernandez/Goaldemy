-- ════════════════════════════════════════════════════════════
--  MODO INVITADO EN JUEGOS REALES — reclamo REAL al crear cuenta
--  (piloto: Adivina el jugador)
-- ════════════════════════════════════════════════════════════
--  Mismo mecanismo que reto-claim.sql: el invitado juega el desafío real sin
--  cuenta (/games/guess-player), ve en el popup la XP que "ganó", y al crear
--  cuenta la reclama DE VERDAD.
--
--  Diseño:
--   • Server-side y SECURITY DEFINER (el cliente no puede inflar el monto).
--   • Anti-cheat: total 1..20, corrects 0..total, y cap duro (150 XP / 60 Fichas).
--     Misma fórmula que computeRetoRewards, no la config de dificultad del cliente,
--     para no tener que confiar en un valor reportado por el navegador.
--   • Idempotente: 1 reclamo por (usuario, juego, día). Segundo intento → 'already_claimed'.
--   • Otorga XP con reason 'guest_welcome' (fuera del mapeo de fichas del trigger
--     xp_to_fichas → evita doble crédito) y luego las Fichas exactas.
--
--  Correr en el SQL Editor de Supabase. Requiere award_xp() y award_fichas()
--  (definidas en mejoras11-currency-shop.sql).
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.guest_game_claims (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug  TEXT NOT NULL,
  day_key    TEXT NOT NULL,
  corrects   INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  max_streak INTEGER NOT NULL DEFAULT 0,
  xp         INTEGER NOT NULL,
  fichas     INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_slug, day_key)
);

ALTER TABLE public.guest_game_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guest_game_claims read own" ON public.guest_game_claims;
CREATE POLICY "guest_game_claims read own" ON public.guest_game_claims
  FOR SELECT USING (auth.uid() = user_id);

-- RPC: reclama la recompensa de una partida jugada como invitado
CREATE OR REPLACE FUNCTION public.claim_guest_game_reward(
  p_game_slug  TEXT,
  p_corrects   INTEGER,
  p_total      INTEGER,
  p_max_streak INTEGER,
  p_day_key    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid        UUID := auth.uid();
  v_slug     TEXT;
  v_total    INTEGER;
  v_corrects INTEGER;
  v_streak   INTEGER;
  v_perfect  BOOLEAN;
  v_xp       INTEGER;
  v_fichas   INTEGER;
  v_day      TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'auth');
  END IF;

  v_slug := NULLIF(btrim(p_game_slug), '');
  IF v_slug IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_game');
  END IF;

  -- Saneo / anti-cheat
  v_total    := LEAST(GREATEST(COALESCE(p_total, 0), 1), 20);
  v_corrects := LEAST(GREATEST(COALESCE(p_corrects, 0), 0), v_total);
  v_streak   := LEAST(GREATEST(COALESCE(p_max_streak, 0), 0), v_total);
  v_day      := COALESCE(NULLIF(btrim(p_day_key), ''), to_char(now(), 'YYYY-MM-DD'));
  v_perfect  := v_corrects >= v_total;

  -- Misma fórmula que el teaser del Reto del día, con cap defensivo
  v_xp     := LEAST(v_corrects * 10 + (CASE WHEN v_perfect THEN 50 ELSE 0 END), 150);
  v_fichas := LEAST(v_corrects * 4  + (CASE WHEN v_perfect THEN 20 ELSE 0 END), 60);

  -- Un solo reclamo por (usuario, juego, día)
  BEGIN
    INSERT INTO public.guest_game_claims (user_id, game_slug, day_key, corrects, total, max_streak, xp, fichas)
      VALUES (uid, v_slug, v_day, v_corrects, v_total, v_streak, v_xp, v_fichas);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END;

  PERFORM public.award_xp(
    p_amount     => v_xp,
    p_reason     => 'guest_welcome',
    p_game_id    => NULL,
    p_session_id => NULL,
    p_meta       => json_build_object('game', v_slug, 'day', v_day, 'corrects', v_corrects, 'total', v_total)::jsonb
  );

  IF v_fichas > 0 THEN
    PERFORM public.award_fichas(
      p_uid    => uid,
      p_amount => v_fichas,
      p_reason => 'guest_welcome',
      p_meta   => json_build_object('game', v_slug, 'day', v_day)::jsonb
    );
  END IF;

  RETURN json_build_object('ok', true, 'xp', v_xp, 'fichas', v_fichas);
END$$;

REVOKE ALL ON FUNCTION public.claim_guest_game_reward(TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC;
-- Supabase otorga EXECUTE a `anon`/`authenticated` por defecto en funciones nuevas,
-- por fuera de PUBLIC — el REVOKE de arriba no alcanza. Sacamos anon explícitamente
-- (no era explotable: la función corta si auth.uid() es null, pero no hace falta
-- que un visitante sin sesión pueda ni siquiera invocarla).
REVOKE EXECUTE ON FUNCTION public.claim_guest_game_reward(TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_game_reward(TEXT, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;
