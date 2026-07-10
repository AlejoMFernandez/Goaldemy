-- ============================================================
-- GOALDEMY — MEJORAS13: BADGE DE PLAN EN EL PERFIL
--
-- RPC liviano de SOLO LECTURA para saber el plan (free/pro/legend)
-- de CUALQUIER usuario, y así mostrar una etiqueta PRO/Legend en su
-- perfil (propio o de otros). No usamos get_user_plan porque ese hace
-- writes (resetea powerups) — no queremos efectos al mirar un perfil.
--
-- Correr en cualquier momento. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_plan_badge(p_user_id UUID)
RETURNS JSON LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT json_build_object(
    'plan', COALESCE(s.plan_slug, 'free'),
    'name', COALESCE(p.name, 'Free')
  )
  FROM (SELECT p_user_id AS uid) base
  LEFT JOIN public.subscriptions s
    ON s.user_id = base.uid
   AND s.status = 'active'
   AND s.plan_slug <> 'free'
   AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LEFT JOIN public.plans p ON p.slug = s.plan_slug;
$$;

GRANT EXECUTE ON FUNCTION public.get_plan_badge(UUID) TO authenticated, anon;
