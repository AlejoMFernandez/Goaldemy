-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-04 — XP CALCULADA/LIMITADA EN EL SERVIDOR
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:
--   1) Borra la política "Insert xp for self" (insert directo en xp_events)
--      y saca INSERT/UPDATE/DELETE de xp_events a anon/authenticated.
--   2) award_xp pasa a SECURITY INVOKER y distingue quién la llama:
--        • Cliente directo (current_user = authenticated/anon) → ruta
--          VALIDADA (award_xp_client): whitelist de motivos, tope por llamada
--          y tope diario calculados en el servidor con el multiplicador del
--          plan leído de la base.
--        • Otra función SECURITY DEFINER del servidor (claim_daily_challenge,
--          claim_pass_tier, unlock_achievement, claim_*…) → corre como el
--          owner (postgres) → ruta CONFIABLE, igual que hoy. Así NO hay que
--          reescribir ninguna de esas ~10 funciones.
--   3) Motivos permitidos desde el cliente:
--        • 'correct_answer' → XP de juego, con topes (ver constantes abajo).
--        • 'level_up_bonus' → se IGNORA el monto del cliente: el servidor
--          calcula y otorga los bonus de nivel pendientes, 1 vez por nivel
--          (tabla level_up_bonus_claims).
--      Cualquier otro motivo ('daily_challenge', 'achievement', 'monthly_pass',
--      'progressive_challenge', 'daily_reward', …) se RECHAZA desde el cliente:
--      esos son los que disparan Fichas en el trigger xp_to_fichas.
--   4) RPCs nuevas para el cliente con VITE_SERVER_ECONOMY=1:
--        • award_game_xp(p_game_slug, p_base_amount, p_meta): el cliente manda
--          XP BASE (sin multiplicar) y el servidor aplica el multiplicador.
--        • claim_level_up_bonus(): otorga los bonus de nivel pendientes.
--
--  POR QUÉ: award_xp aceptaba cualquier monto y motivo. Con
--      rpc('award_xp',{p_amount:1e6, p_reason:'daily_challenge'}) se sumaba
--      XP ilimitada y además 15 Fichas por llamada vía trigger. Y la política
--      "Insert xp for self" permitía lo mismo con un INSERT directo.
--
--  COMPATIBILIDAD: el cliente actual (sin flag) sigue funcionando:
--      awardXp() manda 'correct_answer' con el monto YA multiplicado → se
--      acepta, se recorta al tope (que ya contempla el multiplicador).
--      _awardBonusXpSilent manda 'level_up_bonus' → el servidor otorga lo que
--      corresponde (puede diferir del monto que muestra la UI solo si alguien
--      hizo trampa).
--
--  RIESGO: Medio.
--      • Si un juego legítimo da más de XP_PER_CALL_BASE × multiplicador en
--        una partida, se recorta. Hoy el máximo teórico ronda 3000-3500 base
--        (Grilla en Difícil). Ajustá las constantes si hace falta.
--      • Tope diario = tope por llamada × (sesiones de juego iniciadas hoy + 1).
--      • Backfill: a los usuarios existentes se les marcan como YA cobrados los
--        bonus de nivel hasta su nivel actual (no se les regala de nuevo).
--
--  AJUSTES 2026-11-26 (esquema real de prod):
--   • En prod NO existe "Insert xp for self" (no hay INSERT directo): el DROP
--     POLICY IF EXISTS no hace nada; el REVOKE de INSERT/UPDATE/DELETE igual se
--     deja como cinturón.
--   • Correr DESPUÉS de 2026-11-26-curva-niveles-1-100.sql: el backfill de
--     level_up_bonus_claims usa level_thresholds y con la tabla rota marcaría
--     niveles equivocados.
--   • Bonus de nivel alineado con los hitos 60–100 del cliente v4.
--   • Clientes: main y v4 (flag apagado) llaman award_xp solo con
--     'correct_answer' (game-xp.js) y 'level_up_bonus' (notifications.js) → las
--     dos rutas siguen andando. Las demás razones vienen de funciones SECURITY
--     DEFINER (ruta confiable).
--
--  ROLLBACK (vuelve al estado inseguro):
--      BEGIN;
--      CREATE POLICY "Insert xp for self" ON public.xp_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
--      GRANT INSERT ON public.xp_events TO authenticated;
--      -- y volver a crear award_xp como estaba en supabase/schema.sql (SECURITY DEFINER sin chequeos)
--      COMMIT;
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Cerrar el insert directo ─────────────────────────────────────
DROP POLICY IF EXISTS "Insert xp for self" ON public.xp_events;
REVOKE INSERT, UPDATE, DELETE ON public.xp_events FROM anon, authenticated;

-- ── 2) Bonus de nivel: 1 cobro por (usuario, nivel) ─────────────────
CREATE TABLE IF NOT EXISTS public.level_up_bonus_claims (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level      INTEGER NOT NULL,
  xp         INTEGER NOT NULL DEFAULT 0,
  backfill   BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
ALTER TABLE public.level_up_bonus_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "level_up_bonus_claims read own" ON public.level_up_bonus_claims;
CREATE POLICY "level_up_bonus_claims read own" ON public.level_up_bonus_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Nivel por XP total (independiente de otras funciones)
CREATE OR REPLACE FUNCTION public._xp_level_of(p_uid UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT max(lt.level) FROM public.level_thresholds lt
    WHERE lt.xp_required <= (SELECT COALESCE(sum(amount), 0) FROM public.xp_events WHERE user_id = p_uid)
  ), 1);
$$;
REVOKE ALL ON FUNCTION public._xp_level_of(UUID) FROM PUBLIC, anon, authenticated;

-- Backfill UNA sola vez (si la tabla está vacía): los niveles ya alcanzados
-- se dan por cobrados, para no regalar todos los bonus históricos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.level_up_bonus_claims) THEN
    INSERT INTO public.level_up_bonus_claims (user_id, level, xp, backfill)
    SELECT t.user_id, gs.lvl, 0, true
    FROM (
      SELECT e.user_id,
             COALESCE((SELECT max(lt.level) FROM public.level_thresholds lt WHERE lt.xp_required <= sum(e.amount)), 1) AS lvl
      FROM public.xp_events e
      GROUP BY e.user_id
    ) t
    CROSS JOIN LATERAL generate_series(2, t.lvl) AS gs(lvl)
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Monto del bonus por nivel (espejo de getLevelUpXpBonus + MILESTONES del
-- cliente v4, src/services/level-rewards.js: en los hitos de rango —10, 20 … 100—
-- el bonus del hito REEMPLAZA al normal; ver stores/notifications.js totalBonus).
CREATE OR REPLACE FUNCTION public._level_up_bonus_xp(p_level INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_level = 10  THEN 150
    WHEN p_level = 20  THEN 300
    WHEN p_level = 30  THEN 500
    WHEN p_level = 40  THEN 750
    WHEN p_level = 50  THEN 1000
    WHEN p_level = 60  THEN 1250
    WHEN p_level = 70  THEN 1500
    WHEN p_level = 80  THEN 1750
    WHEN p_level = 90  THEN 2000
    WHEN p_level = 100 THEN 3000
    WHEN p_level <= 5  THEN 25
    WHEN p_level <= 10 THEN 50
    WHEN p_level <= 15 THEN 75
    WHEN p_level <= 20 THEN 100
    WHEN p_level <= 25 THEN 150
    WHEN p_level <= 30 THEN 200
    WHEN p_level <= 40 THEN 300
    ELSE 400
  END;
$$;

-- Otorga todos los bonus de nivel pendientes (puede encadenar: el bonus
-- puede hacer subir otro nivel, que también se paga una sola vez).
CREATE OR REPLACE FUNCTION public._grant_level_up_bonuses(p_uid UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total  INTEGER := 0;
  v_levels INTEGER[] := ARRAY[]::INTEGER[];
  v_level  INTEGER;
  v_lvl    INTEGER;
  v_xp     INTEGER;
  v_guard  INTEGER := 0;
BEGIN
  IF p_uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('lvlbonus:' || p_uid::text));
  LOOP
    v_guard := v_guard + 1;
    EXIT WHEN v_guard > 10;
    v_level := public._xp_level_of(p_uid);
    v_lvl := NULL;
    SELECT gs INTO v_lvl FROM generate_series(2, v_level) gs
      WHERE NOT EXISTS (SELECT 1 FROM public.level_up_bonus_claims c WHERE c.user_id = p_uid AND c.level = gs)
      ORDER BY gs LIMIT 1;
    EXIT WHEN v_lvl IS NULL;
    v_xp := public._level_up_bonus_xp(v_lvl);
    INSERT INTO public.level_up_bonus_claims (user_id, level, xp) VALUES (p_uid, v_lvl, v_xp);
    INSERT INTO public.xp_events (user_id, amount, reason, meta)
      VALUES (p_uid, v_xp, 'level_up_bonus', jsonb_build_object('level', v_lvl, 'source', 'server'));
    v_total := v_total + v_xp;
    v_levels := v_levels || v_lvl;
  END LOOP;
  RETURN json_build_object('ok', true, 'xp', v_total, 'levels', to_json(v_levels));
END$$;
REVOKE ALL ON FUNCTION public._grant_level_up_bonuses(UUID) FROM PUBLIC, anon, authenticated;

-- ── 3) XP de juego validada ─────────────────────────────────────────
-- p_already_boosted = true → el monto viene YA multiplicado (cliente viejo).
CREATE OR REPLACE FUNCTION public._award_game_xp_checked(
  p_uid UUID, p_amount INTEGER, p_already_boosted BOOLEAN,
  p_game_id UUID, p_session_id UUID, p_meta JSONB
) RETURNS public.xp_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- ── CONSTANTES (ajustables) ──
  XP_PER_CALL_BASE CONSTANT INTEGER := 5000;  -- tope por partida, antes del multiplicador
  -- ─────────────────────────────
  v_mult      NUMERIC := 1.0;
  v_cap_call  INTEGER;
  v_cap_day   INTEGER;
  v_used      BIGINT;
  v_sessions  INTEGER;
  v_amount    INTEGER;
  v_day_start TIMESTAMPTZ := (public.app_today()::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_event     public.xp_events;
BEGIN
  IF p_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN NULL; END IF;

  -- Serializa por usuario (evita carreras con llamadas en paralelo)
  PERFORM pg_advisory_xact_lock(hashtext('xp:' || p_uid::text));

  -- Multiplicador del plan, leído de la base (no del cliente)
  SELECT COALESCE(pl.xp_multiplier, 1.0) INTO v_mult
  FROM public.subscriptions s JOIN public.plans pl ON pl.slug = s.plan_slug
  WHERE s.user_id = p_uid AND s.status = 'active'
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;
  v_mult := LEAST(GREATEST(COALESCE(v_mult, 1.0), 1.0), 3.0);

  v_amount := CASE WHEN p_already_boosted THEN p_amount ELSE round(p_amount * v_mult)::int END;
  v_cap_call := round(XP_PER_CALL_BASE * v_mult)::int;
  v_amount := LEAST(v_amount, v_cap_call);

  -- Tope diario atado a partidas reales: tope × (sesiones iniciadas hoy + 1)
  SELECT count(*) INTO v_sessions FROM public.game_sessions
    WHERE user_id = p_uid AND started_at >= v_day_start;
  v_cap_day := v_cap_call * (LEAST(v_sessions, 60) + 1);

  SELECT COALESCE(sum(amount), 0) INTO v_used FROM public.xp_events
    WHERE user_id = p_uid AND reason = 'correct_answer' AND created_at >= v_day_start;
  IF v_used >= v_cap_day THEN RETURN NULL; END IF;
  v_amount := LEAST(v_amount, (v_cap_day - v_used)::int);
  IF v_amount <= 0 THEN RETURN NULL; END IF;

  -- game_id / session_id: solo si existen y son del usuario
  IF p_game_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.games WHERE id = p_game_id) THEN
    p_game_id := NULL;
  END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.game_sessions WHERE id = p_session_id AND user_id = p_uid) THEN
    p_session_id := NULL;
  END IF;

  INSERT INTO public.xp_events (user_id, game_id, amount, reason, session_id, meta)
  VALUES (p_uid, p_game_id, v_amount, 'correct_answer', p_session_id,
          COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('source', 'client', 'requested', p_amount, 'mult', v_mult))
  RETURNING * INTO v_event;
  RETURN v_event;
END$$;
REVOKE ALL ON FUNCTION public._award_game_xp_checked(UUID, INTEGER, BOOLEAN, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- Ruta del cliente para award_xp (misma firma que award_xp)
CREATE OR REPLACE FUNCTION public.award_xp_client(
  p_amount int,
  p_reason text default 'correct_answer',
  p_game_id uuid default null,
  p_session_id uuid default null,
  p_meta jsonb default '{}'::jsonb
) RETURNS public.xp_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_reason = 'correct_answer' THEN
    RETURN public._award_game_xp_checked(uid, p_amount, true, p_game_id, p_session_id, p_meta);
  ELSIF p_reason = 'level_up_bonus' THEN
    PERFORM public._grant_level_up_bonuses(uid);   -- el monto del cliente se ignora
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'XP reason not allowed from client: %', p_reason USING ERRCODE = '42501';
END$$;
REVOKE ALL ON FUNCTION public.award_xp_client(int, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp_client(int, text, uuid, uuid, jsonb) TO authenticated;

-- award_xp: SECURITY INVOKER + despacho según quién llama.
CREATE OR REPLACE FUNCTION public.award_xp(
  p_amount int,
  p_reason text default 'correct_answer',
  p_game_id uuid default null,
  p_session_id uuid default null,
  p_meta jsonb default '{}'::jsonb
) RETURNS public.xp_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event public.xp_events;
BEGIN
  -- Llamada directa desde PostgREST: el rol efectivo es anon/authenticated.
  -- Desde otra función SECURITY DEFINER, current_user es su owner (postgres).
  IF current_user IN ('anon', 'authenticated') THEN
    RETURN public.award_xp_client(p_amount, p_reason, p_game_id, p_session_id, p_meta);
  END IF;

  -- Ruta confiable (servidor): mismo comportamiento que antes.
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'Invalid XP amount'; END IF;
  INSERT INTO public.xp_events(user_id, game_id, amount, reason, session_id, meta)
  VALUES (v_user_id, p_game_id, p_amount, p_reason, p_session_id, coalesce(p_meta, '{}'::jsonb))
  RETURNING * INTO v_event;
  RETURN v_event;
END$$;
REVOKE ALL ON FUNCTION public.award_xp(int, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(int, text, uuid, uuid, jsonb) TO authenticated, service_role;

-- ── 4) RPCs nuevas (cliente con VITE_SERVER_ECONOMY=1) ─────────────
CREATE OR REPLACE FUNCTION public.award_game_xp(p_game_slug TEXT, p_base_amount INTEGER, p_meta JSONB DEFAULT '{}'::jsonb)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_gid UUID;
  v_ev public.xp_events;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT id INTO v_gid FROM public.games WHERE slug = p_game_slug;
  v_ev := public._award_game_xp_checked(uid, p_base_amount, false, v_gid, NULL,
            COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('game', p_game_slug));
  RETURN json_build_object('ok', true, 'xp', COALESCE(v_ev.amount, 0));
END$$;
REVOKE ALL ON FUNCTION public.award_game_xp(TEXT, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_game_xp(TEXT, INTEGER, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_level_up_bonus()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  RETURN public._grant_level_up_bonuses(auth.uid());
END$$;
REVOKE ALL ON FUNCTION public.claim_level_up_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_level_up_bonus() TO authenticated;

COMMIT;

-- Verificación: award_xp ya no es SECURITY DEFINER, xp_events sin escritura directa,
-- helpers internos cerrados y RPCs nuevas presentes.
SELECT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.award_xp(int, text, uuid, uuid, jsonb)'::regprocedure)
   AND NOT has_table_privilege('authenticated', 'public.xp_events', 'INSERT')
   AND NOT has_function_privilege('authenticated', 'public._award_game_xp_checked(uuid, integer, boolean, uuid, uuid, jsonb)'::regprocedure, 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public._grant_level_up_bonuses(uuid)'::regprocedure, 'EXECUTE')
   AND to_regprocedure('public.award_game_xp(text, integer, jsonb)') IS NOT NULL
   AND to_regprocedure('public.claim_level_up_bonus()') IS NOT NULL AS ok,
       (SELECT count(*) FROM public.level_up_bonus_claims WHERE backfill) AS bonus_backfill;

-- Prueba manual (en STAGING, logueado como un usuario de prueba vía la app/consola):
--   await supabase.rpc('award_xp', {p_amount: 999999, p_reason: 'daily_challenge'})  → error 42501
--   await supabase.rpc('award_xp', {p_amount: 999999, p_reason: 'correct_answer'})   → recorta a 5000×mult
--   await supabase.from('xp_events').insert({user_id: miId, amount: 1})               → error RLS
