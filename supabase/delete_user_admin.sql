-- Funciones administrativas para gestión de usuarios
-- Solo pueden ser ejecutadas por administradores

-- ============================================
-- Función 1: Cambiar rol de usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.change_user_role_admin(
    target_user_id UUID,
    new_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_user_id UUID;
    calling_user_role TEXT;
BEGIN
    -- Obtener el ID del usuario que llama
    calling_user_id := auth.uid();
    
    -- Verificar que hay un usuario autenticado
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;
    
    -- Verificar que el usuario es admin
    SELECT role INTO calling_user_role
    FROM public.user_profiles
    WHERE id = calling_user_id;
    
    IF calling_user_role IS NULL OR calling_user_role != 'admin' THEN
        RAISE EXCEPTION 'No tienes permisos de administrador';
    END IF;
    
    -- Verificar que el rol es válido
    IF new_role NOT IN ('admin', 'user') THEN
        RAISE EXCEPTION 'Rol inválido. Debe ser admin o user';
    END IF;
    
    -- Actualizar el rol del usuario
    UPDATE public.user_profiles
    SET role = new_role
    WHERE id = target_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;
END;
$$;

-- ============================================
-- Función 2: Eliminar usuario completamente
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_user_id UUID;
    calling_user_role TEXT;
BEGIN
    -- Obtener el ID del usuario que llama
    calling_user_id := auth.uid();
    
    -- Verificar que hay un usuario autenticado
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;
    
    -- Verificar que el usuario es admin
    SELECT role INTO calling_user_role
    FROM public.user_profiles
    WHERE id = calling_user_id;
    
    IF calling_user_role IS NULL OR calling_user_role != 'admin' THEN
        RAISE EXCEPTION 'No tienes permisos de administrador';
    END IF;
    
    -- Verificar que no está intentando eliminarse a sí mismo
    IF calling_user_id = target_user_id THEN
        RAISE EXCEPTION 'No puedes eliminarte a ti mismo';
    END IF;
    
    -- Eliminar todos los datos relacionados con el usuario
    -- (las restricciones ON DELETE CASCADE se encargarán de muchas tablas)
    
    -- Eliminar eventos XP
    DELETE FROM public.xp_events WHERE user_id = target_user_id;
    
    -- Eliminar sesiones de juego
    DELETE FROM public.game_sessions WHERE user_id = target_user_id;
    
    -- Eliminar logros desbloqueados
    DELETE FROM public.user_achievements WHERE user_id = target_user_id;
    
    -- Eliminar conexiones/amistades (usar user_a y user_b)
    DELETE FROM public.connections WHERE user_a = target_user_id OR user_b = target_user_id;
    
    -- Eliminar notificaciones (usar to_user y from_user)
    DELETE FROM public.notifications WHERE to_user = target_user_id OR from_user = target_user_id;
    
    -- Eliminar mensajes directos (usar sender_id y recipient_id)
    DELETE FROM public.direct_messages WHERE sender_id = target_user_id OR recipient_id = target_user_id;
    
    -- Eliminar el perfil del usuario
    DELETE FROM public.user_profiles WHERE id = target_user_id;
    
    -- Eliminar el usuario de auth.users usando la extensión auth
    -- NOTA: Esto requiere permisos especiales y solo funciona con SECURITY DEFINER
    DELETE FROM auth.users WHERE id = target_user_id;
    
END;
$$;

-- ============================================
-- Permisos
-- ============================================

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.change_user_role_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(UUID) TO authenticated;

-- Comentarios de las funciones
COMMENT ON FUNCTION public.change_user_role_admin(UUID, TEXT) IS 'Cambia el rol de un usuario. Solo puede ser ejecutada por administradores.';
COMMENT ON FUNCTION public.delete_user_admin(UUID) IS 'Elimina completamente un usuario (perfil y auth). Solo puede ser ejecutada por administradores.';
