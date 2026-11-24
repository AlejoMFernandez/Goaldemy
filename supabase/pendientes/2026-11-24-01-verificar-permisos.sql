-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-01 — VERIFICAR PERMISOS (SOLO LECTURA)
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:    Consultas de diagnóstico. NO modifican nada (solo SELECT).
--  POR QUÉ: Antes de aplicar los parches 02..10 hay que CONFIRMAR en la base
--          real que los huecos existen. Los .sql del repo no son la verdad:
--          puede haber cosas corridas a mano en el SQL Editor.
--  RIESGO: Ninguno. Se puede correr en producción.
--  ROLLBACK: No aplica.
--
--  Cómo leer los resultados:
--   • Consulta 1: cada función SECURITY DEFINER con si anon/authenticated la
--     pueden ejecutar. Cualquier "interna" (award_fichas, add_balones,
--     grant_cosmetic, grant_powerup, activate_subscription, ensure_*,
--     purge_user_data…) con anon_exec o auth_exec = true es un HUECO.
--   • Consulta 2: políticas RLS de escritura en tablas de economía. Las que
--     aparezcan con cmd INSERT/UPDATE/DELETE/ALL para authenticated son
--     las que permiten trampas (ej. "Insert xp for self").
--   • Consulta 3: privilegios de columna/tabla en user_profiles (rol admin).
--   • Consulta 4: resumen rápido "¿está el hueco?" con true/false.
-- ════════════════════════════════════════════════════════════════════

-- 1) Funciones SECURITY DEFINER del esquema public y quién las ejecuta
SELECT
  p.proname                                              AS funcion,
  pg_get_function_identity_arguments(p.oid)              AS argumentos,
  p.prosecdef                                            AS security_definer,
  pg_get_userbyid(p.proowner)                            AS owner,
  has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
  has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_exec,
  (SELECT string_agg(c, ',') FROM unnest(p.proconfig) c)    AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.prosecdef DESC, (has_function_privilege('authenticated', p.oid, 'EXECUTE')) DESC, p.proname;

-- 2) Políticas RLS en tablas de economía / progreso
SELECT tablename, policyname, cmd, roles, permissive, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'xp_events','user_achievements','game_sessions','user_profiles','user_wallet',
    'currency_ledger','powerup_inventory','subscriptions','user_cosmetics',
    'user_daily_challenges','user_daily_claims','user_monthly_pass','user_pass_claims',
    'user_progressive_progress','reto_claims','guest_game_claims','career_claims',
    'referral_claims','shop_items','cosmetics'
  )
ORDER BY tablename, cmd, policyname;

-- 3) ¿RLS activo en esas tablas?
SELECT c.relname AS tabla, c.relrowsecurity AS rls_on, c.relforcerowsecurity AS rls_forzado
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- 4) Privilegios de tabla para authenticated en tablas sensibles
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'authenticated'
  AND table_name IN ('user_profiles','xp_events','user_achievements','game_sessions','user_wallet','subscriptions','powerup_inventory')
ORDER BY table_name, privilege_type;

-- 5) Triggers existentes en tablas sensibles (para ver si ya hay protecciones)
SELECT event_object_table AS tabla, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('user_profiles','xp_events','user_achievements','game_sessions')
ORDER BY 1, 2;

-- 6) Resumen: cada fila = un hueco del informe. hueco_presente = true → confirmado.
WITH f AS (
  SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT * FROM (
  SELECT '06 award_fichas ejecutable por authenticated' AS hueco,
         bool_or(has_function_privilege('authenticated', oid, 'EXECUTE')) AS hueco_presente
    FROM f WHERE proname = 'award_fichas'
  UNION ALL
  SELECT '06 add_balones ejecutable por authenticated',
         bool_or(has_function_privilege('authenticated', oid, 'EXECUTE')) FROM f WHERE proname = 'add_balones'
  UNION ALL
  SELECT '06 grant_cosmetic ejecutable por authenticated',
         bool_or(has_function_privilege('authenticated', oid, 'EXECUTE')) FROM f WHERE proname = 'grant_cosmetic'
  UNION ALL
  SELECT '06 grant_powerup ejecutable por authenticated',
         bool_or(has_function_privilege('authenticated', oid, 'EXECUTE')) FROM f WHERE proname = 'grant_powerup'
  UNION ALL
  SELECT '06 activate_subscription ejecutable por authenticated/anon',
         bool_or(has_function_privilege('authenticated', oid, 'EXECUTE') OR has_function_privilege('anon', oid, 'EXECUTE'))
    FROM f WHERE proname = 'activate_subscription'
  UNION ALL
  SELECT '01 purge_user_data ejecutable por authenticated (sin chequeo de dueño)',
         bool_or(has_function_privilege('authenticated', oid, 'EXECUTE')
                 AND pg_get_functiondef(oid) NOT ILIKE '%auth.uid()%') FROM f WHERE proname = 'purge_user_data'
  UNION ALL
  SELECT '02 política "Insert xp for self" en xp_events',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='xp_events' AND policyname='Insert xp for self')
  UNION ALL
  SELECT '03 política "Insert own achievement" en user_achievements',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_achievements' AND policyname='Insert own achievement')
  UNION ALL
  SELECT '03 política "Delete own achievement" (borrar y re-desbloquear = XP infinita)',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_achievements' AND policyname='Delete own achievement')
  UNION ALL
  SELECT '07 política "Delete own sessions" en game_sessions',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_sessions' AND policyname='Delete own sessions')
  UNION ALL
  SELECT '07 política "Update own sessions" sin restricción de ended_at',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_sessions' AND policyname='Update own sessions'
                 AND coalesce(qual,'') NOT ILIKE '%ended_at%')
  UNION ALL
  SELECT '11 "Update own profile" sin protección de la columna role (escalada a admin)',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='Update own profile')
         AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.user_profiles'::regclass AND tgname = 'user_profiles_protect_columns')
  UNION ALL
  SELECT '04 report_game_result sin tabla de idempotencia',
         to_regclass('public.game_result_reports') IS NULL
  UNION ALL
  SELECT '09 webhook sin tabla de idempotencia',
         to_regclass('public.payment_webhook_events') IS NULL
) t;

-- 7) (Opcional) ¿Alguien ya se aprovechó? Top usuarios por XP de motivos
--    sospechosos en los últimos 30 días. Revisar a mano, no borrar nada sin mirar.
SELECT user_id, reason, count(*) AS eventos, sum(amount) AS xp_total, max(amount) AS max_evento
FROM public.xp_events
WHERE created_at > now() - interval '30 days'
GROUP BY user_id, reason
HAVING sum(amount) > 50000 OR max(amount) > 10000
ORDER BY xp_total DESC
LIMIT 50;

SELECT user_id, sum(delta) FILTER (WHERE delta > 0) AS fichas_ganadas, count(*) AS movimientos
FROM public.currency_ledger
WHERE currency = 'fichas' AND created_at > now() - interval '30 days'
GROUP BY user_id
ORDER BY fichas_ganadas DESC NULLS LAST
LIMIT 20;

SELECT id, role FROM public.user_profiles WHERE role = 'admin';
