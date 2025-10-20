import { supabase } from './supabase.js';

export async function getUserProfileById(id) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select()
        .eq('id', id)
        .limit(1)
        .single();

    if (error) {
        console.error('[user-profiles.js getUserProfileById] - User Nº:', id, error);
        throw new Error(error.message || 'Failed to fetch user profile');
    }
    return data;
}

export async function createUserProfile(data) {
    const { error } = await supabase
        .from('user_profiles')
        .insert([data]);
    if (error) {
        console.error('[user-profiles.js createUserProfile]:', error);
        throw new Error(error.message || 'Failed to create user profile');
    }
}

export async function updateUserProfile(id, newData) {
<<<<<<< HEAD
    const { data, error } = await supabase
        .from('user_profiles')
        .update(newData)
        .eq('id', id);

    if (error) {
        console.error('[user-profiles.js updateUserProfile] - User Nº:', id, error);
        throw new Error(error.message || 'Failed to update user profile');
    }
=======
    // Try to update; if backend complains about unknown columns in schema cache, progressively remove them and retry.
    let payload = { ...(newData || {}) }
    for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase
            .from('user_profiles')
            .update(payload)
            .eq('id', id)

        if (!error) return

        const msg = (error.message || '')
        // Parse `'column_name' column` from PostgREST error
        const m = msg.match(/'([^']+)' column/i)
        if (m && payload && m[1] in payload) {
            // Remove the offending column and retry
            const bad = m[1]
            console.warn('[user-profiles.js] removing unknown column and retrying:', bad)
            const { [bad]: _omit, ...rest } = payload
            payload = rest
            continue
        }
        // If we cannot identify the column, throw the original error
        console.error('[user-profiles.js updateUserProfile] - User Nº:', id, error)
        throw new Error(error.message || 'Failed to update user profile')
    }
    // If we exhausted retries and still not returned, throw
    throw new Error('Failed to update user profile after retries')
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
}

// Public helpers for reading basic profile info (via view if available)
export async function getPublicProfilesByIds(ids = []) {
    if (!ids.length) return { data: [], error: null }
    // Prefer the compatibility view. It exposes user_id; alias it as id for consumers.
    let { data, error } = await supabase
        .from('v_user_profiles')
        .select('id:user_id, display_name, username, email, avatar_url')
        .in('user_id', ids)

    if (error) {
        // Fallback to base table which uses id as primary key
        const res = await supabase
            .from('user_profiles')
            .select('id, display_name, username, email, avatar_url')
            .in('id', ids)
        data = res.data; error = res.error
    }
    return { data, error }
}

export async function getPublicProfile(id) {
    // Prefer view; filter by user_id, expose id alias for consumers.
    let { data, error } = await supabase
        .from('v_user_profiles')
        .select('id:user_id, display_name, username, email, avatar_url')
        .eq('user_id', id)
        .maybeSingle()

    if (error) {
        const res = await supabase
            .from('user_profiles')
            .select('id, display_name, username, email, avatar_url')
            .eq('id', id)
            .maybeSingle()
        data = res.data; error = res.error
    }
    return { data, error }
}