import { supabase } from './supabase.js';

// Utility: perform a select that progressively removes unknown columns
async function safeSelect({ table, fields, filters = [], alias = {} }) {
    let cols = [...fields]
    for (let attempt = 0; attempt < 6; attempt++) {
        const selectExpr = cols
            .map(c => alias[c] ? `${alias[c]}:${c}` : c)
            .join(', ')
        let query = supabase.from(table).select(selectExpr)
        for (const f of filters) {
            if (f.type === 'eq') query = query.eq(f.col, f.val)
            else if (f.type === 'in') query = query.in(f.col, f.val)
            else if (f.type === 'or') query = query.or(f.expr)
            else if (f.type === 'limit') query = query.limit(f.val)
        }
        const { data, error } = await query.maybeSingle ? await query.maybeSingle() : await query
        if (!error) return { data, error: null, removed: fields.filter(f => !cols.includes(f)) }
        const msg = error.message || ''
        const m = msg.match(/column\s+([a-zA-Z0-9_.\"]+)\s+does not exist/i)
        if (m) {
            const full = m[1]
            const col = full.split('.').pop()?.replace(/\"/g, '')
            const idx = cols.indexOf(col)
            if (idx !== -1) {
                cols.splice(idx, 1)
                continue
            }
        }
        return { data: null, error }
    }
    return { data: null, error: new Error('safeSelect failed') }
}

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
}

// Public helpers for reading basic profile info (via view if available)
export async function getPublicProfilesByIds(ids = []) {
    if (!ids.length) return { data: [], error: null }
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, email, avatar_url')
        .in('id', ids)
    return { data, error }
}

export async function getPublicProfile(id) {
        const fields = ['id','display_name','email','avatar_url','nationality_code','favorite_team','favorite_player','career','bio']
        const { data, error } = await supabase
                .from('user_profiles')
                .select(fields.join(', '))
                .eq('id', id)
                .maybeSingle()
        return { data, error }
}

// Search public profiles by display_name, username, or email (case-insensitive)
export async function searchPublicProfiles(q, limit = 10) {
    const term = (q || '').trim()
    if (!term) return { data: [], error: null }
    const like = `%${term}%`
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, email, avatar_url')
        .or(`display_name.ilike.${like},email.ilike.${like}`)
        .limit(limit)
    return { data, error }
}