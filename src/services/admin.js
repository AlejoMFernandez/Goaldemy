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
    
    // Preferir el RPC get_users_admin: incluye email_confirmed_at + last_sign_in_at
    // (necesario para detectar usuarios fantasma). Fallback al query directo si el
    // RPC todavía no está instalado (ver supabase/ghost-users.sql).
    let profiles = null;
    try {
        const { data, error } = await supabase.rpc('get_users_admin');
        if (!error && Array.isArray(data)) profiles = data;
    } catch { /* RPC no disponible aún */ }

    if (!profiles) {
        const { data, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, email, display_name, avatar_url, role, created_at')
            .order('created_at', { ascending: false });
        if (profilesError) {
            console.error('Error obteniendo usuarios:', profilesError);
            throw profilesError;
        }
        profiles = data;
    }

    // Enriquecer con nivel y XP usando la función get_user_level
    const usersWithLevels = await Promise.all(
        profiles.map(async (user) => {
            try {
                const { data: levelData } = await supabase
                    .rpc('get_user_level', { p_user_id: user.id });
                
                const levelInfo = Array.isArray(levelData) ? levelData[0] : levelData;
                
                return {
                    ...user,
                    level: levelInfo?.level ?? 1,
                    total_xp: levelInfo?.xp_total ?? 0
                };
            } catch (err) {
                console.error(`Error obteniendo nivel para usuario ${user.id}:`, err);
                return {
                    ...user,
                    level: 1,
                    total_xp: 0
                };
            }
        })
    );
    
    return usersWithLevels;
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
    
    if (totalError) {
        console.error('Error obteniendo total de usuarios:', totalError);
        throw totalError;
    }
    
    // Total de admins
    const { count: totalAdmins, error: adminsError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
    
    if (adminsError) {
        console.error('Error obteniendo total de admins:', adminsError);
        throw adminsError;
    }
    
    // Usuarios registrados en las últimas 24 horas
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const { count: newUsers, error: newUsersError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());
    
    if (newUsersError) {
        console.error('Error obteniendo nuevos usuarios:', newUsersError);
        throw newUsersError;
    }
    
    // Top 5 usuarios por XP - calculado desde xp_events
    const { data: topXpData, error: topXpError } = await supabase
        .from('xp_events')
        .select('user_id, amount')
        .order('created_at', { ascending: false });
    
    if (topXpError) {
        console.error('Error obteniendo XP de usuarios:', topXpError);
        throw topXpError;
    }
    
    // Agrupar XP por usuario
    const xpByUser = {};
    topXpData?.forEach(event => {
        if (!xpByUser[event.user_id]) {
            xpByUser[event.user_id] = 0;
        }
        xpByUser[event.user_id] += event.amount;
    });
    
    // Ordenar usuarios por XP
    const topUserIds = Object.entries(xpByUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([userId, xp]) => ({ userId, xp }));
    
    // Obtener nombres de los top usuarios
    const topUsers = await Promise.all(
        topUserIds.map(async ({ userId, xp }) => {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('id', userId)
                .single();
            
            return {
                display_name: profile?.display_name || 'Usuario',
                total_xp: xp
            };
        })
    );
    
    return {
        totalUsers: totalUsers || 0,
        totalAdmins: totalAdmins || 0,
        newUsersLast24h: newUsers || 0,
        topUsers: topUsers
    };
}

/**
 * Métricas agregadas del panel (MRR, PRO activos, DAU, partidas, altas…).
 * Todo se calcula server-side en el RPC get_admin_dashboard (SECURITY DEFINER)
 * porque subscriptions/game_sessions tienen RLS "solo lo propio".
 * Requiere correr supabase/mejoras11-admin-dashboard.sql.
 * @returns {Promise<Object>}
 */
export async function getAdminDashboard() {
    const { data, error } = await supabase.rpc('get_admin_dashboard');
    if (error) {
        console.error('Error cargando dashboard admin:', error);
        throw new Error('No se pudo cargar el dashboard. ¿Corriste supabase/mejoras11-admin-dashboard.sql?');
    }
    return data || {};
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
    
    // Intentar usar función RPC primero (bypassa RLS)
    try {
        const { data, error } = await supabase.rpc('change_user_role_admin', {
            target_user_id: userId,
            new_role: newRole
        });
        
        if (error) {
            console.warn('Función RPC change_user_role_admin no disponible:', error);
            throw error;
        }
        
        // La función RPC no retorna data, así que devolvemos un objeto simple
        return { id: userId, role: newRole };
    } catch (error) {
        console.error('Error cambiando rol:', error);
        throw error;
    }
}

/**
 * Elimina un usuario (solo para admins)
 * NOTA: Esto elimina tanto el perfil como el usuario de auth
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
    
    // Intentar usar función RPC si existe, si no, eliminar solo el perfil
    try {
        const { error: rpcError } = await supabase.rpc('delete_user_admin', { 
            target_user_id: userId 
        });
        
        if (rpcError) {
            // Si la función RPC no existe o falla, no hacer nada más
            console.error('Error usando función RPC delete_user_admin:', rpcError);
            throw new Error('No se pudo eliminar el usuario. Por favor, ejecuta el script SQL delete_user_admin.sql en Supabase.');
        }
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        throw error;
    }
}

/**
 * Borra de un saque los usuarios fantasma (mail sin confirmar, viejos y sin
 * actividad). Requiere correr supabase/ghost-users.sql. Devuelve cuántos borró.
 * @param {number} days - Días de gracia desde la creación (default 5)
 * @returns {Promise<number>}
 */
export async function purgeGhostUsers(days = 5) {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error('No tienes permisos de administrador');
    }
    const { data, error } = await supabase.rpc('purge_ghost_users', { p_days: days });
    if (error) {
        console.error('Error purgando usuarios fantasma:', error);
        throw new Error('No se pudo purgar. ¿Corriste supabase/ghost-users.sql?');
    }
    return data || 0;
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
    
    const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, avatar_url, role, created_at')
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) {
        console.error('Error buscando usuarios:', error);
        throw error;
    }
    
    // Enriquecer con nivel y XP
    const usersWithLevels = await Promise.all(
        profiles.map(async (user) => {
            try {
                const { data: levelData } = await supabase
                    .rpc('get_user_level', { p_user_id: user.id });
                
                const levelInfo = Array.isArray(levelData) ? levelData[0] : levelData;
                
                return {
                    ...user,
                    level: levelInfo?.level ?? 1,
                    total_xp: levelInfo?.xp_total ?? 0
                };
            } catch (err) {
                console.error(`Error obteniendo nivel para usuario ${user.id}:`, err);
                return {
                    ...user,
                    level: 1,
                    total_xp: 0
                };
            }
        })
    );
    
    return usersWithLevels;
}
