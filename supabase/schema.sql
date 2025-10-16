    -- Goaldemy database schema
    -- Safe to run once on a fresh project. Contains tables, indexes, RLS, and RPCs.
    -- Created: 2025-10-13

    -- Extensions
    create extension if not exists pgcrypto;

    -- ============================
    return query
    with filtered as (

    -- Games catalog
    create table if not exists public.games (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    description text,
    cover_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
    );

    -- User profiles (one row per auth user)
    ),
    user_base as (
        -- include all users from auth
        select u.id as user_id from auth.users u
    )
    select
        ub.user_id,
        (p.username)::text as username,
        -- Force using email when available; no name fallback here
        (coalesce(u.email, p.email))::text as display_name,
        (p.avatar_url)::text as avatar_url,
        coalesce(t.xp_total, 0)::bigint as xp_total,
        dense_rank() over (order by coalesce(t.xp_total, 0) desc) as rank
    from user_base ub
    left join totals t on t.user_id = ub.user_id
    left join public.v_user_profiles p on p.user_id = ub.user_id
    left join auth.users u on u.id = ub.user_id
    order by coalesce(t.xp_total, 0) desc, ub.user_id
    reason text not null default 'correct_answer',
    session_id uuid,
    meta jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
    );

    -- Game sessions (optional per-run tracking)
    create table if not exists public.game_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    game_id uuid not null references public.games(id) on delete cascade,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    score_final int,
    xp_earned int not null default 0,
    metadata jsonb not null default '{}'::jsonb
    );

    -- Achievements catalog
    create table if not exists public.achievements (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    description text,
    icon_url text,
    points int not null default 0,
    created_at timestamptz not null default now()
    );

    -- User unlocked achievements
    create table if not exists public.user_achievements (
    user_id uuid not null references auth.users(id) on delete cascade,
    achievement_id uuid not null references public.achievements(id) on delete cascade,
    earned_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    primary key (user_id, achievement_id)
    );

    -- Level thresholds (football-themed levels)
    create table if not exists public.level_thresholds (
    level int primary key,
    xp_required int not null check (xp_required >= 0)
    );

    -- ============================
    -- Indexes
    -- ============================

    create index if not exists idx_xp_events_user_created_at on public.xp_events (user_id, created_at desc);
    create index if not exists idx_xp_events_game_created_at on public.xp_events (game_id, created_at desc);
    create index if not exists idx_xp_events_session on public.xp_events (session_id);

    create index if not exists idx_sessions_user_started_at on public.game_sessions (user_id, started_at desc);
    create index if not exists idx_sessions_game_started_at on public.game_sessions (game_id, started_at desc);

    -- ============================
    -- Triggers
    -- ============================

        -- Update updated_at on profile changes (only if column exists)
        create or replace function public.tg_set_timestamp() returns trigger as $$
        begin
        new.updated_at = now();
        return new;
        end
        $$ language plpgsql;

        do $$
        declare has_col boolean;
        begin
            select exists(
                select 1 from information_schema.columns
                where table_schema='public' and table_name='user_profiles' and column_name='updated_at'
            ) into has_col;

            if has_col then
                if not exists (
                    select 1 from pg_trigger where tgname = 'set_timestamp_user_profiles'
                ) then
                    create trigger set_timestamp_user_profiles
                    before update on public.user_profiles
                    for each row execute function public.tg_set_timestamp();
                end if;
            else
                -- Drop trigger if it exists but column does not
                if exists (
                    select 1 from pg_trigger where tgname = 'set_timestamp_user_profiles'
                ) then
                    drop trigger set_timestamp_user_profiles on public.user_profiles;
                end if;
            end if;
        end $$;

    -- ============================
    -- Seed data (idempotent)
    -- ============================

    insert into public.level_thresholds(level, xp_required) values
    (1, 0),
    (2, 100),
    (3, 250),
    (4, 450),
    (5, 700),
    (6, 1000),
    (7, 1350),
    (8, 1750),
    (9, 2200),
    (10, 2700)
    on conflict (level) do nothing;

    -- ============================
    -- Compatibility Views
    -- ============================

    -- Create a view that always exposes user_id, username, display_name, avatar_url
    do $$
    declare
    v_id_col text;
    has_username boolean;
    has_display_name boolean;
    has_avatar_url boolean;
    has_email boolean;
    v_sql text;
    begin
    select column_name into v_id_col
    from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name in ('user_id','id')
    order by case when column_name = 'user_id' then 0 else 1 end
    limit 1;

    if v_id_col is null then
        -- If the table doesn't exist or has neither column, create an empty-compatible view
        execute 'create or replace view public.v_user_profiles as select null::uuid as user_id, null::text as username, null::text as display_name, null::text as email, null::text as avatar_url where false';
    else
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='username') into has_username;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='display_name') into has_display_name;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='avatar_url') into has_avatar_url;
    -- optional email column support
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='email') into has_email;

        v_sql := 'create or replace view public.v_user_profiles as select '
        || quote_ident(v_id_col) || ' as user_id, '
        || case when has_username then 'username' else 'NULL::text' end || ' as username, '
        || case when has_display_name then 'display_name' else 'NULL::text' end || ' as display_name, '
        || case when has_email then 'email' else 'NULL::text' end || ' as email, '
        || case when has_avatar_url then 'avatar_url' else 'NULL::text' end || ' as avatar_url '
        || 'from public.user_profiles';

    execute v_sql;
    end if;
    end $$;

    -- ============================
    -- Row Level Security & Policies
    -- ============================

    -- Games: everyone can read
    alter table public.games enable row level security;
    do $$ begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'games' and policyname = 'Games are readable by all'
    ) then
        create policy "Games are readable by all" on public.games
        for select using (true);
    end if;
    end $$;

    -- Achievements: everyone can read
    alter table public.achievements enable row level security;
    do $$ begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'achievements' and policyname = 'Achievements are readable by all'
    ) then
        create policy "Achievements are readable by all" on public.achievements
        for select using (true);
    end if;
    end $$;

    -- Level thresholds: everyone can read
    alter table public.level_thresholds enable row level security;
    do $$ begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'level_thresholds' and policyname = 'Levels are readable by all'
    ) then
        create policy "Levels are readable by all" on public.level_thresholds
        for select using (true);
    end if;
    end $$;

    -- Profiles
    alter table public.user_profiles enable row level security;
    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Profiles readable (auth)'
    ) then
        create policy "Profiles readable (auth)" on public.user_profiles
        for select to authenticated using (true);
    end if;
    end $$;

    -- Create owner-scoped policies using either user_id or id, whichever exists
    do $$
    declare
    v_col text;
    begin
    select column_name into v_col
    from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name in ('user_id','id')
    order by case when column_name = 'user_id' then 0 else 1 end
    limit 1;

    if v_col is null then
        raise notice 'Skipping owner policies for public.user_profiles: no user id column (user_id or id) found.';
    else
        if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Insert own profile'
        ) then
        execute format('create policy "Insert own profile" on public.user_profiles for insert to authenticated with check (%I = auth.uid())', v_col);
        end if;

        if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Update own profile'
        ) then
        execute format('create policy "Update own profile" on public.user_profiles for update to authenticated using (%I = auth.uid())', v_col);
        end if;

        if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Delete own profile'
        ) then
        execute format('create policy "Delete own profile" on public.user_profiles for delete to authenticated using (%I = auth.uid())', v_col);
        end if;
    end if;
    end $$;

    -- XP events
    alter table public.xp_events enable row level security;
    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'xp_events' and policyname = 'Read own xp events'
    ) then
        create policy "Read own xp events" on public.xp_events
        for select to authenticated using (user_id = auth.uid());
    end if;
    end $$;

    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'xp_events' and policyname = 'Insert xp for self'
    ) then
        create policy "Insert xp for self" on public.xp_events
        for insert to authenticated with check (user_id = auth.uid());
    end if;
    end $$;

    -- Game sessions
    alter table public.game_sessions enable row level security;
    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'game_sessions' and policyname = 'Read own sessions'
    ) then
        create policy "Read own sessions" on public.game_sessions
        for select to authenticated using (user_id = auth.uid());
    end if;
    end $$;

    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'game_sessions' and policyname = 'Insert own sessions'
    ) then
        create policy "Insert own sessions" on public.game_sessions
        for insert to authenticated with check (user_id = auth.uid());
    end if;
    end $$;

    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'game_sessions' and policyname = 'Update own sessions'
    ) then
        create policy "Update own sessions" on public.game_sessions
        for update to authenticated using (user_id = auth.uid());
    end if;
    end $$;

    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'game_sessions' and policyname = 'Delete own sessions'
    ) then
        create policy "Delete own sessions" on public.game_sessions
        for delete to authenticated using (user_id = auth.uid());
    end if;
    end $$;

    -- User achievements
    alter table public.user_achievements enable row level security;
    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'user_achievements' and policyname = 'Read user achievements (auth)'
    ) then
        create policy "Read user achievements (auth)" on public.user_achievements
        for select to authenticated using (true);
    end if;
    end $$;

    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'user_achievements' and policyname = 'Insert own achievement'
    ) then
        create policy "Insert own achievement" on public.user_achievements
        for insert to authenticated with check (user_id = auth.uid());
    end if;
    end $$;

    do $$ begin
    if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'user_achievements' and policyname = 'Delete own achievement'
    ) then
        create policy "Delete own achievement" on public.user_achievements
        for delete to authenticated using (user_id = auth.uid());
    end if;
    end $$;

    -- ============================
    -- Functions (RPC)
    -- ============================

    -- Award XP to current user (SECURITY DEFINER bypasses RLS for insert)
    create or replace function public.award_xp(
    p_amount int,
    p_reason text default 'correct_answer',
    p_game_id uuid default null,
    p_session_id uuid default null,
    p_meta jsonb default '{}'::jsonb
    ) returns public.xp_events
    language plpgsql
    security definer
    set search_path = public
    as $$
    declare
    v_user_id uuid := auth.uid();
    v_event public.xp_events;
    begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if p_amount is null or p_amount < 0 then
        raise exception 'Invalid XP amount';
    end if;

    insert into public.xp_events(user_id, game_id, amount, reason, session_id, meta)
    values (v_user_id, p_game_id, p_amount, p_reason, p_session_id, coalesce(p_meta, '{}'::jsonb))
    returning * into v_event;

    return v_event;
    end$$;

    grant execute on function public.award_xp(int, text, uuid, uuid, jsonb) to authenticated;

    -- Total XP helper
    create or replace function public.get_user_total_xp(
    p_user_id uuid default auth.uid()
    ) returns bigint
    language sql
    stable
    set search_path = public
    as $$
    select coalesce(sum(amount), 0)::bigint
    from public.xp_events
    where user_id = coalesce(p_user_id, auth.uid());
    $$;

    grant execute on function public.get_user_total_xp(uuid) to authenticated;

    -- Compute current level and next target based on thresholds
    create or replace function public.get_user_level(
    p_user_id uuid default auth.uid()
    ) returns table (
    level int,
    xp_total bigint,
    next_level int,
    next_level_xp int,
    xp_to_next int
    )
    language plpgsql
    stable
    security definer
    set search_path = public
    as $$
    declare
    v_xp bigint := 0;
    v_level int := 1;
    v_next int;
    v_next_xp int;
    begin
    if coalesce(p_user_id, auth.uid()) is null then
        raise exception 'Not authenticated';
    end if;

    select coalesce(sum(amount),0)::bigint into v_xp
    from public.xp_events
    where user_id = coalesce(p_user_id, auth.uid());

    select lt.level into v_level
    from public.level_thresholds lt
    where lt.xp_required <= v_xp
    order by lt.level desc
    limit 1;

    select lt.level, lt.xp_required into v_next, v_next_xp
    from public.level_thresholds lt
    where lt.level > coalesce(v_level, 1)
    order by lt.level asc
    limit 1;

    return query select
        coalesce(v_level, 1) as level,
        v_xp as xp_total,
        v_next as next_level,
        v_next_xp as next_level_xp,
        case when v_next_xp is null then 0 else greatest(v_next_xp - v_xp, 0) end::int as xp_to_next;
    end$$;

    grant execute on function public.get_user_level(uuid) to authenticated;

    -- Leaderboard (overall / weekly / monthly), optional filtered by game
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
    rank bigint
    )
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
    return query
    with filtered as (
        select e.user_id, e.amount, e.created_at
        from public.xp_events e
        where (p_game_id is null or e.game_id = p_game_id)
        and case
            when lower(p_period) in ('weekly','week') then e.created_at >= date_trunc('week', now())
            when lower(p_period) in ('monthly','month') then e.created_at >= date_trunc('month', now())
            else true
        end
    ),
    totals as (
        -- Qualify all column references to avoid ambiguity with OUT params
        select f.user_id, sum(f.amount)::bigint as xp_total
        from filtered f
        group by f.user_id
    ),
    ranked as (
        select t.user_id, t.xp_total, dense_rank() over (order by t.xp_total desc) as rnk
        from totals t
    )
    select
        ub.user_id,
        (p.username)::text as username,
        (coalesce(u.email, p.email))::text as email,
        -- For compatibility, keep display_name equal to email so the UI still works
        (coalesce(u.email, p.email))::text as display_name,
        (p.avatar_url)::text as avatar_url,
        coalesce(t.xp_total, 0)::bigint as xp_total,
        dense_rank() over (order by coalesce(t.xp_total, 0) desc) as rank
    from ranked r
    left join public.v_user_profiles p on p.user_id = r.user_id
    left join auth.users u on u.id = r.user_id
    order by r.xp_total desc, r.user_id
    limit p_limit offset p_offset;
    end$$;

    grant execute on function public.get_leaderboard(text, uuid, int, int) to authenticated;

    -- ============================
    -- Notes:
    -- - All write operations require an authenticated user (auth.uid()).
    -- - award_xp() is the recommended way to add XP from the client.
    -- - get_leaderboard() aggregates without exposing raw xp_events due to SECURITY DEFINER.
    -- ============================
