-- ════════════════════════════════════════════════════════════
--  PRODE — pronósticos sobre partidos reales
-- ════════════════════════════════════════════════════════════
--  Ver docs/superpowers/specs/2026-08-28-prode-design.md para el diseño completo.
--  Correr en el SQL Editor de Supabase (o vía apply_migration).
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prode_picks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition    TEXT NOT NULL,
  match_id       TEXT NOT NULL,
  home_team      TEXT NOT NULL,
  away_team      TEXT NOT NULL,
  home_pick      SMALLINT NOT NULL,
  away_pick      SMALLINT NOT NULL,
  kickoff_at     TIMESTAMPTZ NOT NULL,
  round          TEXT,
  points         SMALLINT,
  xp_awarded     SMALLINT,
  fichas_awarded SMALLINT,
  settled_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_prode_picks_settlement
  ON public.prode_picks (competition, settled_at)
  WHERE settled_at IS NULL;

ALTER TABLE public.prode_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prode_picks read own" ON public.prode_picks;
CREATE POLICY "prode_picks read own" ON public.prode_picks
  FOR SELECT USING (auth.uid() = user_id);
-- Sin policy de INSERT/UPDATE: todo escritura pasa por submit_prode_pick / settle_prode_match_pick (SECURITY DEFINER).

-- RPC cliente: carga o actualiza un pronóstico mientras el partido no arrancó.
CREATE OR REPLACE FUNCTION public.submit_prode_pick(
  p_competition TEXT,
  p_match_id    TEXT,
  p_home_team   TEXT,
  p_away_team   TEXT,
  p_home_pick   SMALLINT,
  p_away_pick   SMALLINT,
  p_kickoff_at  TIMESTAMPTZ,
  p_round       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'auth');
  END IF;
  IF p_kickoff_at <= now() THEN
    RETURN json_build_object('ok', false, 'error', 'locked');
  END IF;
  IF p_home_pick IS NULL OR p_away_pick IS NULL
     OR p_home_pick < 0 OR p_away_pick < 0
     OR p_home_pick > 20 OR p_away_pick > 20 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_score');
  END IF;

  INSERT INTO public.prode_picks
    (user_id, competition, match_id, home_team, away_team, home_pick, away_pick, kickoff_at, round)
  VALUES
    (uid, p_competition, p_match_id, p_home_team, p_away_team, p_home_pick, p_away_pick, p_kickoff_at, p_round)
  ON CONFLICT (user_id, match_id) DO UPDATE SET
    home_pick  = EXCLUDED.home_pick,
    away_pick  = EXCLUDED.away_pick,
    kickoff_at = EXCLUDED.kickoff_at,
    round      = EXCLUDED.round,
    updated_at = now()
  WHERE public.prode_picks.kickoff_at > now() AND public.prode_picks.settled_at IS NULL;

  RETURN json_build_object('ok', true);
END$$;

REVOKE ALL ON FUNCTION public.submit_prode_pick(TEXT, TEXT, TEXT, TEXT, SMALLINT, SMALLINT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_prode_pick(TEXT, TEXT, TEXT, TEXT, SMALLINT, SMALLINT, TIMESTAMPTZ, TEXT) TO authenticated;
