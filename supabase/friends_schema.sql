-- Friends and notifications schema additions (idempotent)
-- Run this in your Supabase SQL editor

-- Friend connections table (single-row per relationship)
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade, -- requester
  user_b uuid not null references auth.users(id) on delete cascade, -- target
  status text not null check (status in ('pending','accepted','blocked')) default 'pending',
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_connections_pair on public.connections (user_a, user_b);
create index if not exists idx_connections_userb on public.connections (user_b, status);

-- Notifications (generic)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  to_user uuid not null references auth.users(id) on delete cascade,
  from_user uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_to on public.notifications (to_user, read, created_at desc);

-- RLS
alter table public.connections enable row level security;
alter table public.notifications enable row level security;

-- connections policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='connections' and policyname='Read connections (own)'
  ) then
    create policy "Read connections (own)" on public.connections
      for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='connections' and policyname='Create pending (self)'
  ) then
    create policy "Create pending (self)" on public.connections
      for insert to authenticated with check (user_a = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='connections' and policyname='Accept when target'
  ) then
    create policy "Accept when target" on public.connections
      for update to authenticated using (user_b = auth.uid()) with check (user_b = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='connections' and policyname='Delete when participant'
  ) then
    create policy "Delete when participant" on public.connections
      for delete to authenticated using (user_a = auth.uid() or user_b = auth.uid());
  end if;
end $$;

-- notifications policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Read own notifications'
  ) THEN
    CREATE POLICY "Read own notifications" ON public.notifications
      FOR SELECT TO authenticated USING (to_user = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Insert to own/others'
  ) THEN
    CREATE POLICY "Insert to own/others" ON public.notifications
      FOR INSERT TO authenticated WITH CHECK (to_user = auth.uid() OR from_user = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Mark own read'
  ) THEN
    CREATE POLICY "Mark own read" ON public.notifications
      FOR UPDATE TO authenticated USING (to_user = auth.uid());
  END IF;
END $$;
