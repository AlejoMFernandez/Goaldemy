/**
 * SERVICIO DE AUTENTICACIÓN
 * 
 * Maneja todo el flujo de autenticación de usuarios usando Supabase Auth:
 * 
 * ESTADO DEL USUARIO:
 * - Mantiene un objeto "user" reactivo con id, email, email_confirmed_at y perfil extendido
 * - Los componentes se "suscriben" con subscribeToAuthStateChanges() para recibir cambios
 * - Cuando el usuario hace login/logout, todos los observers son notificados automáticamente
 * 
 * PATRÓN OBSERVER:
 * - observers[] = array de funciones callback que se ejecutan cuando cambia el estado
 * - setAuthUserState() notifica a todos los observers cuando hay cambios
 * - Este patrón permite que múltiples componentes reaccionen al login/logout sin prop drilling
 * 
 * FLUJO DE INICIO:
 * 1. loadUserCurrentAuthState() se ejecuta al importar este archivo (línea 15)
 * 2. Verifica si hay un usuario autenticado en Supabase (getUser())
 * 3. Si existe, carga su perfil extendido desde la tabla "users"
 * 4. Resuelve la promesa authReady para indicar que la auth está lista
 * 
 * FUNCIONES PRINCIPALES:
 * - register() - Crear cuenta nueva
 * - login() - Iniciar sesión con email/password
 * - continueWithGoogle() - OAuth con Google
 * - logout() - Cerrar sesión
 * - getAuthUser() - Obtener usuario actual
 * - subscribeToAuthStateChanges() - Suscribirse a cambios de autenticación
 */
import { supabase } from '../services/supabase';
import { createUserProfile, getUserProfileById, updateUserProfile } from './user-profiles';
import { pushSuccessToast, pushInfoToast, pushErrorToast } from '../stores/notifications';

// Estado global del usuario autenticado (reactivo mediante observers)
let user = {
    id: null,
    email: null,
    email_confirmed_at: null,
}

// Array de funciones callback que se ejecutan cuando cambia el estado de auth
let observers = [];

// Promesa que se resuelve cuando la autenticación inicial está lista
let readyResolved = false;
let resolveReady;
export const authReady = new Promise((resolve) => { resolveReady = resolve; });

// INICIO AUTOMÁTICO: Cargar estado actual del usuario al importar este módulo
loadUserCurrentAuthState();

/**
 * Carga el estado actual de autenticación desde Supabase
 * Se ejecuta automáticamente al iniciar la app
 */
async function loadUserCurrentAuthState() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.error('[Auth.vue loadUserCurrentAuthState]:', error);
        // Si el refresh token es inválido, cerrar sesión para limpiar el estado
        try { if (/Invalid Refresh Token/i.test(error.message || '')) await supabase.auth.signOut() } catch {}
        setAuthUserState({ id: null, email: null }, { replace: true });
        if (!readyResolved && resolveReady) { readyResolved = true; resolveReady(true); }
        return;
    }
    const u = data?.user || null;
    if (!u) {
        setAuthUserState({ id: null, email: null, email_confirmed_at: null }, { replace: true });
        if (!readyResolved && resolveReady) { readyResolved = true; resolveReady(true); }
        return;
    }
    setAuthUserState({ id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at || u.confirmed_at || null }, { replace: true });
    loadExtendedProfile(); // Cargar datos adicionales del perfil desde tabla "users"
    if (!readyResolved && resolveReady) { readyResolved = true; resolveReady(true); }
}

/**
 * Carga datos extendidos del perfil del usuario desde la tabla "users"
 * Incluye: display_name, avatar_url, nationality_code, favorite_team, etc.
 */
async function loadExtendedProfile() {
    if (user.id === null) return;
    try {
        const profile = await getUserProfileById(user.id)
        setAuthUserState(profile)
    } catch (e) {
        // Fail-soft: mantener usuario base si falla la carga del perfil
        console.warn('[auth.js] loadExtendedProfile failed, continuing with base user')
    }
}

/**
 * REGISTRO: Crear nueva cuenta de usuario
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña (mínimo 6 caracteres por defecto de Supabase)
 * @param {Object} profileData - Datos adicionales del perfil (display_name, nationality_code, etc.)
 * @returns {Object} { user, session, requiresConfirmation }
 */
export async function register(email, password, profileData = {}) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/login`,
            }
        });

        if (error) {
            console.error('[Register.vue register]:', error);
            throw new Error(error.message || 'Registration failed');
        }

        const u = data?.user || null;
        // If email confirmation is required, user can be null here
        if (u) {
            setAuthUserState({ id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at || u.confirmed_at || null }, { replace: true });
            // Attempt to create extended profile; ignore unknown columns
            const base = { id: u.id, email: u.email }
            const allowed = ['display_name','bio','career','avatar_url','nationality_code','favorite_team','favorite_player']
            const extra = Object.fromEntries(Object.entries(profileData || {}).filter(([k]) => allowed.includes(k)))
            try { await createUserProfile({ ...base, ...extra }) } catch (e) {
                // If insertion fails due to unknown column, try minimal
                try { await createUserProfile(base) } catch {}
            }
        } else {
            setAuthUserState({ id: null, email: email, email_confirmed_at: null });
        }

        // If email not confirmed, proactively resend verification and sign out to enforce flow
        const isConfirmed = !!(data?.user?.email_confirmed_at || data?.user?.confirmed_at);
        if (!isConfirmed) {
            try { await supabase.auth.resend({ type: 'signup', email }); } catch {}
            try { await supabase.auth.signOut(); } catch {}
        }

        return { user: data?.user || null, session: data?.session || null, requiresConfirmation: !isConfirmed };

    } catch (error) {
        console.error('[Register.vue register]:', error);
        throw new Error(error?.message || 'Registration failed');
    }
}

/**
 * LOGIN: Iniciar sesión con email y contraseña
 * Verifica que el email esté confirmado antes de permitir el acceso
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('[Login.vue login]:', error);
        try { pushErrorToast(error.message || 'No se pudo iniciar sesión'); } catch {}
        throw new Error(error.message || 'Login failed');
    }

    const u = data?.user || null;
    if (u) {
        const confirmed = !!(u.email_confirmed_at || u.confirmed_at);
        if (!confirmed) {
            try { await supabase.auth.signOut(); } catch {}
            setAuthUserState({ id: null, email: null, email_confirmed_at: null }, { replace: true });
            try { pushInfoToast('Necesitás confirmar tu email antes de ingresar'); } catch {}
            throw new Error('Necesitás confirmar tu email antes de ingresar');
        }
        setAuthUserState({ id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at || u.confirmed_at || null }, { replace: true });
        loadExtendedProfile();
        try { pushSuccessToast('Sesión iniciada'); } catch {}
    } else {
        setAuthUserState({ id: null, email: null, email_confirmed_at: null }, { replace: true });
    }
}

/**
 * OAUTH GOOGLE: Iniciar sesión/registro con cuenta de Google
 * Redirige automáticamente al flujo de OAuth de Google
 * @param {string} redirectPath - Ruta a donde volver después del login
 */
export async function continueWithGoogle(redirectPath = '/profile') {
    try {
        // Nota: En web, este método redirige automáticamente al proveedor
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}${redirectPath}`,
                queryParams: { prompt: 'select_account' }
            }
        });
        if (error) {
            console.error('[auth.js continueWithGoogle]:', error);
            try { pushErrorToast(error.message || 'No se pudo iniciar con Google'); } catch {}
            throw new Error(error.message || 'Google OAuth failed');
        }
        try { pushInfoToast('Redirigiendo a Google…'); } catch {}
        return data;
    } catch (e) {
        // Ya se notificó con toast arriba si es un error de Supabase
        throw e;
    }
}

/**
 * LOGOUT: Cerrar sesión del usuario
 * Limpia el estado local y cierra la sesión en Supabase
 */
export async function logout() {
    supabase.auth.signOut();

    setAuthUserState({
        id: null,
        email: null,
        email_confirmed_at: null,
    }, { replace: true });
    try { pushInfoToast('Cerraste sesión'); } catch {}
}

// Enviar email de reseteo de contraseña
export async function resetPasswordForEmail(email) {
    // Hint check in our own table (non-bloqueante)
    try {
        await supabase
            .from('user_profiles')
            .select('id')
            .ilike('email', email)
            .maybeSingle()
    } catch (e) {
        console.warn('[auth.js resetPasswordForEmail] profile hint check:', e?.message || e)
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
    })
    if (error) {
        console.error('[auth.js resetPasswordForEmail]:', error)
        const friendly = /invalid/i.test(error.message || '')
            ? 'No encontramos ninguna cuenta registrada con ese email'
            : (error.message || 'No se pudo enviar el email de reseteo')
        try { pushErrorToast(friendly) } catch {}
        throw new Error(friendly)
    }
    try { pushSuccessToast('Te enviamos un email para recuperar tu contraseña') } catch {}
}

// Completar cambio de contraseña cuando el usuario vuelve desde el email (opcional)
export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
        console.error('[auth.js updatePassword]:', error)
        try { pushErrorToast(error.message || 'No se pudo actualizar la contraseña') } catch {}
        throw new Error(error.message || 'No se pudo actualizar la contraseña')
    }
    try { pushSuccessToast('Contraseña actualizada') } catch {}
}

export async function updateAuthUserData(data) {
    try {
        await updateUserProfile(user.id, data);
        setAuthUserState(data);
        try { pushSuccessToast('Perfil actualizado') } catch {}
    } catch (error) {
        console.error('[auth.js updateAuthUserData]:', error);
        try { pushErrorToast(error?.message || 'No se pudo actualizar tu perfil') } catch {}
        throw error;
    }
}

// Reenviar email de verificación de cuenta
export async function resendVerificationEmail(email) {
    try {
        const { data, error } = await supabase.auth.resend({
            type: 'signup',
            email,
        });
        if (error) throw error;
        try { pushSuccessToast('Te enviamos nuevamente el correo de verificación'); } catch {}
        return data;
    } catch (e) {
        console.error('[auth.js resendVerificationEmail]:', e);
        try { pushErrorToast(e?.message || 'No pudimos reenviar el correo'); } catch {}
        throw e;
    }
}

/**
 * PATRÓN OBSERVER: Funciones para suscribirse a cambios de autenticación
 */

/**
 * Suscribe un callback para recibir notificaciones cuando cambie el estado de auth
 * @param {Function} callback - Función que recibe el objeto user actualizado
 * @returns {Function} Función para cancelar la suscripción
 * 
 * Ejemplo de uso:
 *   const unsubscribe = subscribeToAuthStateChanges((user) => {
 *     console.log('Usuario actualizado:', user)
 *   })
 *   // Cancelar suscripción:
 *   unsubscribe()
 */
export function subscribeToAuthStateChanges(callback) {
    observers.push(callback);
    notify(callback);

    return () => {
        observers = observers.filter(obs => obs !== callback);
    };
}

function notify(callback) {
    callback({...user});
}

function notifyAll() {
    observers.forEach(notify);
}

/**
 * Actualiza el estado del usuario y notifica a todos los observers
 * @param {Object} newState - Nuevos datos del usuario
 * @param {Object} opts - Opciones { replace: boolean }
 *   - replace: true = reemplaza todo el objeto user (usado en login/logout)
 *   - replace: false = hace merge con el estado actual (usado para updates parciales)
 */
function setAuthUserState(newState, opts = {}){
    const { replace = false } = opts || {}
    // If replacing or switching to a different user id, reset to a clean base first
    const isIdChange = Object.prototype.hasOwnProperty.call(newState, 'id') && newState.id !== user.id
    if (replace || isIdChange) {
        user = { id: null, email: null, email_confirmed_at: null }
    }
    user = {
        ...user,
        ...newState
    };
    notifyAll();
}

/**
 * Obtiene el usuario actual sin suscribirse a cambios
 * Útil para acceder al usuario de forma puntual sin crear una suscripción reactiva
 * @returns {Object} Copia del objeto user actual
 */
export function getAuthUser() {
    return { ...user };
}

/**
 * LISTENER DE SUPABASE: Sincroniza cambios de sesión
 * Escucha eventos de Supabase (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
 * y actualiza el estado local automáticamente
 */
try {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user || null;
        if (u) {
            setAuthUserState({ id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at || u.confirmed_at || null }, { replace: true });
            loadExtendedProfile();
        } else {
            setAuthUserState({ id: null, email: null, email_confirmed_at: null }, { replace: true });
        }
    });
    // Nota: en dev HMR esta suscripción se reemplaza; no requiere limpieza manual aquí
} catch {}