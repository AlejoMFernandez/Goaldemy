| ?column?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CREATE TABLE public.achievements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    name text NOT NULL,
    description text,
    icon_url text,
    points integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE TABLE public.connections (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_a uuid NOT NULL,
    user_b uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE TABLE public.direct_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    content text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE TABLE public.game_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    game_id uuid NOT NULL,
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    ended_at timestamp with time zone,
    score_final integer,
    xp_earned integer NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);                                                                                                                                                                                                                                                                                                                                                             |
| CREATE TABLE public.games (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    description character varying NOT NULL,
    image character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    slug text,
    cover_url text
);                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE public.global_chat_messages (
    id bigint NOT NULL,
    email character varying NOT NULL,
    content character varying NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    sender_id uuid NOT NULL DEFAULT gen_random_uuid()
);                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE TABLE public.level_thresholds (
    level integer NOT NULL,
    xp_required integer NOT NULL
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE TABLE public.news (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title character varying NOT NULL,
    body character varying NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    sender_id uuid NOT NULL DEFAULT gen_random_uuid()
);                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    type text NOT NULL,
    to_user uuid NOT NULL,
    from_user uuid,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE TABLE public.user_achievements (
    user_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    earned_at timestamp with time zone NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE TABLE public.user_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email character varying NOT NULL,
    display_name character varying,
    bio character varying,
    career character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    nationality_code text,
    favorite_team text,
    favorite_player text,
    is_public boolean NOT NULL DEFAULT true,
    avatar_url text,
    linkedin_url text,
    github_url text,
    x_url text,
    instagram_url text,
    daily_streak integer DEFAULT 0,
    best_daily_streak integer DEFAULT 0,
    featured_achievements ARRAY DEFAULT ARRAY[]::text[],
    last_activity_date date,
    role text DEFAULT 'user'::text
); |
| CREATE TABLE public.xp_events (
    id bigint NOT NULL DEFAULT nextval('xp_events_id_seq'::regclass),
    user_id uuid NOT NULL,
    game_id uuid,
    amount integer NOT NULL,
    reason text NOT NULL DEFAULT 'correct_answer'::text,
    session_id uuid,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);              

| ?column?                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- |
| CREATE UNIQUE INDEX global_chat_messages_pkey ON public.global_chat_messages USING btree (id);                          |
| CREATE INDEX idx_chat_created_at ON public.global_chat_messages USING btree (created_at DESC);                          |
| CREATE INDEX idx_chat_sender ON public.global_chat_messages USING btree (sender_id, created_at DESC);                   |
| CREATE UNIQUE INDEX news_pkey ON public.news USING btree (id);                                                          |
| CREATE UNIQUE INDEX connections_pkey ON public.connections USING btree (id);                                            |
| CREATE INDEX idx_connections_pair ON public.connections USING btree (user_a, user_b);                                   |
| CREATE INDEX idx_connections_userb ON public.connections USING btree (user_b, status);                                  |
| CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);                                        |
| CREATE INDEX idx_notifications_to ON public.notifications USING btree (to_user, read, created_at DESC);                 |
| CREATE UNIQUE INDEX achievements_pkey ON public.achievements USING btree (id);                                          |
| CREATE UNIQUE INDEX achievements_code_key ON public.achievements USING btree (code);                                    |
| CREATE UNIQUE INDEX level_thresholds_pkey ON public.level_thresholds USING btree (level);                               |
| CREATE UNIQUE INDEX xp_events_pkey ON public.xp_events USING btree (id);                                                |
| CREATE INDEX idx_xp_events_user_created_at ON public.xp_events USING btree (user_id, created_at DESC);                  |
| CREATE INDEX idx_xp_events_game_created_at ON public.xp_events USING btree (game_id, created_at DESC);                  |
| CREATE INDEX idx_xp_events_session ON public.xp_events USING btree (session_id);                                        |
| CREATE UNIQUE INDEX games_pkey ON public.games USING btree (id);                                                        |
| CREATE UNIQUE INDEX games_slug_unique ON public.games USING btree (slug);                                               |
| CREATE UNIQUE INDEX game_sessions_pkey ON public.game_sessions USING btree (id);                                        |
| CREATE INDEX idx_sessions_user_started_at ON public.game_sessions USING btree (user_id, started_at DESC);               |
| CREATE INDEX idx_sessions_game_started_at ON public.game_sessions USING btree (game_id, started_at DESC);               |
| CREATE UNIQUE INDEX direct_messages_pkey ON public.direct_messages USING btree (id);                                    |
| CREATE INDEX idx_dm_participants_time ON public.direct_messages USING btree (recipient_id, sender_id, created_at DESC); |
| CREATE INDEX idx_dm_sender_time ON public.direct_messages USING btree (sender_id, created_at DESC);                     |
| CREATE UNIQUE INDEX user_achievements_pkey ON public.user_achievements USING btree (user_id, achievement_id);           |
| CREATE INDEX idx_user_profiles_daily_streak ON public.user_profiles USING btree (daily_streak);                         |
| CREATE INDEX idx_user_profiles_best_daily_streak ON public.user_profiles USING btree (best_daily_streak);               |
| CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (id);                                        |
| CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);                                         |
| CREATE INDEX idx_user_profiles_last_activity ON public.user_profiles USING btree (last_activity_date);

| ?column?                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALTER TABLE public.global_chat_messages ADD CONSTRAINT global_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON UPDATE CASCADE;       |
| ALTER TABLE public.news ADD CONSTRAINT news_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON UPDATE CASCADE;                                       |
| ALTER TABLE public.connections ADD CONSTRAINT connections_user_a_fkey FOREIGN KEY (user_a) REFERENCES auth.users(id) ON DELETE CASCADE;                               |
| ALTER TABLE public.connections ADD CONSTRAINT connections_user_b_fkey FOREIGN KEY (user_b) REFERENCES auth.users(id) ON DELETE CASCADE;                               |
| ALTER TABLE public.notifications ADD CONSTRAINT notifications_from_user_fkey FOREIGN KEY (from_user) REFERENCES auth.users(id) ON DELETE SET NULL;                    |
| ALTER TABLE public.notifications ADD CONSTRAINT notifications_to_user_fkey FOREIGN KEY (to_user) REFERENCES auth.users(id) ON DELETE CASCADE;                         |
| ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL;                                     |
| ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;                                 |
| ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;                              |
| ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;                         |
| ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;           |
| ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;                 |
| ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE; |
| ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;                 |
| ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;                 |                  |                                                                                                                                                                                                                                                                                                                                         |