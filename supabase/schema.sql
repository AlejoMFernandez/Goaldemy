    -- Goaldemy database schema
    -- Safe to run once on a fresh project. Contains tables, indexes, RLS, and RPCs.
    -- Created: 2025-10-13

    -- Extensions
    create extension if not exists pgcrypto;

        -- Games catalog
        create table if not exists public.games (
            id uuid primary key default gen_random_uuid(),
            -- Note: on existing databases this column may be missing; a compat block below will add it if needed
            slug text not null unique,
            name text not null,
            description text,
            cover_url text,
            is_active boolean not null default true,
            created_at timestamptz not null default now()
        );

        -- Compatibility: ensure `slug` column exists and enforce uniqueness with a constraint (required for ON CONFLICT)
        do $$
        declare has_slug boolean;
        declare has_constraint boolean;
        begin
            select exists(
                select 1 from information_schema.columns
                where table_schema='public' and table_name='games' and column_name='slug'
            ) into has_slug;

            if not has_slug then
                alter table public.games add column slug text;
            end if;

            -- Drop legacy partial unique index if present; ON CONFLICT cannot target partial indexes reliably
            if exists (
                select 1 from pg_indexes where schemaname='public' and indexname='games_slug_unique_idx'
            ) then
                execute 'drop index if exists public.games_slug_unique_idx';
            end if;

            -- Create a proper unique constraint on slug (allows multiple NULLs, fine for legacy rows)
            select exists(
                select 1 from pg_constraint
                where conrelid = 'public.games'::regclass and conname = 'games_slug_unique'
            ) into has_constraint;

            if not has_constraint then
                alter table public.games add constraint games_slug_unique unique (slug);
            end if;
        end $$;

        -- Compatibility: add cover_url column if it doesn't exist (used by seeds and UI)
        do $$
        declare has_cover boolean;
        begin
            select exists(
                select 1 from information_schema.columns
                where table_schema='public' and table_name='games' and column_name='cover_url'
            ) into has_cover;

            if not has_cover then
                alter table public.games add column cover_url text;
            end if;
        end $$;
        -- XP events (awarded points per action)
        create table if not exists public.xp_events (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users(id) on delete cascade,
            game_id uuid references public.games(id) on delete set null,
            amount int not null check (amount >= 0),
            reason text not null default 'correct_answer',
            session_id uuid,
            meta jsonb not null default '{}'::jsonb,
            created_at timestamptz not null default now()
        );

        -- Global chat table (for GlobalChat.vue)
        create table if not exists public.global_chat_messages (
            id uuid primary key default gen_random_uuid(),
            sender_id uuid not null references auth.users(id) on delete cascade,
            email text,
            content text not null check (length(content) > 0),
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

    create index if not exists idx_chat_created_at on public.global_chat_messages (created_at desc);
    create index if not exists idx_chat_sender on public.global_chat_messages (sender_id, created_at desc);

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

                -- Seed games for existing demos (idempotent). If slug column exists, use upsert by slug.
                do $$
                declare has_slug boolean;
                begin
                    select exists(
                        select 1 from information_schema.columns
                        where table_schema='public' and table_name='games' and column_name='slug'
                    ) into has_slug;

                    if has_slug then
                        insert into public.games (slug, name, description, cover_url)
                        values
                            ('guess-player', 'Adivina el jugador', 'Adivina el nombre del jugador a partir de su foto', null),
                            ('nationality', 'Nacionalidad correcta', 'Selecciona la nacionalidad del jugador', null),
                            ('player-position', 'Posición del jugador', 'Elegí la posición correcta del jugador mostrado', null)
                        on conflict (slug) do nothing;
                    else
                        -- If slug still doesn't exist for some reason, skip seeding to avoid errors
                        null;
                    end if;
                end $$;

                -- Backfill xp_events.game_id from meta->>'game' if missing (only if games.slug exists)
                do $$
                declare has_slug boolean;
                begin
                    select exists(
                        select 1 from information_schema.columns
                        where table_schema='public' and table_name='games' and column_name='slug'
                    ) into has_slug;

                    if has_slug then
                        update public.xp_events e
                        set game_id = g.id
                        from public.games g
                        where e.game_id is null
                            and (e.meta ->> 'game') = g.slug;
                    end if;
                exception when others then
                    -- ignore backfill failures in idempotent setup
                    null;
                end $$;

    -- ============================
    -- Compatibility Views
    -- ============================

    -- Create a view that always exposes user_id, username, display_name, email, avatar_url and optional fields
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
        -- If the table doesn't exist or has neither column, create an empty-compatible view
        execute 'create or replace view public.v_user_profiles as select null::uuid as user_id, null::text as username, null::text as display_name, null::text as email, null::text as avatar_url where false';
    else
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='username') into has_username;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='display_name') into has_display_name;
<<<<<<< HEAD
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='avatar_url') into has_avatar_url;
    -- optional email column support
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='email') into has_email;

        v_sql := 'create or replace view public.v_user_profiles as select '
=======
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='avatar_url') into has_avatar_url;
    -- optional email column support
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='email') into has_email;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='nationality_code') into has_nationality;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='favorite_team') into has_fav_team;
        select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='favorite_player') into has_fav_player;

    v_sql := 'create or replace view public.v_user_profiles as select '
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
        || quote_ident(v_id_col) || ' as user_id, '
        || case when has_username then 'username' else 'NULL::text' end || ' as username, '
        || case when has_display_name then 'display_name' else 'NULL::text' end || ' as display_name, '
        || case when has_email then 'email' else 'NULL::text' end || ' as email, '
<<<<<<< HEAD
        || case when has_avatar_url then 'avatar_url' else 'NULL::text' end || ' as avatar_url '
        || 'from public.user_profiles';
=======
    || case when has_avatar_url then 'avatar_url' else 'NULL::text' end || ' as avatar_url, '
    || case when has_nationality then 'nationality_code' else 'NULL::text' end || ' as nationality_code, '
    || case when has_fav_team then 'favorite_team' else 'NULL::text' end || ' as favorite_team, '
    || case when has_fav_player then 'favorite_player' else 'NULL::text' end || ' as favorite_player '
    || 'from public.user_profiles';
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)

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

<<<<<<< HEAD
    -- Profiles
=======
        -- Profiles: ensure optional columns exist (idempotent)
        do $$
        begin
            if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_profiles') then
                begin
                        alter table public.user_profiles add column if not exists avatar_url text;
                    alter table public.user_profiles add column if not exists nationality_code text;
                    alter table public.user_profiles add column if not exists favorite_team text;
                    alter table public.user_profiles add column if not exists favorite_player text;
                    alter table public.user_profiles add column if not exists is_public boolean not null default true;
                exception when others then null; end;
            end if;
        end $$;

        -- Profiles
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
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
<<<<<<< HEAD
        if not exists (
=======
    if not exists (
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
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

<<<<<<< HEAD
=======
        -- Public read policy (optional): allow anonymous to read profiles marked as public
        do $$ begin
            if not exists (
                select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='Profiles readable (public)'
            ) then
                create policy "Profiles readable (public)" on public.user_profiles
                for select to anon using (coalesce(is_public, true));
            end if;
        end $$;

>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
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

        -- Global chat RLS
        alter table public.global_chat_messages enable row level security;
        do $$ begin
            if not exists (
                select 1 from pg_policies where schemaname = 'public' and tablename = 'global_chat_messages' and policyname = 'Chat readable (auth)'
            ) then
                create policy "Chat readable (auth)" on public.global_chat_messages
                for select to authenticated using (true);
            end if;
        end $$;
        do $$ begin
            if not exists (
                select 1 from pg_policies where schemaname = 'public' and tablename = 'global_chat_messages' and policyname = 'Send own chat message'
            ) then
                create policy "Send own chat message" on public.global_chat_messages
                for insert to authenticated with check (sender_id = auth.uid());
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

        -- Aggregate XP by game for a user (defaults to current user if null)
        create or replace function public.get_user_xp_by_game(
            p_user_id uuid default null
        ) returns table (
            game_id uuid,
            name text,
            cover_url text,
            xp bigint
        )
        language sql
        security definer
        set search_path = public
        as $$
            select e.game_id,
                         g.name,
                         g.cover_url,
                         sum(e.amount)::bigint as xp
            from public.xp_events e
            left join public.games g on g.id = e.game_id
            where e.user_id = coalesce(p_user_id, auth.uid())
            group by e.game_id, g.name, g.cover_url
            order by xp desc nulls last
        $$;

        grant execute on function public.get_user_xp_by_game(uuid) to authenticated;

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
            )
            select
                t.user_id,
                (p.username)::text as username,
                (coalesce(u.email, p.email))::text as email,
                (coalesce(u.email, p.email))::text as display_name,
                (p.avatar_url)::text as avatar_url,
                t.xp_total,
                dense_rank() over (order by t.xp_total desc) as rank
            from totals t
            left join public.v_user_profiles p on p.user_id = t.user_id
            left join auth.users u on u.id = t.user_id
            order by t.xp_total desc, t.user_id
            limit p_limit offset p_offset;
        end$$;

    grant execute on function public.get_leaderboard(text, uuid, int, int) to authenticated;

    -- ============================
    -- Notes:
    -- - All write operations require an authenticated user (auth.uid()).
    -- - award_xp() is the recommended way to add XP from the client.
    -- - get_leaderboard() aggregates without exposing raw xp_events due to SECURITY DEFINER.
    -- ============================
