import { createClient } from '@supabase/supabase-js';

// Prefer environment variables; fall back to current constants for dev compatibility
const env = (k, fallback = '') => (import.meta?.env?.[k] ?? fallback);
const SUPABASE_URL = env('VITE_SUPABASE_URL', 'https://wwdxywghdouurdavbmyp.supabase.co');
const SUPABASE_KEY = env('VITE_SUPABASE_ANON_KEY', 'sb_publishable_892Ds3x_rSHnDdw0Fb1fjQ_LPzG5FkJ');

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);