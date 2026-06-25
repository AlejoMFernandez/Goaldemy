-- ============================================================
-- GOALDEMY — USUARIOS FANTASMA (limpieza + marcado en admin)
-- Las cuentas creadas con mail falso / sin confirmar ensucian los promedios
-- de logros (cuentan como usuarios) y solo se borraban a mano. Este script:
--   1) get_users_admin()        -> lista usuarios CON estado de confirmación
--   2) purge_ghost_users(days)  -> borra no-confirmados viejos y sin actividad
--   3) count_real_users()       -> total de usuarios confirmados (para % de logros)
-- Correr en el SQL Editor de Supabase. Idempotente. Depende de purge_user.sql.
-- ============================================================

-- ─── 1. Lista de usuarios para el panel admin (incluye confirmación) ──
CREATE OR REPLACE FUNCTION public.get_users_admin()
RETURNS TABLE (
  id uuid, email text, display_name text, avatar_url text, role text,
  created_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.display_name, p.avatar_url, p.role, p.created_at,
           u.email_confirmed_at, u.last_sign_in_at
    FROM public.user_profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END$$;

-- ─── 2. Núcleo de la purga (sin guard, reutilizable por cron) ──
-- Borra cuentas SIN confirmar, creadas hace más de p_days días y SIN XP
-- (sin actividad real). Borra datos de app + el usuario de auth.users.
CREATE OR REPLACE FUNCTION public._purge_ghost_users_core(p_days integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT u.id
    FROM auth.users u
    WHERE u.email_confirmed_at IS NULL
      AND u.created_at < now() - make_interval(days => GREATEST(0, p_days))
      AND NOT EXISTS (SELECT 1 FROM public.xp_events x WHERE x.user_id = u.id)
  LOOP
    PERFORM public.purge_user_data(r.id);
    DELETE FROM auth.users WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END$$;

-- ─── 3. Purga manual desde el panel admin (con guard) ───────
CREATE OR REPLACE FUNCTION public.purge_ghost_users(p_days integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN public._purge_ghost_users_core(p_days);
END$$;

-- ─── 4. Conteo de usuarios reales (confirmados) ─────────────
-- Usado por el front para calcular el % de logros SIN contar fantasmas.
CREATE OR REPLACE FUNCTION public.count_real_users()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COUNT(*)::integer FROM auth.users WHERE email_confirmed_at IS NOT NULL;
$$;

-- ─── 5. Grants ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_users_admin() FROM public;
REVOKE ALL ON FUNCTION public.purge_ghost_users(integer) FROM public;
REVOKE ALL ON FUNCTION public._purge_ghost_users_core(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_users_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_ghost_users(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_real_users() TO authenticated;

-- ─── 6. (OPCIONAL) Auto-purga diaria con pg_cron ────────────
-- Si tu proyecto tiene la extensión pg_cron habilitada (Database > Extensions),
-- descomentá esto para que se limpien solos todos los días a las 04:00 UTC:
--
-- SELECT cron.schedule(
--   'purge-ghost-users',
--   '0 4 * * *',
--   $$SELECT public._purge_ghost_users_core(5)$$
-- );
--
-- (El cron corre como superuser; por eso usa el _core sin guard de admin.)
