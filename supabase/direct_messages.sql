-- Direct messages (one-to-one chat)
-- Run this in Supabase SQL editor

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) > 0 and char_length(content) <= 4000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_dm_participants_time on public.direct_messages (recipient_id, sender_id, created_at desc);
create index if not exists idx_dm_sender_time on public.direct_messages (sender_id, created_at desc);

alter table public.direct_messages enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='direct_messages' and policyname='DM select own'
  ) then
    create policy "DM select own" on public.direct_messages
      for select to authenticated
      using (sender_id = auth.uid() or recipient_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='direct_messages' and policyname='DM insert self as sender'
  ) then
    create policy "DM insert self as sender" on public.direct_messages
      for insert to authenticated
      with check (sender_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='direct_messages' and policyname='DM update read by recipient'
  ) then
    create policy "DM update read by recipient" on public.direct_messages
      for update to authenticated
      using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
  end if;
end $$;
