-- ============================================================
-- GOALDEMY — RECOMPENSAS FASE 4d: COLOR DE FONDO DEL ÍCONO
-- Permite elegir el color del fondo del avatar/ícono.
-- Correr DESPUÉS de rewards-phase4c.sql. Idempotente.
-- ============================================================

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS equipped_icon_bg TEXT;

CREATE OR REPLACE FUNCTION public.set_icon_bg(p_color TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  IF p_color NOT IN ('emerald','cyan','sky','violet','fuchsia','rose','amber','orange','slate') THEN
    RETURN json_build_object('ok', false, 'error', 'bad_color');
  END IF;
  UPDATE public.user_profiles SET equipped_icon_bg = p_color WHERE id = uid;
  RETURN json_build_object('ok', true, 'color', p_color);
END$$;

GRANT EXECUTE ON FUNCTION public.set_icon_bg(TEXT) TO authenticated;
