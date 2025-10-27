import { supabase } from './supabase'

export async function fetchUnreadCount() {
  const me = (await supabase.auth.getUser())?.data?.user?.id
  if (!me) return { count: 0 }
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('to_user', me)
    .eq('read', false)
    // Excluir las notificaciones genéricas de solicitud, ya que el dropdown usa 'connections'
    .neq('type', 'connection_request')
  return { count: count || 0 }
}

export async function listNotifications(limit = 20) {
  const me = (await supabase.auth.getUser())?.data?.user?.id
  if (!me) return { data: [] }
  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,from_user,to_user,payload,read,created_at')
    .eq('to_user', me)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

export async function markAsRead(id) {
  const me = (await supabase.auth.getUser())?.data?.user?.id
  if (!me) return
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('to_user', me)
}
