-- ============================================================
-- MEJORAS16 — Reportes de bug: borrado, capturas adjuntas y
-- 2 métricas nuevas para el dashboard admin (pendientes de revisar).
-- Correr en cualquier momento. Idempotente.
-- ============================================================

-- ── 1) Columna para la captura adjunta (guardamos el path del bucket,
--       no la URL pública — el bucket es privado, se sirve con signed URL) ──
alter table public.bug_reports add column if not exists image_path text;

-- ── 2) Borrado de reportes: solo admin ──
drop policy if exists "bug_reports admin delete" on public.bug_reports;
create policy "bug_reports admin delete"
  on public.bug_reports for delete to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── 3) Bucket privado para las capturas ──
insert into storage.buckets (id, name, public)
values ('bug-report-images', 'bug-report-images', false)
on conflict (id) do nothing;

-- Cualquier autenticado sube dentro de su propia carpeta: <uid>/archivo.jpg
drop policy if exists "bug report images insert own" on storage.objects;
create policy "bug report images insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'bug-report-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Lectura: el dueño de la captura o un admin (para verla en el panel).
drop policy if exists "bug report images read own or admin" on storage.objects;
create policy "bug report images read own or admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bug-report-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- Borrado de la captura: solo admin (al borrar el ticket).
drop policy if exists "bug report images delete admin" on storage.objects;
create policy "bug report images delete admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bug-report-images'
    and exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── 4) Dashboard: sumar "reportes abiertos" y "fantasmas detectados"
--       (mismo criterio que purge_ghost_users, ver supabase/ghost-users.sql)
--       a get_admin_dashboard(). Reemplaza la función completa: el resto
--       de las métricas queda igual, solo se agregan 2 campos al final. ──
CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_today DATE := public.app_today();
  v_tz    TEXT := 'America/Argentina/Buenos_Aires';
  result  JSON;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
    INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT json_build_object(
    -- ── Totales ──────────────────────────────────────────────
    'total_users', (SELECT count(*) FROM public.user_profiles),
    'new_users_24h', (SELECT count(*) FROM public.user_profiles WHERE created_at >= now() - interval '24 hours'),
    'new_users_7d',  (SELECT count(*) FROM public.user_profiles WHERE created_at >= now() - interval '7 days'),

    -- ── Ingresos / suscripciones ─────────────────────────────
    'pro_active', (
      SELECT count(*) FROM public.subscriptions s
      WHERE s.plan_slug <> 'free' AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ),
    'mrr_ars', (
      SELECT COALESCE(SUM(p.price_ars), 0) / 100.0 FROM public.subscriptions s
      JOIN public.plans p ON p.slug = s.plan_slug
      WHERE s.status = 'active' AND s.plan_slug <> 'free'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ),
    'subs_past_due', (SELECT count(*) FROM public.subscriptions WHERE status = 'past_due'),
    'subs_cancelled_30d', (
      SELECT count(*) FROM public.subscriptions
      WHERE status = 'cancelled' AND updated_at >= now() - interval '30 days'
    ),
    'by_plan', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.c DESC), '[]'::json) FROM (
        SELECT s.plan_slug, count(*) AS c FROM public.subscriptions s
        WHERE s.status = 'active' AND s.plan_slug <> 'free'
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        GROUP BY s.plan_slug
      ) t
    ),
    'by_provider', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.c DESC), '[]'::json) FROM (
        SELECT COALESCE(s.provider, 'sin dato') AS provider, count(*) AS c FROM public.subscriptions s
        WHERE s.status = 'active' AND s.plan_slug <> 'free'
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        GROUP BY s.provider
      ) t
    ),

    -- ── Actividad ────────────────────────────────────────────
    'dau', (SELECT count(*) FROM public.user_profiles WHERE last_activity_date = v_today),
    'active_7d', (SELECT count(*) FROM public.user_profiles WHERE last_activity_date >= v_today - 6),
    'games_today', (
      SELECT count(*) FROM public.game_sessions
      WHERE (started_at AT TIME ZONE v_tz)::date = v_today
    ),
    'games_7d', (SELECT count(*) FROM public.game_sessions WHERE started_at >= now() - interval '7 days'),

    -- ── Altas por día (últimos 14 días, ART) ─────────────────
    'signups_daily', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.d), '[]'::json) FROM (
        SELECT gs::date AS d,
               (SELECT count(*) FROM public.user_profiles up
                 WHERE (up.created_at AT TIME ZONE v_tz)::date = gs::date) AS c
        FROM generate_series(v_today - 13, v_today, interval '1 day') gs
      ) t
    ),

    -- ── Top juegos (7d) ───────────────────────────────────────
    'top_games', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.c DESC), '[]'::json) FROM (
        SELECT g.name, count(*) AS c
        FROM public.game_sessions gs JOIN public.games g ON g.id = gs.game_id
        WHERE gs.started_at >= now() - interval '7 days'
        GROUP BY g.name ORDER BY c DESC LIMIT 6
      ) t
    ),

    -- ── Pendientes de revisar (accionable) ───────────────────
    'bug_reports_open', (
      SELECT count(*) FROM public.bug_reports WHERE status IN ('open', 'in_progress')
    ),
    'ghost_users', (
      SELECT count(*) FROM auth.users u
      WHERE u.email_confirmed_at IS NULL
        AND u.created_at < now() - interval '5 days'
        AND NOT EXISTS (SELECT 1 FROM public.xp_events x WHERE x.user_id = u.id)
    )
  ) INTO result;

  RETURN result;
END$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard() TO authenticated;
