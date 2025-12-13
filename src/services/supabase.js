/**
 * CONFIGURACIÓN DE SUPABASE
 * 
 * Este archivo inicializa el cliente de Supabase que se usa en toda la aplicación.
 * Supabase proporciona:
 * - Base de datos PostgreSQL (tablas: users, games, achievements, etc.)
 * - Autenticación (login, registro, JWT tokens)
 * - Storage (subida de avatares)
 * - Realtime (actualizaciones en tiempo real de chat, logros, etc.)
 * - Row Level Security (RLS) para proteger datos por usuario
 * 
 * Las credenciales se obtienen de variables de entorno (.env) o valores por defecto para desarrollo.
 */
import { createClient } from '@supabase/supabase-js';

// Obtiene variables de entorno con fallback a valores de desarrollo
const env = (k, fallback = '') => (import.meta?.env?.[k] ?? fallback);
const SUPABASE_URL = env('VITE_SUPABASE_URL', 'https://wwdxywghdouurdavbmyp.supabase.co');
const SUPABASE_KEY = env('VITE_SUPABASE_ANON_KEY', 'sb_publishable_892Ds3x_rSHnDdw0Fb1fjQ_LPzG5FkJ');

// Cliente único de Supabase exportado para toda la app
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);