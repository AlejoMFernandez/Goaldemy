-- ════════════════════════════════════════════════════════════════════════
--  2026-11-26 · ABONO DE TEMPORADA — servidor para los gestos del artifact
--  ⚠ SIN APLICAR. No correr en producción sin aprobación explícita de Alejo.
--    Probar primero en staging. Idempotente (se puede correr dos veces).
-- ════════════════════════════════════════════════════════════════════════
--
-- QUÉ
--  1. Fichas por talón: columnas free_fichas / premium_fichas en
--     monthly_pass_tiers. claim_pass_tier las paga con award_fichas.
--  2. Nivel 0 de Platea: fila tier = 0 (points_required 0, solo Platea) que
--     se cobra apenas activás PRO. claim_pass_tier rechaza tier 0 en Popular.
--  3. Tiempo de descuento: pasado el nivel 30, cada 30 puntos = 1 talón de
--     50 Fichas en cada pista (Platea solo si sos PRO), tope 10 por mes.
--     Tabla user_pass_overtime_claims + RPC claim_pass_overtime(p_track).
--  4. get_monthly_pass devuelve además:
--       · <track>_fichas en cada tier,
--       · overtime = { step, fichas, max, earned, free_claimed, premium_claimed },
--       · previous = resumen del mes anterior para el "pitazo final":
--         { month, season_name, points, level, total_levels, claimed }.
--  5. Temporada de lanzamiento RETRO (theme = 'retro', sepia) para el mes en
--     que se aplique este archivo.
--
-- POR QUÉ
--  El front v4 (MonthlyPass.vue + components/pass/*) ya pinta todo esto, pero
--  SOLO si get_monthly_pass lo trae. Sin este SQL la UI funciona igual que hoy:
--  sin nivel 0, sin talones de Fichas, sin descuento, y el pitazo final usa la
--  foto local del mes que guarda el navegador.
--
-- DECISIONES ABIERTAS (no las toma este archivo)
--  · Acreditar solos los talones no cortados al cerrar el mes (el artifact lo
--    recomienda). Si se decide, sumar 'credited' a `previous` y la UI muestra
--    "Los N talones que no cortaste se acreditaron solos".
--  · Fichas en pausa: si se reactivan, poner monthly_pass → 0 en
--    trg_xp_to_fichas para no pagar Fichas ocultas además de las visibles.
--  · Valores: 150 Fichas en el nivel 0 son PROVISORIOS hasta tener el borde
--    "Cuello polo" del set Retro (va en pass_season_rewards, tier 0, premium).
--
-- RIESGO
--  Bajo. Columnas nuevas con DEFAULT 0; las funciones se reemplazan con la
--  misma firma. Clientes viejos ignoran los campos nuevos, pero VERÍAN la fila
--  tier 0 en la lista (el cliente v4 la maneja; el de main la mostraría como
--  un nivel más). Aplicar junto con el deploy del front v4.
--
-- ROLLBACK
--  BEGIN;
--  DELETE FROM public.monthly_pass_tiers WHERE tier = 0;
--  DROP FUNCTION IF EXISTS public.claim_pass_overtime(TEXT);
--  DROP TABLE IF EXISTS public.user_pass_overtime_claims;
--  ALTER TABLE public.monthly_pass_tiers DROP COLUMN IF EXISTS free_fichas, DROP COLUMN IF EXISTS premium_fichas;
--  -- y volver a correr get_monthly_pass / claim_pass_tier de supabase/mejoras7-pass-timezone.sql
--  COMMIT;
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Fichas por talón ───────────────────────────────────
ALTER TABLE public.monthly_pass_tiers
  ADD COLUMN IF NOT EXISTS free_fichas    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS premium_fichas INTEGER NOT NULL DEFAULT 0;

-- ─── 2. Nivel 0 de Platea ─────────────────────────────────
INSERT INTO public.monthly_pass_tiers (tier, points_required, premium_fichas)
VALUES (0, 0, 150)
ON CONFLICT (tier) DO NOTHING;

-- ─── 3. Tiempo de descuento ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_pass_overtime_claims (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month      DATE NOT NULL,
  track      TEXT NOT NULL CHECK (track IN ('free','premium')),
  n          INTEGER NOT NULL CHECK (n BETWEEN 1 AND 10),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month, track, n)
);
ALTER TABLE public.user_pass_overtime_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own overtime claims" ON public.user_pass_overtime_claims;
CREATE POLICY "Own overtime claims" ON public.user_pass_overtime_claims FOR SELECT USING (auth.uid() = user_id);
-- Sin INSERT para clientes: solo claim_pass_overtime (SECURITY DEFINER).

-- Talones de descuento ganados con p_points (0..10)
CREATE OR REPLACE FUNCTION public.pass_overtime_earned(p_points INTEGER)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT LEAST(10, GREATEST(0, (COALESCE(p_points, 0) - COALESCE((SELECT MAX(points_required) FROM public.monthly_pass_tiers), 0)) / 30));
$$;

CREATE OR REPLACE FUNCTION public.claim_pass_overtime(p_track TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_points INTEGER := 0;
  v_earned INTEGER;
  v_done INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  IF p_track NOT IN ('free','premium') THEN RETURN json_build_object('ok', false, 'error', 'bad_track'); END IF;
  IF p_track = 'premium' AND NOT public.user_is_premium(uid) THEN
    RETURN json_build_object('ok', false, 'error', 'premium_required');
  END IF;

  SELECT points INTO v_points FROM public.user_monthly_pass WHERE user_id = uid AND month = v_month;
  v_earned := public.pass_overtime_earned(v_points);
  SELECT COUNT(*) INTO v_done FROM public.user_pass_overtime_claims WHERE user_id = uid AND month = v_month AND track = p_track;
  IF v_done >= v_earned THEN RETURN json_build_object('ok', false, 'error', 'locked'); END IF;

  -- La PK evita el doble cobro si llegan dos pedidos a la vez
  INSERT INTO public.user_pass_overtime_claims (user_id, month, track, n) VALUES (uid, v_month, p_track, v_done + 1);
  PERFORM public.award_fichas(uid, 50, 'monthly_pass_overtime', json_build_object('n', v_done + 1, 'track', p_track)::jsonb);

  RETURN json_build_object('ok', true, 'track', p_track, 'n', v_done + 1, 'fichas', 50);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('ok', false, 'error', 'already_claimed');
END$$;

-- ─── 4a. claim_pass_tier: + Fichas y nivel 0 solo Platea ──
CREATE OR REPLACE FUNCTION public.claim_pass_tier(p_tier INTEGER, p_track TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_points INTEGER := 0;
  v_tier RECORD;
  v_xp INTEGER;
  v_pu TEXT;
  v_qty INTEGER;
  v_fi INTEGER;
  v_cos TEXT;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  IF p_track NOT IN ('free','premium') THEN RETURN json_build_object('ok', false, 'error', 'bad_track'); END IF;
  IF p_tier = 0 AND p_track = 'free' THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  SELECT * INTO v_tier FROM public.monthly_pass_tiers WHERE tier = p_tier;
  IF v_tier IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  SELECT points INTO v_points FROM public.user_monthly_pass WHERE user_id = uid AND month = v_month;
  v_points := COALESCE(v_points, 0);
  IF v_points < v_tier.points_required THEN RETURN json_build_object('ok', false, 'error', 'locked'); END IF;

  IF p_track = 'premium' AND NOT public.user_is_premium(uid) THEN
    RETURN json_build_object('ok', false, 'error', 'premium_required');
  END IF;

  IF EXISTS(SELECT 1 FROM public.user_pass_claims WHERE user_id = uid AND month = v_month AND tier = p_tier AND track = p_track) THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  IF p_track = 'free' THEN
    v_xp := v_tier.free_xp; v_pu := v_tier.free_powerup; v_qty := v_tier.free_powerup_qty; v_fi := v_tier.free_fichas;
  ELSE
    v_xp := v_tier.premium_xp; v_pu := v_tier.premium_powerup; v_qty := v_tier.premium_powerup_qty; v_fi := v_tier.premium_fichas;
  END IF;

  -- Primero el registro (la PK de user_pass_claims frena el doble cobro)
  INSERT INTO public.user_pass_claims (user_id, month, tier, track) VALUES (uid, v_month, p_tier, p_track);

  IF v_xp > 0 THEN
    PERFORM public.award_xp(v_xp, 'monthly_pass', NULL, NULL, json_build_object('tier', p_tier, 'track', p_track)::jsonb);
  END IF;
  IF v_pu IS NOT NULL AND v_qty > 0 THEN
    PERFORM public.grant_powerup(uid, v_pu, v_qty);
  END IF;
  IF COALESCE(v_fi, 0) > 0 THEN
    PERFORM public.award_fichas(uid, v_fi, 'monthly_pass', json_build_object('tier', p_tier, 'track', p_track)::jsonb);
  END IF;

  SELECT cosmetic_code INTO v_cos
  FROM public.pass_season_rewards
  WHERE month = public.pass_rewards_month(v_month) AND tier = p_tier AND track = p_track;
  IF v_cos IS NOT NULL THEN
    PERFORM public.grant_cosmetic(uid, v_cos);
  END IF;

  RETURN json_build_object('ok', true, 'tier', p_tier, 'track', p_track,
                           'xp', v_xp, 'powerup', v_pu, 'powerup_qty', v_qty,
                           'fichas', COALESCE(v_fi, 0), 'cosmetic', v_cos);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('ok', false, 'error', 'already_claimed');
END$$;

-- ─── 4b. get_monthly_pass: + Fichas, descuento y mes anterior ──
CREATE OR REPLACE FUNCTION public.get_monthly_pass()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_prev DATE := (date_trunc('month', public.app_today()) - INTERVAL '1 month')::date;
  v_rmonth DATE;
  v_points INTEGER := 0;
  v_prev_points INTEGER;
  v_premium BOOLEAN := false;
  v_days_left INTEGER;
  v_season RECORD;
  v_prev_season RECORD;
  v_tiers JSON;
  v_overtime JSON;
  v_previous JSON := NULL;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('points', 0, 'tiers', '[]'::json); END IF;

  v_rmonth := public.pass_rewards_month(v_month);
  SELECT points INTO v_points FROM public.user_monthly_pass WHERE user_id = uid AND month = v_month;
  v_points := COALESCE(v_points, 0);
  v_premium := public.user_is_premium(uid);
  v_days_left := ((date_trunc('month', public.app_today()) + INTERVAL '1 month')::date - public.app_today());
  SELECT * INTO v_season FROM public.pass_seasons WHERE month = v_month;

  SELECT COALESCE(json_agg(t ORDER BY t.tier), '[]'::json) INTO v_tiers
  FROM (
    SELECT mt.tier, mt.points_required,
           (v_points >= mt.points_required) AS unlocked,
           mt.free_xp, mt.free_powerup, mt.free_powerup_qty, mt.free_fichas,
           mt.premium_xp, mt.premium_powerup, mt.premium_powerup_qty, mt.premium_fichas,
           EXISTS(SELECT 1 FROM public.user_pass_claims c WHERE c.user_id = uid AND c.month = v_month AND c.tier = mt.tier AND c.track = 'free')    AS free_claimed,
           EXISTS(SELECT 1 FROM public.user_pass_claims c WHERE c.user_id = uid AND c.month = v_month AND c.tier = mt.tier AND c.track = 'premium') AS premium_claimed,
           (SELECT row_to_json(fc) FROM (
              SELECT c.code, c.type, c.name, c.rarity, c.style_key
              FROM public.pass_season_rewards r JOIN public.cosmetics c ON c.code = r.cosmetic_code
              WHERE r.month = v_rmonth AND r.tier = mt.tier AND r.track = 'free'
           ) fc) AS free_cosmetic,
           (SELECT row_to_json(pc) FROM (
              SELECT c.code, c.type, c.name, c.rarity, c.style_key
              FROM public.pass_season_rewards r JOIN public.cosmetics c ON c.code = r.cosmetic_code
              WHERE r.month = v_rmonth AND r.tier = mt.tier AND r.track = 'premium'
           ) pc) AS premium_cosmetic
    FROM public.monthly_pass_tiers mt
  ) t;

  v_overtime := json_build_object(
    'step', 30, 'fichas', 50, 'max', 10,
    'earned', public.pass_overtime_earned(v_points),
    'free_claimed',    (SELECT COUNT(*) FROM public.user_pass_overtime_claims o WHERE o.user_id = uid AND o.month = v_month AND o.track = 'free'),
    'premium_claimed', (SELECT COUNT(*) FROM public.user_pass_overtime_claims o WHERE o.user_id = uid AND o.month = v_month AND o.track = 'premium')
  );

  -- Resumen del mes anterior (solo si jugó ese mes): lo usa el pitazo final
  SELECT points INTO v_prev_points FROM public.user_monthly_pass WHERE user_id = uid AND month = v_prev;
  IF v_prev_points IS NOT NULL THEN
    SELECT * INTO v_prev_season FROM public.pass_seasons WHERE month = v_prev;
    v_previous := json_build_object(
      'month', v_prev,
      'season_name', v_prev_season.name,
      'points', v_prev_points,
      'level', (SELECT COUNT(*) FROM public.monthly_pass_tiers mt WHERE mt.tier > 0 AND mt.points_required <= v_prev_points),
      'total_levels', (SELECT COUNT(*) FROM public.monthly_pass_tiers mt WHERE mt.tier > 0),
      'claimed', (SELECT COUNT(*) FROM public.user_pass_claims c WHERE c.user_id = uid AND c.month = v_prev)
    );
  END IF;

  RETURN json_build_object(
    'month', v_month,
    'points', v_points,
    'is_premium', v_premium,
    'days_left', v_days_left,
    'season', CASE WHEN v_season.month IS NULL THEN NULL
                   ELSE json_build_object('name', v_season.name, 'accent', v_season.accent, 'theme', v_season.theme) END,
    'tiers', v_tiers,
    'overtime', v_overtime,
    'previous', v_previous
  );
END$$;

-- ─── 5. Temporada de lanzamiento: RETRO ───────────────────
-- Se carga en el mes en que se aplica este archivo (si ese mes ya tenía
-- temporada con otro nombre, la pisa: revisar antes de correr).
INSERT INTO public.pass_seasons (month, name, theme, accent)
VALUES (date_trunc('month', public.app_today())::date, 'Temporada Retro', 'retro', 'sepia')
ON CONFLICT (month) DO UPDATE SET name = EXCLUDED.name, theme = EXCLUDED.theme, accent = EXCLUDED.accent;

-- ─── Permisos ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.pass_overtime_earned(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pass_overtime_earned(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_pass() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pass_tier(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pass_overtime(TEXT) TO authenticated;

COMMIT;
