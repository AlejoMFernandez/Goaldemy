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
        throw new Error("error.message");
    }
    return data;
}

export async function createUserProfile(data) {
    const { error } = await supabase
        .from('user_profiles')
        .insert([data]);
    if (error) {
        console.error('[user-profiles.js createUserProfile]:', error);
        throw new Error("error.message");
    }
}

export async function updateUserProfile(id, newData) {
    const { data, error } = await supabase
        .from('user_profiles')
        .update(newData)
        .eq('id', id);

    if (error) {
        console.error('[user-profiles.js updateUserProfile] - User Nº:', id, error);
        throw new Error("error.message");
    }
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