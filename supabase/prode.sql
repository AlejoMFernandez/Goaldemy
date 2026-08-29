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

CREATE TABLE IF NOT EXISTS public.prode_champion_picks (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition      TEXT NOT NULL,
  team_id          TEXT NOT NULL,
  team_name        TEXT NOT NULL,
  locked_at        TIMESTAMPTZ NOT NULL,
  result           TEXT CHECK (result IN ('win', 'loss')),
  xp_awarded       SMALLINT,
  fichas_awarded   SMALLINT,
  balones_awarded  SMALLINT,
  settled_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, competition)
);

CREATE INDEX IF NOT EXISTS idx_prode_champion_settlement
  ON public.prode_champion_picks (competition, settled_at)
  WHERE settled_at IS NULL;

ALTER TABLE public.prode_champion_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prode_champion_picks read own" ON public.prode_champion_picks;
CREATE POLICY "prode_champion_picks read own" ON public.prode_champion_picks
  FOR SELECT USING (auth.uid() = user_id);

-- RPC cliente: elige (o cambia, hasta el lock) el campeón para un torneo.
CREATE OR REPLACE FUNCTION public.submit_prode_champion_pick(
  p_competition TEXT,
  p_team_id     TEXT,
  p_team_name   TEXT,
  p_locked_at   TIMESTAMPTZ
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
  IF p_locked_at <= now() THEN
    RETURN json_build_object('ok', false, 'error', 'locked');
  END IF;

  INSERT INTO public.prode_champion_picks (user_id, competition, team_id, team_name, locked_at)
  VALUES (uid, p_competition, p_team_id, p_team_name, p_locked_at)
  ON CONFLICT (user_id, competition) DO UPDATE SET
    team_id   = EXCLUDED.team_id,
    team_name = EXCLUDED.team_name,
    locked_at = EXCLUDED.locked_at
  WHERE public.prode_champion_picks.locked_at > now() AND public.prode_champion_picks.settled_at IS NULL;

  RETURN json_build_object('ok', true);
END$$;

REVOKE ALL ON FUNCTION public.submit_prode_champion_pick(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_prode_champion_pick(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- Igual que unlock_achievement() ya existente, pero con UID explícito para uso
-- server-side (unlock_achievement() usa auth.uid() y no sirve para un cron).
CREATE OR REPLACE FUNCTION public.unlock_achievement_for_user(
  p_uid  UUID,
  p_code TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ach_id   UUID;
  v_points   INTEGER := 0;
  v_inserted BOOLEAN := false;
BEGIN
  IF p_uid IS NULL THEN RETURN false; END IF;

  SELECT id, points INTO v_ach_id, v_points FROM public.achievements WHERE code = p_code;
  IF v_ach_id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id, metadata)
  VALUES (p_uid, v_ach_id, COALESCE(p_meta, '{}'::jsonb))
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    INSERT INTO public.xp_events (user_id, game_id, amount, reason, session_id, meta)
    VALUES (p_uid, NULL, v_points, 'achievement', NULL, jsonb_build_object('achievement', p_code));
  END IF;

  RETURN v_inserted;
END$$;

REVOKE ALL ON FUNCTION public.unlock_achievement_for_user(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_achievement_for_user(UUID, TEXT, JSONB) TO service_role;

-- Liquida UN pronóstico de partido ya finalizado. Idempotente: si ya estaba
-- liquidado (settled_at not null), no hace nada (UPDATE ... WHERE no matchea).
CREATE OR REPLACE FUNCTION public.settle_prode_match_pick(
  p_pick_id UUID,
  p_points  SMALLINT,
  p_xp      INTEGER,
  p_fichas  INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID;
  v_competition   TEXT;
  v_round         TEXT;
  v_total_correct INTEGER;
  v_round_total   INTEGER;
  v_round_perfect INTEGER;
BEGIN
  UPDATE public.prode_picks
  SET points = p_points, xp_awarded = p_xp, fichas_awarded = p_fichas, settled_at = now(), updated_at = now()
  WHERE id = p_pick_id AND settled_at IS NULL
  RETURNING user_id, competition, round INTO v_uid, v_competition, v_round;

  IF NOT FOUND THEN RETURN; END IF;

  IF p_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, game_id, amount, reason, session_id, meta)
    VALUES (v_uid, NULL, p_xp, 'prode_match', NULL, jsonb_build_object('pick_id', p_pick_id));
  END IF;

  IF p_fichas > 0 THEN
    PERFORM public.award_fichas(v_uid, p_fichas, 'prode_match', jsonb_build_object('pick_id', p_pick_id));
  END IF;

  IF p_points > 0 THEN
    SELECT count(*) INTO v_total_correct FROM public.prode_picks WHERE user_id = v_uid AND points > 0;
    IF v_total_correct >= 5  THEN PERFORM public.unlock_achievement_for_user(v_uid, 'prode_5_correct', '{}'::jsonb); END IF;
    IF v_total_correct >= 10 THEN PERFORM public.unlock_achievement_for_user(v_uid, 'prode_10_correct', '{}'::jsonb); END IF;

    IF v_round IS NOT NULL THEN
      SELECT count(*), count(*) FILTER (WHERE points = 3)
        INTO v_round_total, v_round_perfect
        FROM public.prode_picks
        WHERE user_id = v_uid AND competition = v_competition AND round = v_round AND settled_at IS NOT NULL;
      IF v_round_total >= 3 AND v_round_total = v_round_perfect THEN
        PERFORM public.unlock_achievement_for_user(v_uid, 'prode_perfect_matchday', jsonb_build_object('round', v_round));
      END IF;
    END IF;
  END IF;
END$$;

REVOKE ALL ON FUNCTION public.settle_prode_match_pick(UUID, SMALLINT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_prode_match_pick(UUID, SMALLINT, INTEGER, INTEGER) TO service_role;

-- Liquida el pick de campeón de UN usuario para UNA competición. Idempotente
-- igual que la anterior.
CREATE OR REPLACE FUNCTION public.settle_prode_champion_pick(
  p_user_id     UUID,
  p_competition TEXT,
  p_won         BOOLEAN,
  p_xp          INTEGER,
  p_fichas      INTEGER,
  p_balones     INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.prode_champion_picks
  SET result          = CASE WHEN p_won THEN 'win' ELSE 'loss' END,
      xp_awarded       = CASE WHEN p_won THEN p_xp ELSE 0 END,
      fichas_awarded   = CASE WHEN p_won THEN p_fichas ELSE 0 END,
      balones_awarded  = CASE WHEN p_won THEN p_balones ELSE 0 END,
      settled_at       = now()
  WHERE user_id = p_user_id AND competition = p_competition AND settled_at IS NULL;

  IF NOT FOUND THEN RETURN; END IF;

  IF p_won THEN
    IF p_xp > 0 THEN
      INSERT INTO public.xp_events (user_id, game_id, amount, reason, session_id, meta)
      VALUES (p_user_id, NULL, p_xp, 'prode_champion', NULL, jsonb_build_object('competition', p_competition));
    END IF;
    IF p_fichas > 0 THEN
      PERFORM public.award_fichas(p_user_id, p_fichas, 'prode_champion', jsonb_build_object('competition', p_competition));
    END IF;
    IF p_balones > 0 THEN
      PERFORM public.add_balones(p_user_id, p_balones, 'prode_champion', jsonb_build_object('competition', p_competition));
    END IF;
    PERFORM public.unlock_achievement_for_user(p_user_id, 'prode_champion', jsonb_build_object('competition', p_competition));
  END IF;
END$$;

REVOKE ALL ON FUNCTION public.settle_prode_champion_pick(UUID, TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_prode_champion_pick(UUID, TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER) TO service_role;
