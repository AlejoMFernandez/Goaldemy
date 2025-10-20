import { supabase } from '../services/supabase';
import { createUserProfile, getUserProfileById, updateUserProfile } from './user-profiles';

let user = {
    id: null,
    email: null,
}
let observers = [];
let readyResolved = false;
let resolveReady;
export const authReady = new Promise((resolve) => { resolveReady = resolve; });

loadUserCurrentAuthState();
async function loadUserCurrentAuthState() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.error('[Auth.vue loadUserCurrentAuthState]:', error);
        setAuthUserState({ id: null, email: null }, { replace: true });
        if (!readyResolved && resolveReady) { readyResolved = true; resolveReady(true); }
        return;
    }
    const u = data?.user || null;
    if (!u) {
        setAuthUserState({ id: null, email: null }, { replace: true });
        if (!readyResolved && resolveReady) { readyResolved = true; resolveReady(true); }
        return;
    }
    setAuthUserState({ id: u.id, email: u.email }, { replace: true });
    loadExtendedProfile();
    if (!readyResolved && resolveReady) { readyResolved = true; resolveReady(true); }
}

async function loadExtendedProfile() {
    if (user.id === null) return;
    setAuthUserState(await getUserProfileById(user.id));
}

// Funciones de manejo de usuario
export async function register(email, password, profileData = {}) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            console.error('[Register.vue register]:', error);
            throw new Error(error.message || 'Registration failed');
        }

        const u = data?.user || null;
        // If email confirmation is required, user can be null here
        if (u) {
            setAuthUserState({ id: u.id, email: u.email }, { replace: true });
            // Attempt to create extended profile; ignore unknown columns
            const base = { id: u.id, email: u.email }
            const allowed = ['display_name','bio','career','avatar_url','nationality_code','favorite_team','favorite_player']
            const extra = Object.fromEntries(Object.entries(profileData || {}).filter(([k]) => allowed.includes(k)))
            try { await createUserProfile({ ...base, ...extra }) } catch (e) {
                // If insertion fails due to unknown column, try minimal
                try { await createUserProfile(base) } catch {}
            }
        } else {
            setAuthUserState({ id: null, email: email });
        }

    } catch (error) {
        console.error('[Register.vue register]:', error);
        throw new Error(error?.message || 'Registration failed');
    }
}

export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('[Login.vue login]:', error);
        throw new Error(error.message || 'Login failed');
    }

    const u = data?.user || null;
    if (u) {
        setAuthUserState({ id: u.id, email: u.email }, { replace: true });
        loadExtendedProfile();
    } else {
        setAuthUserState({ id: null, email: null }, { replace: true });
    }
}

export async function logout() {
    supabase.auth.signOut();

    setAuthUserState({
        id: null,
        email: null,
    }, { replace: true });
}

// Enviar email de reseteo de contraseña
export async function resetPasswordForEmail(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login',
    })
    if (error) {
        console.error('[auth.js resetPasswordForEmail]:', error)
        throw new Error(error.message || 'No se pudo enviar el email de reseteo')
    }
}

// Completar cambio de contraseña cuando el usuario vuelve desde el email (opcional)
export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
        console.error('[auth.js updatePassword]:', error)
        throw new Error(error.message || 'No se pudo actualizar la contraseña')
    }
}

export async function updateAuthUserData(data) {
    try {
        await updateUserProfile(user.id, data);
        setAuthUserState(data);
    } catch (error) {
        console.error('[auth.js updateAuthUserData]:', error);
        throw error;
    }
}

// Funciones de manejo de observers
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

function setAuthUserState(newState, opts = {}){
    const { replace = false } = opts || {}
    // If replacing or switching to a different user id, reset to a clean base first
    const isIdChange = Object.prototype.hasOwnProperty.call(newState, 'id') && newState.id !== user.id
    if (replace || isIdChange) {
        user = { id: null, email: null }
    }
    user = {
        ...user,
        ...newState
    };
    notifyAll();
}

// Accessor para router u otros módulos que necesiten el user actual sin subscribirse
export function getAuthUser() {
    return { ...user };
}

// Mantener sincronía con cambios de sesión (login/logout/refresh) de Supabase
try {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user || null;
        if (u) {
            setAuthUserState({ id: u.id, email: u.email }, { replace: true });
            loadExtendedProfile();
        } else {
            setAuthUserState({ id: null, email: null }, { replace: true });
        }
    });
    // Nota: en dev HMR esta suscripción se reemplaza; no requiere limpieza manual aquí
} catch {}