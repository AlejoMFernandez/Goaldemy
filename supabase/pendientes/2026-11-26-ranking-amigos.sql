-- ============================================================
-- QUÉ:      RPC get_friends_leaderboard(p_period, p_game_id): el ranking
--           (mismo criterio que get_leaderboard: suma de xp_events del
--           período) pero solo de VOS + tus amigos (connections aceptadas).
-- POR QUÉ:  Social v4 muestra "Entre amigos · esta semana" y el filtro
--           "Amigos" del ranking. Sin esta RPC el front filtra el top 500
--           global (src/services/social-hub.js → loadFriendsLeaderboard), así
--           que un amigo con poca XP puede no aparecer. Con la RPC aparecen
--           todos (incluidos los que tienen 0 XP en el período).
-- SEGURIDAD: SECURITY DEFINER, solo devuelve filas del usuario logueado y
--           sus amigos aceptados. No expone emails (display_name del perfil).
-- ROLLBACK:  DROP FUNCTION IF EXISTS public.get_friends_leaderboard(text, uuid);
-- Idempotente: se puede correr más de una vez. NO APLICAR sin OK de Alejo.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard(
  p_period  text DEFAULT 'weekly',
  p_game_id uuid DEFAULT NULL
) RETURNS TABLE (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  xp_total     bigint,
  user_level   int,
  rank         bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH people AS (
    SELECT uid AS id
    UNION
    SELECT CASE WHEN c.user_a = uid THEN c.user_b ELSE c.user_a END
    FROM public.connections c
    WHERE c.status = 'accepted' AND (c.user_a = uid OR c.user_b = uid)
  ),
  gfilter AS (
    SELECT g.id, g.slug FROM public.games g WHERE g.id = p_game_id
  ),
  period_xp AS (
    SELECT e.user_id, SUM(e.amount)::bigint AS xp
    FROM public.xp_events e
    LEFT JOIN gfilter gf ON true
    WHERE e.user_id IN (SELECT id FROM people)
      AND (
        p_game_id IS NULL
        OR e.game_id = p_game_id
        OR (e.game_id IS NULL AND gf.slug IS NOT NULL AND (e.meta->>'game') = gf.slug)
      )
      AND (
        CASE
          WHEN lower(p_period) IN ('weekly','week')   THEN e.created_at >= date_trunc('week', now())
          WHEN lower(p_period) IN ('monthly','month') THEN e.created_at >= date_trunc('month', now())
          ELSE true
        END
      )
    GROUP BY e.user_id
  ),
  global_xp AS (
    SELECT e.user_id, SUM(e.amount)::bigint AS xp
    FROM public.xp_events e
    WHERE e.user_id IN (SELECT id FROM people)
    GROUP BY e.user_id
  )
  SELECT
    p.id,
    up.display_name::text,
    up.avatar_url::text,
    COALESCE(px.xp, 0)::bigint,
    (
      SELECT lt.level FROM public.level_thresholds lt
      WHERE lt.xp_required <= COALESCE(gx.xp, 0)
      ORDER BY lt.level DESC LIMIT 1
    )::int,
    dense_rank() OVER (ORDER BY COALESCE(px.xp, 0) DESC)
  FROM people p
  LEFT JOIN public.user_profiles up ON up.id = p.id
  LEFT JOIN period_xp px ON px.user_id = p.id
  LEFT JOIN global_xp gx ON gx.user_id = p.id
  ORDER BY COALESCE(px.xp, 0) DESC, p.id
  LIMIT 200;
END$$;

REVOKE ALL ON FUNCTION public.get_friends_leaderboard(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friends_leaderboard(text, uuid) TO authenticated;

COMMIT;

-- Verificación: existe, la ejecuta authenticated y no anon.
SELECT has_function_privilege('authenticated', 'public.get_friends_leaderboard(text, uuid)'::regprocedure, 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.get_friends_leaderboard(text, uuid)'::regprocedure, 'EXECUTE') AS ok;
