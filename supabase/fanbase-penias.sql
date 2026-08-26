-- ════════════════════════════════════════════════════════════
--  PEÑAS POR EQUIPO — mini-comunidades por hinchada
-- ════════════════════════════════════════════════════════════
--  No inventa un sistema de clanes desde cero: agrupa a los usuarios por
--  user_profiles.favorite_team (dato que ya se pide al registrarse) y arma
--  un ranking de "qué hinchada suma más XP" + el ranking interno de cada una.
--  Misma semántica de período que get_leaderboard() (ver patch-fix-profiles.sql):
--  'weekly' = date_trunc('week', now()), 'monthly' = date_trunc('month', now()),
--  cualquier otro valor = histórico completo.
--
--  Correr en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════

-- Ranking de peñas: qué hinchada suma más XP en el período.
CREATE OR REPLACE FUNCTION public.get_fanbase_leaderboard(p_period TEXT DEFAULT 'weekly')
RETURNS TABLE (team TEXT, member_count BIGINT, active_count BIGINT, total_xp BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_xp AS (
    SELECT e.user_id, sum(e.amount)::bigint AS xp
    FROM public.xp_events e
    WHERE CASE
      WHEN lower(p_period) IN ('weekly','week') THEN e.created_at >= date_trunc('week', now())
      WHEN lower(p_period) IN ('monthly','month') THEN e.created_at >= date_trunc('month', now())
      ELSE true
    END
    GROUP BY e.user_id
  )
  SELECT
    p.favorite_team AS team,
    count(*)::bigint AS member_count,
    count(px.user_id)::bigint AS active_count,
    coalesce(sum(px.xp), 0)::bigint AS total_xp
  FROM public.user_profiles p
  LEFT JOIN period_xp px ON px.user_id = p.id
  WHERE p.favorite_team IS NOT NULL AND btrim(p.favorite_team) <> ''
  GROUP BY p.favorite_team
  ORDER BY total_xp DESC, member_count DESC, team ASC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.get_fanbase_leaderboard(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fanbase_leaderboard(TEXT) TO authenticated;

-- Ranking interno de una peña puntual (para la pestaña "Peña" de /team/:teamId).
CREATE OR REPLACE FUNCTION public.get_fanbase_members(p_team TEXT, p_period TEXT DEFAULT 'weekly')
RETURNS TABLE (user_id UUID, display_name TEXT, avatar_url TEXT, xp BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_xp AS (
    SELECT e.user_id, sum(e.amount)::bigint AS xp
    FROM public.xp_events e
    WHERE CASE
      WHEN lower(p_period) IN ('weekly','week') THEN e.created_at >= date_trunc('week', now())
      WHEN lower(p_period) IN ('monthly','month') THEN e.created_at >= date_trunc('month', now())
      ELSE true
    END
    GROUP BY e.user_id
  )
  SELECT p.id, p.display_name, p.avatar_url, coalesce(px.xp, 0)::bigint AS xp
  FROM public.user_profiles p
  LEFT JOIN period_xp px ON px.user_id = p.id
  WHERE p.favorite_team = p_team
  ORDER BY xp DESC, p.display_name ASC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_fanbase_members(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fanbase_members(TEXT, TEXT) TO authenticated;
