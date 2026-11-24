/**
 * CUENTA — borrado de cuenta desde la app (requisito de Apple App Store).
 *
 * Llama a la Edge Function `delete-account` (supabase/functions/delete-account),
 * que con service_role: cancela la suscripción paga, borra los archivos del
 * usuario en Storage, purga sus datos (purge_user_data) y borra el usuario de Auth.
 *
 * La UI (ProfileEdit.vue) solo se muestra con VITE_ACCOUNT_DELETION=1, para no
 * publicar un botón que falle antes de deployar la función y aplicar el parche
 * supabase/pendientes/2026-11-24-03-purge-y-borrado-de-cuenta.sql.
 */
import { supabase } from './supabase'

export const ACCOUNT_DELETION_ENABLED = import.meta.env.VITE_ACCOUNT_DELETION === '1'

/** Texto exacto que el usuario tiene que tipear para confirmar. */
export const DELETE_CONFIRM_WORD = 'BORRAR'

/**
 * Borra la cuenta del usuario logueado. Devuelve { ok, error? }.
 * @param {string} confirmText lo que tipeó el usuario (tiene que ser "BORRAR")
 */
export async function deleteMyAccount(confirmText) {
  if (String(confirmText || '').trim() !== DELETE_CONFIRM_WORD) {
    return { ok: false, error: `Escribí ${DELETE_CONFIRM_WORD} para confirmar` }
  }
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session) return { ok: false, error: 'Tenés que iniciar sesión' }

  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: DELETE_CONFIRM_WORD },
  })
  if (error || !data?.ok) {
    return { ok: false, error: data?.error || 'No pudimos borrar la cuenta. Probá de nuevo o escribinos.' }
  }

  clearLocalUserData()
  // La sesión ya no es válida en el servidor; limpiamos la local.
  try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
  return { ok: true }
}

/** Borra del navegador lo que la app guarda por usuario (recompensas, niveles, pendientes). */
function clearLocalUserData() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('gl:') || k.startsWith('goaldemy_'))) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch {}
}
