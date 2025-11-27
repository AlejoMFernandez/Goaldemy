import { supabase } from './supabase.js';

/**
 * Verifica si el usuario actual es administrador
 * @returns {Promise<boolean>}
 */
export async function isAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;
    
    const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (error) {
        console.error('Error verificando rol de admin:', error);
        return false;
    }
    
    return data?.role === 'admin';
}

/**
 * Obtiene el rol del usuario actual
 * @returns {Promise<string|null>} 'admin' o 'user'
 */
export async function getCurrentUserRole() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;
    
    const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (error) {
        console.error('Error obteniendo rol del usuario:', error);
        return null;
    }
    
    return data?.role || 'user';
}

/**
 * Lista todos los usuarios (solo para admins)
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error('No tienes permisos de administrador');
    }
    
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error obteniendo usuarios:', error);
        throw error;
    }
    
    return data;
}

/**
 * Obtiene estadísticas de usuarios (solo para admins)
 * @returns {Promise<Object>}
 */
export async function getUserStats() {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error('No tienes permisos de administrador');
    }
    
    // Total de usuarios
    const { count: totalUsers, error: totalError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });
    
    if (totalError) throw totalError;
    
    // Total de admins
    const { count: totalAdmins, error: adminsError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
    
    if (adminsError) throw adminsError;
    
    // Usuarios registrados en las últimas 24 horas
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: newUsers, error: newUsersError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());
    
    if (newUsersError) throw newUsersError;
    
    // Usuarios con más XP (top 5)
    const { data: topUsers, error: topError } = await supabase
        .from('user_profiles')
        .select('display_name, total_xp')
        .order('total_xp', { ascending: false })
        .limit(5);
    
    if (topError) throw topError;
    
    return {
        totalUsers: totalUsers || 0,
        totalAdmins: totalAdmins || 0,
        newUsersLast24h: newUsers || 0,
        topUsers: topUsers || []
    };
}

/**
 * Actualiza un usuario (solo para admins)
 * @param {string} userId - ID del usuario
 * @param {Object} updates - Datos a actualizar
 * @returns {Promise<Object>}
 */
export async function updateUser(userId, updates) {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error('No tienes permisos de administrador');
    }
    
    const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    
    if (error) {
        console.error('Error actualizando usuario:', error);
        throw error;
    }
    
    return data;
}

/**
 * Cambia el rol de un usuario (solo para admins)
 * @param {string} userId - ID del usuario
 * @param {string} newRole - 'admin' o 'user'
 * @returns {Promise<Object>}
 */
export async function changeUserRole(userId, newRole) {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error('No tienes permisos de administrador');
    }
    
    if (!['admin', 'user'].includes(newRole)) {
        throw new Error('Rol inválido. Debe ser "admin" o "user"');
    }
    
    const { data, error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();
    
    if (error) {
        console.error('Error cambiando rol:', error);
        throw error;
    }
    
    return data;
}

/**
 * Elimina un usuario (solo para admins)
 * NOTA: Esto elimina el perfil de user_profiles
 * @param {string} userId - ID del usuario
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error('No tienes permisos de administrador');
    }
    
    // Verificar que no se está intentando eliminar a sí mismo
    const { data: { user } } = await supabase.auth.getUser();
    if (user.id === userId) {
        throw new Error('No puedes eliminarte a ti mismo');
    }
    
    // Eliminar de user_profiles
    const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);
    
    if (error) {
        console.error('Error eliminando usuario:', error);
        throw error;
    }
}

/**
 * Busca usuarios por nombre o email (solo para admins)
 * @param {string} query - Término de búsqueda
 * @returns {Promise<Array>}
 */
export async function searchUsers(query) {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error('No tienes permisos de administrador');
    }
    
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) {
        console.error('Error buscando usuarios:', error);
        throw error;
    }
    
    return data;
}
