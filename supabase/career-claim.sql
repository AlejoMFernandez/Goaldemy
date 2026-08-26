-- ════════════════════════════════════════════════════════════
--  MODO CARRERA — reclamo de recompensa (mismo patrón que reto-claim.sql)
-- ════════════════════════════════════════════════════════════
--  La simulación corre 100% en el cliente (como Copero) — no hay nada que
--  "hackear" en la carrera en sí, porque el monto de la recompensa NO sale
--  de los números que manda el cliente: sale de una tabla fija por grado,
--  server-side. El cliente solo dice "terminé con grado X", el server decide
--  cuánto vale eso. Igual que el Reto del día: 1 reclamo por día.
--
--  Correr en el SQL Editor de Supabase. Requiere award_xp() y award_fichas().
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.career_claims (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key    TEXT NOT NULL,
  grade_key  TEXT NOT NULL,
  xp         INTEGER NOT NULL,
  fichas     INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day_key)
);

ALTER TABLE public.career_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "career_claims read own" ON public.career_claims;
CREATE POLICY "career_claims read own" ON public.career_claims
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.claim_career_reward(p_grade_key TEXT, p_day_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid      UUID := auth.uid();
  v_day    TEXT;
  v_xp     INTEGER;
  v_fichas INTEGER;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'auth');
  END IF;

  v_day := COALESCE(NULLIF(btrim(p_day_key), ''), to_char(now(), 'YYYY-MM-DD'));

  -- Tabla de recompensa fija por grado (espejo de GRADES en src/services/career.js).
  -- Cualquier grado desconocido cae al mínimo, nunca a un valor no listado.
  SELECT xp, fichas INTO v_xp, v_fichas FROM (VALUES
    ('legend',      200, 80),
    ('world_class', 150, 60),
    ('pro',         100, 40),
    ('decent',       60, 24),
    ('amateur',      30, 12)
  ) AS t(key, xp, fichas)
  WHERE t.key = p_grade_key;

  IF v_xp IS NULL THEN
    v_xp := 30; v_fichas := 12;
  END IF;

  BEGIN
    INSERT INTO public.career_claims (user_id, day_key, grade_key, xp, fichas)
      VALUES (uid, v_day, p_grade_key, v_xp, v_fichas);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END;

  PERFORM public.award_xp(
    p_amount => v_xp, p_reason => 'career_mode', p_game_id => NULL, p_session_id => NULL,
    p_meta => json_build_object('day', v_day, 'grade', p_grade_key)::jsonb
  );
  IF v_fichas > 0 THEN
    PERFORM public.award_fichas(uid, v_fichas, 'career_mode', json_build_object('day', v_day)::jsonb);
  END IF;

  RETURN json_build_object('ok', true, 'xp', v_xp, 'fichas', v_fichas);
END$$;

REVOKE ALL ON FUNCTION public.claim_career_reward(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_career_reward(TEXT, TEXT) TO authenticated;
