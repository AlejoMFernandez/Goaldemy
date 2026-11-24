-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-02 — REVOCAR EXECUTE DE FUNCIONES INTERNAS
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:    Saca el permiso EXECUTE a PUBLIC / anon / authenticated de las
--          funciones SECURITY DEFINER que son "internas" (helpers que solo
--          deberían llamar otras funciones del servidor o el service_role).
--
--  POR QUÉ: Postgres da EXECUTE a PUBLIC por defecto en toda función nueva y
--          Supabase además se lo da explícitamente a anon y authenticated
--          (ALTER DEFAULT PRIVILEGES). mejoras11 hizo `REVOKE ... FROM PUBLIC`
--          en award_fichas/add_balones, pero eso NO saca el grant directo a
--          authenticated (lo dice el propio guest-game-claim.sql). Resultado:
--          cualquier usuario logueado puede hacer desde la consola:
--             supabase.rpc('award_fichas', {p_uid: miId, p_amount: 999999, p_reason:'x'})
--             supabase.rpc('add_balones',  {...})            ← moneda PAGA
--             supabase.rpc('grant_cosmetic', {...})          ← cosméticos premium
--             supabase.rpc('activate_subscription', {...})   ← PRO gratis para siempre
--          Y como reciben p_uid/p_user_id, también a OTRO usuario.
--
--  RIESGO: Bajo. El cliente (src/) NO llama ninguna de estas funciones (se
--          verificó con grep de `rpc('...')`). Las llaman otras funciones
--          SECURITY DEFINER, que corren como su owner (postgres) y no
--          necesitan el grant. Las Edge Functions usan service_role, al que se
--          le deja/da EXECUTE explícito.
--          Si alguna función no existe en tu base, se saltea (NOTICE).
--
--  ROLLBACK: (no recomendado) GRANT EXECUTE ON FUNCTION <firma> TO authenticated;
--          para la función puntual que haya que devolver.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  -- Internas: nadie del lado cliente. service_role sí (Edge Functions / cron).
  internas TEXT[] := ARRAY[
    'public.award_fichas(uuid, integer, text, jsonb)',
    'public.add_balones(uuid, integer, text, jsonb)',
    'public.grant_cosmetic(uuid, text)',
    'public.grant_powerup(uuid, text, integer)',
    'public.activate_subscription(uuid, text, text, text, timestamptz, timestamptz)',
    'public.ensure_daily_challenges(uuid)',
    'public.ensure_progressive_challenges(uuid)',
    'public.owns_cosmetic(uuid, text)',
    'public.user_level_of(uuid)',
    'public.user_is_premium(uuid)',
    'public.trg_xp_to_fichas()',
    'public.handle_new_user()',
    'public.set_referral_code_on_insert()',
    'public.generate_referral_code()',
    'public._purge_ghost_users_core(integer)',
    'public._dm_bump_sent_count()',
    'public._purge_old_direct_messages(interval)',
    'public.get_streak_reminder_targets()'
  ];
  -- De admin: tienen chequeo de rol adentro; solo les sacamos anon/PUBLIC.
  admin_fns TEXT[] := ARRAY[
    'public.admin_grant_currency(uuid, text, integer)',
    'public.delete_user_admin(uuid)',
    'public.change_user_role_admin(uuid, text)',
    'public.get_users_admin()',
    'public.purge_ghost_users(integer)',
    'public.count_real_users()',
    'public.get_admin_dashboard()'
  ];
  f TEXT;
BEGIN
  FOREACH f IN ARRAY internas LOOP
    IF to_regprocedure(f) IS NULL THEN
      RAISE NOTICE 'No existe (se saltea): %', f;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    RAISE NOTICE 'Revocada (solo service_role): %', f;
  END LOOP;

  FOREACH f IN ARRAY admin_fns LOOP
    IF to_regprocedure(f) IS NULL THEN
      RAISE NOTICE 'No existe (se saltea): %', f;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    RAISE NOTICE 'Solo authenticated (chequea admin adentro): %', f;
  END LOOP;
END $$;

-- Verificación inmediata: esto tiene que devolver 0 filas.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('award_fichas','add_balones','grant_cosmetic','grant_powerup','activate_subscription')
  AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'));

COMMIT;

-- ── OPCIONAL (recomendado a futuro, NO se aplica acá) ─────────────────
-- Que las funciones NUEVAS no nazcan ejecutables por anon/authenticated.
-- Ojo: después de esto, toda RPC nueva necesita su GRANT explícito a
-- authenticated (las migraciones del repo ya lo hacen casi siempre).
--
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
