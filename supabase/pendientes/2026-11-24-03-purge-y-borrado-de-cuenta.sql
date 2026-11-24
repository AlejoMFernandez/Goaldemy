-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-03 — purge_user_data SEGURO + delete_my_account()
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:
--   1) purge_user_data(p_user_id): ahora solo borra si quien llama es
--      (a) el mismo usuario, (b) un admin, (c) service_role, o (d) una
--      conexión directa a la base (SQL Editor). Además borra MÁS tablas
--      (billetera, ledger, pase, reclamos, DMs, amistades…) y desengancha
--      user_profiles.referred_by, que no tiene ON DELETE y bloqueaba el
--      borrado del usuario en auth.users.
--   2) delete_my_account(): RPC sin parámetros que purga los datos del
--      usuario logueado. El borrado COMPLETO (auth.users + Storage +
--      cancelación de suscripción) lo hace la Edge Function
--      supabase/functions/delete-account, que llama a purge_user_data con
--      service_role. delete_my_account queda como respaldo.
--
--  POR QUÉ: purge_user.sql es SECURITY DEFINER, tiene GRANT a authenticated
--      y NO compara p_user_id con auth.uid(). Cualquier usuario puede hacer
--      supabase.rpc('purge_user_data', {p_user_id: '<uuid de otro>'}) y
--      borrarle XP, logros, sesiones y perfil a cualquiera (los UUID se ven
--      en el ranking). Apple además exige borrado de cuenta in-app.
--
--  RIESGO: Bajo. El cliente no llama purge_user_data hoy. Si un admin la
--      usaba desde la app, sigue funcionando (rol admin).
--
--  ROLLBACK: correr de nuevo supabase/purge_user.sql (vuelve a la versión
--      insegura — NO recomendado) y `DROP FUNCTION public.delete_my_account();`.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ¿Quien llama puede actuar sobre p_user_id?
-- Se usa también desde otros parches. SECURITY DEFINER para poder leer
-- user_profiles.role sin depender de RLS.
CREATE OR REPLACE FUNCTION public._caller_can_manage_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claims TEXT := current_setting('request.jwt.claims', true);
  v_role   TEXT;
BEGIN
  -- Conexión directa (SQL Editor / psql): PostgREST siempre setea los claims,
  -- así que "sin claims" = alguien que ya tiene acceso total a la base.
  IF v_claims IS NULL OR v_claims = '' THEN
    RETURN true;
  END IF;
  v_role := v_claims::json->>'role';
  IF v_role = 'service_role' THEN RETURN true; END IF;
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = p_user_id THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin');
END$$;
REVOKE ALL ON FUNCTION public._caller_can_manage_user(UUID) FROM PUBLIC, anon, authenticated;

-- Núcleo del borrado: sin chequeos (solo lo llaman funciones de acá abajo).
CREATE OR REPLACE FUNCTION public._purge_user_data_core(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t TEXT;
  -- tabla:columna. Se saltean las que no existan en tu base.
  targets TEXT[] := ARRAY[
    'user_achievements:user_id', 'xp_events:user_id', 'global_chat_messages:sender_id',
    'game_sessions:user_id', 'user_wallet:user_id', 'currency_ledger:user_id',
    'powerup_inventory:user_id', 'user_cosmetics:user_id', 'user_daily_challenges:user_id',
    'user_daily_claims:user_id', 'user_monthly_pass:user_id', 'user_pass_claims:user_id',
    'user_progressive_progress:user_id', 'reto_claims:user_id', 'guest_game_claims:user_id',
    'career_claims:user_id', 'streak_reminder_log:user_id', 'game_result_reports:user_id',
    'level_up_bonus_claims:user_id', 'achievement_xp_awards:user_id',
    'direct_messages:sender_id', 'direct_messages:recipient_id',
    'connections:user_a', 'connections:user_b',
    'notifications:to_user', 'duel_challenges:challenger_id', 'duel_challenges:opponent_id'
  ];
  v_tab TEXT; v_col TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  FOREACH t IN ARRAY targets LOOP
    v_tab := split_part(t, ':', 1);
    v_col := split_part(t, ':', 2);
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = v_tab AND column_name = v_col) THEN
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', v_tab, v_col) USING p_user_id;
    END IF;
  END LOOP;

  -- Notificaciones que mandó: anonimizar (from_user es ON DELETE SET NULL igual).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='from_user') THEN
    UPDATE public.notifications SET from_user = NULL WHERE from_user = p_user_id;
  END IF;

  -- referred_by NO tiene ON DELETE: si este usuario invitó a otros, el borrado
  -- en auth.users fallaba por FK. Lo desenganchamos.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='referred_by') THEN
    UPDATE public.user_profiles SET referred_by = NULL WHERE referred_by = p_user_id;
  END IF;

  -- Suscripción: se borra la fila (la cancelación en Stripe/MP la hace la Edge Function ANTES).
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    DELETE FROM public.subscriptions WHERE user_id = p_user_id;
  END IF;

  -- Perfil (id o user_id según el entorno)
  BEGIN
    DELETE FROM public.user_profiles WHERE id = p_user_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;
  BEGIN
    DELETE FROM public.user_profiles WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;
END$$;
REVOKE ALL ON FUNCTION public._purge_user_data_core(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._purge_user_data_core(UUID) TO service_role;

-- API pública (misma firma que antes → compatible)
CREATE OR REPLACE FUNCTION public.purge_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._caller_can_manage_user(p_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public._purge_user_data_core(p_user_id);
END$$;
REVOKE ALL ON FUNCTION public.purge_user_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_user_data(uuid) TO authenticated, service_role;

-- Borrar MIS datos (respaldo; la vía principal es la Edge Function delete-account)
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  PERFORM public._purge_user_data_core(uid);
  RETURN json_build_object('ok', true);
END$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMIT;
