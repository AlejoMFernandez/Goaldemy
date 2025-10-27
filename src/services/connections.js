import { supabase } from './supabase'
import { pushErrorToast, pushSuccessToast } from '../stores/notifications'

async function getCurrentUserId() {
  try { const { data } = await supabase.auth.getUser(); return data?.user?.id || null } catch { return null }
}

// Map a row into a state from the perspective of `me`
function stateFrom(me, row) {
  if (!row) return { state: 'none', row: null }
  if (row.status === 'accepted') return { state: 'connected', row }
  if (row.status === 'pending') {
    if (row.user_a === me) return { state: 'pending_out', row }
    if (row.user_b === me) return { state: 'pending_in', row }
  }
  return { state: row.status || 'unknown', row }
}

export async function getStatusWith(targetId) {
  const me = await getCurrentUserId()
  if (!me || !targetId || me === targetId) return { state: me===targetId ? 'self' : 'none', row: null }
  const orExpr = `and(user_a.eq.${me},user_b.eq.${targetId}),and(user_a.eq.${targetId},user_b.eq.${me})`
  const { data, error } = await supabase
    .from('connections')
    .select('id,user_a,user_b,status,created_at')
    .or(orExpr)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return { state: 'error', row: null, error }
  const row = Array.isArray(data) ? data[0] : null
  return stateFrom(me, row)
}

export async function sendRequest(toUserId) {
  const me = await getCurrentUserId()
  if (!me) { pushErrorToast('Debés iniciar sesión'); throw new Error('Not authenticated') }
  if (!toUserId || toUserId === me) { throw new Error('Invalid target') }
  const { data, error } = await supabase
    .from('connections')
    .insert([{ user_a: me, user_b: toUserId, status: 'pending' }])
    .select('*').single()
  if (error) { pushErrorToast(error.message || 'No se pudo enviar la solicitud'); throw error }
  try {
    // Best-effort notification
    await supabase.from('notifications').insert([{ type: 'connection_request', to_user: toUserId, from_user: me, payload: { connection_id: data.id } }])
  } catch {}
  pushSuccessToast('Solicitud enviada')
  return data
}

export async function acceptRequest(connectionId) {
  const me = await getCurrentUserId()
  if (!me) { throw new Error('Not authenticated') }
  const { data, error } = await supabase
    .from('connections')
    .update({ status: 'accepted' })
    .eq('id', connectionId)
    .eq('user_b', me)
    .select('*').single()
  if (error) { throw error }
  // Emitir notificaciones: al solicitante (user_a) y un historial para el aceptante (me)
  try {
    if (data?.user_a && data?.user_b) {
      // Al solicitante: tu solicitud fue aceptada
      await supabase.from('notifications').insert([{ type: 'friend_accepted', to_user: data.user_a, from_user: data.user_b, payload: { connection_id: data.id } }])
      // Al aceptante: historial local de "agregado como amigo"
      await supabase.from('notifications').insert([{ type: 'friend_added', to_user: data.user_b, from_user: data.user_a, payload: { connection_id: data.id } }])
    }
  } catch {}
  return data
}

export async function blockRequest(connectionId) {
  const me = await getCurrentUserId()
  if (!me) { throw new Error('Not authenticated') }
  const { data, error } = await supabase
    .from('connections')
    .update({ status: 'blocked' })
    .eq('id', connectionId)
    .eq('user_b', me)
    .select('*').single()
  if (error) { throw error }
  return data
}

export async function listConnections(userId = null) {
  const me = userId || await getCurrentUserId()
  if (!me) return { data: [], error: null }
  const { data, error } = await supabase
    .from('connections')
    .select('id,user_a,user_b,status,created_at')
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function listIncomingRequests() {
  const me = await getCurrentUserId()
  if (!me) return { data: [], error: null }
  const { data, error } = await supabase
    .from('connections')
    .select('id,user_a,user_b,status,created_at')
    .eq('user_b', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

// Remove or cancel a connection with a given target user (works for accepted or pending)
export async function disconnectWith(targetId) {
  const me = await getCurrentUserId()
  if (!me || !targetId || me === targetId) { throw new Error('Invalid target') }
  const orExpr = `and(user_a.eq.${me},user_b.eq.${targetId}),and(user_a.eq.${targetId},user_b.eq.${me})`
  const { data: rows, error: selErr } = await supabase
    .from('connections')
    .select('id,user_a,user_b,status')
    .or(orExpr)
    .limit(1)
  if (selErr) throw selErr
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row?.id) return { ok: true } // nothing to do
  // Prefer delete to truly disconnect
  const { error: delErr } = await supabase
    .from('connections')
    .delete()
    .eq('id', row.id)
  if (delErr) throw delErr
  try {
    // History notification to both about disconnection; include initiator_id for better wording
    await supabase.from('notifications').insert([
      { type: 'friend_removed', to_user: row.user_a, from_user: row.user_b, payload: { connection_id: row.id, initiator_id: me } },
      { type: 'friend_removed', to_user: row.user_b, from_user: row.user_a, payload: { connection_id: row.id, initiator_id: me } },
    ])
  } catch {}
  pushSuccessToast('Conexión eliminada')
  return { ok: true }
}
