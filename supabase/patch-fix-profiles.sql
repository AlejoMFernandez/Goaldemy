-- ============================================
-- GOALDEMY: Patch to fix user profiles & leaderboard
-- Run this in Supabase SQL Editor
-- ============================================

-- 1) Auto-create user_profiles row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end$$;

-- Drop existing trigger if any, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Backfill: create user_profiles for existing auth users that don't have one
insert into public.user_profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  )
from auth.users u
left join public.user_profiles p on p.id = u.id
where p.id is null;

-- 3) Fix get_leaderboard: use actual display_name from user_profiles
drop function if exists public.get_leaderboard(text, uuid, int, int);
create or replace function public.get_leaderboard(
    p_period text default 'all_time',
    p_game_id uuid default null,
    p_limit int default 50,
    p_offset int default 0
) returns table (
    user_id uuid,
    username text,
    email text,
    display_name text,
    avatar_url text,
    xp_total bigint,
    user_level int,
    rank bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with gfilter as (
        select id, slug from public.games where id = p_game_id
    ),
    filtered as (
        select e.user_id, e.amount, e.created_at
        from public.xp_events e
        left join gfilter gf on true
        where (
                p_game_id is null
                or e.game_id = p_game_id
                or (e.game_id is null and gf.slug is not null and (e.meta->>'game') = gf.slug)
            )
            and (
                case
                    when lower(p_period) in ('weekly','week') then e.created_at >= date_trunc('week', now())
                    when lower(p_period) in ('monthly','month') then e.created_at >= date_trunc('month', now())
                    else true
                end
            )
    ),
    totals as (
        select f.user_id, sum(f.amount)::bigint as xp_total
        from filtered f
        group by f.user_id
    ),
    all_time_totals as (
        select e.user_id, sum(e.amount)::bigint as xp_global
        from public.xp_events e
        group by e.user_id
    )
    select
        t.user_id,
        (p.username)::text as username,
        (coalesce(p.email, u.email))::text as email,
        (coalesce(p.display_name, p.username, split_part(coalesce(p.email, u.email), '@', 1)))::text as display_name,
        (p.avatar_url)::text as avatar_url,
        t.xp_total,
        (
          select lt.level from public.level_thresholds lt
          where lt.xp_required <= coalesce(a.xp_global, 0)
          order by lt.level desc
          limit 1
        )::int as user_level,
        dense_rank() over (order by t.xp_total desc) as rank
    from totals t
    left join public.v_user_profiles p on p.user_id = t.user_id
    left join auth.users u on u.id = t.user_id
    left join all_time_totals a on a.user_id = t.user_id
    order by t.xp_total desc, t.user_id
    limit p_limit offset p_offset;
end$$;

grant execute on function public.get_leaderboard(text, uuid, int, int) to authenticated;

-- 4) Recreate v_user_profiles view cleanly (no merge conflicts)
do $$
declare
    v_id_col text;
    has_username boolean;
    has_display_name boolean;
    has_avatar_url boolean;
    has_email boolean;
    has_nationality boolean;
    has_fav_team boolean;
    has_fav_player boolean;
    v_sql text;
begin
    select column_name into v_id_col
    from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name in ('user_id','id')
    order by case when column_name = 'user_id' then 0 else 1 end
    limit 1;

    if v_id_col is null then
        execute 'create or replace view public.v_user_profiles as select null::uuid as user_id, null::text as username, null::text as display_name, null::text as email, null::text as avatar_url where false';
    else
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='username') into has_username;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='display_name') into has_display_name;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='avatar_url') into has_avatar_url;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='email') into has_email;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='nationality_code') into has_nationality;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='favorite_team') into has_fav_team;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='favorite_player') into has_fav_player;

        v_sql := 'create or replace view public.v_user_profiles as select '
            || quote_ident(v_id_col) || ' as user_id, '
            || case when has_username then 'username' else 'NULL::text' end || ' as username, '
            || case when has_display_name then 'display_name' else 'NULL::text' end || ' as display_name, '
            || case when has_email then 'email' else 'NULL::text' end || ' as email, '
            || case when has_avatar_url then 'avatar_url' else 'NULL::text' end || ' as avatar_url, '
            || case when has_nationality then 'nationality_code' else 'NULL::text' end || ' as nationality_code, '
            || case when has_fav_team then 'favorite_team' else 'NULL::text' end || ' as favorite_team, '
            || case when has_fav_player then 'favorite_player' else 'NULL::text' end || ' as favorite_player '
            || 'from public.user_profiles';

        execute v_sql;
    end if;
end $$;
