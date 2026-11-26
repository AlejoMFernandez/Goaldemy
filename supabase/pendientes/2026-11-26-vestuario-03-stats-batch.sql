-- ⚠ 2026-11-26: ya está aplicado en producción (get_users_cosmetic_stats existe). Solo para bases nuevas.
-- ============================================================
-- PENDIENTE · NO APLICADO · 2026-11-26 (viene de feature/vestuario-nuevo, 28/09)
-- QUÉ: RPC get_users_cosmetic_stats(uuid[]) → nivel + racha diaria de hasta 200
--      usuarios en una llamada.
-- POR QUÉ: las chapitas de los bordes "Placa de nivel" y "Racha encendida" de OTROS
--      usuarios (ranking, Social, chat). Sin la función, getCosmeticStatsBatch()
--      devuelve {} y los bordes se ven sin chapita: no rompe nada.
-- RIESGO: SECURITY DEFINER legible por anon: expone nivel y racha, que ya son
--      públicos en el ranking y el perfil. No expone XP por evento.
-- IDEMPOTENTE: CREATE OR REPLACE.
-- ROLLBACK: DROP FUNCTION IF EXISTS public.get_users_cosmetic_stats(uuid[]);
-- ============================================================

BEGIN;

-- ============================================================
-- FULVO — VESTUARIO: nivel + racha de VARIOS usuarios en una sola llamada
-- Para las chapitas reales de los bordes "Placa de nivel" y "Racha encendida"
-- de otros usuarios (ranking, amigos, chat) sin una consulta por usuario.
--
-- El nivel sale de xp_events (privada por RLS), por eso SECURITY DEFINER; usa la misma
-- regla que user_level_of() pero por lotes. La racha ya es pública (user_profiles se
-- ve entera); el front la corta a 0 si el último día jugado no es hoy ni ayer.
-- Idempotente. Máx. 200 ids por llamada.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_cosmetic_stats(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, level integer, daily_streak integer, last_activity_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ids AS (
    SELECT DISTINCT u FROM unnest(p_user_ids[1:200]) AS u
  ),
  xp AS (
    SELECT i.u AS uid, COALESCE(SUM(e.amount), 0) AS total
    FROM ids i LEFT JOIN public.xp_events e ON e.user_id = i.u
    GROUP BY i.u
  )
  SELECT
    xp.uid,
    COALESCE(
      (SELECT lt.level FROM public.level_thresholds lt WHERE lt.xp_required <= xp.total ORDER BY lt.level DESC LIMIT 1),
      GREATEST(1, (xp.total / 300)::int + 1)
    )::int,
    up.daily_streak,
    up.last_activity_date
  FROM xp LEFT JOIN public.user_profiles up ON up.id = xp.uid;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_cosmetic_stats(uuid[]) TO anon, authenticated;

COMMIT;
