-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-02 — REVOCAR EXECUTE DE FUNCIONES INTERNAS
--  (ajustado al esquema REAL de producción leído el 2026-11-26)
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:    Saca el permiso EXECUTE a PUBLIC / anon / authenticated de las
--          funciones SECURITY DEFINER "internas" (helpers que solo llaman otras
--          funciones del servidor, triggers o el service_role de las Edge
--          Functions). A las de admin (chequean el rol adentro) solo les saca
--          anon/PUBLIC.
--          Se revoca POR NOMBRE, en TODAS las sobrecargas que existan (prod tiene
--          dos activate_subscription: de 6 y de 7 argumentos), así no depende de
--          adivinar firmas.
--
--  POR QUÉ: Supabase da EXECUTE a anon y authenticated en toda función nueva
--          (ALTER DEFAULT PRIVILEGES). Diagnóstico 01 en prod (26/11): award_fichas,
--          add_balones, grant_cosmetic, grant_powerup y activate_subscription
--          son EJECUTABLES por authenticated → cualquiera se da Fichas, Balones
--          (moneda paga), cosméticos o PRO, a sí mismo o a OTRO usuario.
--          Además unlock_achievement_for_user / settle_prode_* reciben el uuid
--          del destinatario (pensadas para service_role).
--
--  CLIENTES: grep de rpc('…') en src/ de main y de v4 + supabase/functions:
--          ninguna de las internas se llama desde el navegador. Las Edge
--          Functions (payment-webhook, send-streak-reminders) usan
--          SUPABASE_SERVICE_ROLE_KEY → se les deja EXECUTE a service_role.
--          NO se tocan:
--            • generate_referral_code(): la llama el trigger trg_set_referral_code,
--              que NO es SECURITY DEFINER → corre como authenticated cuando el
--              cliente hace createUserProfile(). Revocarla rompería el alta.
--            • count_real_users(): el cliente la llama (achievements.js) y es un
--              conteo inofensivo.
--
--  ROLLBACK: GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated;
--          (los permisos originales están en backup_20261126).
-- ════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  -- Internas: solo servidor (otras funciones SECURITY DEFINER, triggers, service_role).
  internas TEXT[] := ARRAY[
    'award_fichas', 'add_balones', 'grant_cosmetic', 'grant_powerup', 'activate_subscription',
    'ensure_daily_challenges', 'ensure_progressive_challenges',
    'owns_cosmetic', 'user_level_of', 'user_is_premium',
    'unlock_achievement_for_user', 'settle_prode_match_pick', 'settle_prode_champion_pick',
    'trg_xp_to_fichas', 'handle_new_user', 'set_referral_code_on_insert', '_dm_bump_sent_count',
    '_purge_ghost_users_core', '_purge_old_direct_messages',
    'get_streak_reminder_targets'
  ];
  -- Admin: chequean role = 'admin' adentro; las usa el panel (authenticated).
  admin_fns TEXT[] := ARRAY[
    'admin_grant_currency', 'delete_user_admin', 'change_user_role_admin',
    'get_users_admin', 'purge_ghost_users', 'get_admin_dashboard'
  ];
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (internas)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    RAISE NOTICE 'Solo service_role: %', r.sig;
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (admin_fns)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    RAISE NOTICE 'authenticated + service_role (chequea admin adentro): %', r.sig;
  END LOOP;
END $$;

COMMIT;

-- Verificación: tiene que dar abiertas = 0.
SELECT count(*) = 0 AS ok,
       count(*)     AS abiertas,
       string_agg(p.oid::regprocedure::text, ', ') AS detalle
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('award_fichas','add_balones','grant_cosmetic','grant_powerup','activate_subscription',
                    'ensure_daily_challenges','ensure_progressive_challenges','owns_cosmetic','user_level_of',
                    'user_is_premium','unlock_achievement_for_user','settle_prode_match_pick',
                    'settle_prode_champion_pick','_purge_ghost_users_core','_purge_old_direct_messages',
                    'get_streak_reminder_targets')
  AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'));
