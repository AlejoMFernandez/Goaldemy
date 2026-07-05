-- MEJORAS10 — Reportes de bug desde la sidebar (botón "Reportar un bug").
-- Los usuarios logueados insertan; vos los ves en Supabase (o panel admin a futuro).

create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  message     text not null,
  contact     text,
  url         text,
  user_agent  text,
  status      text default 'open',   -- open | in_progress | done | wontfix
  created_at  timestamptz default now()
);

alter table public.bug_reports enable row level security;

-- Cualquier usuario autenticado puede crear un reporte.
drop policy if exists "bug_reports insert authenticated" on public.bug_reports;
create policy "bug_reports insert authenticated"
  on public.bug_reports for insert to authenticated with check (true);

-- Lectura y actualización: solo admins (user_profiles.role = 'admin').
-- Se ven en el Panel Admin → pestaña "Reportes".
drop policy if exists "bug_reports admin read" on public.bug_reports;
create policy "bug_reports admin read"
  on public.bug_reports for select to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "bug_reports admin update" on public.bug_reports;
create policy "bug_reports admin update"
  on public.bug_reports for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (true);
