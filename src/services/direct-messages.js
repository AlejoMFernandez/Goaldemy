import { supabase } from './supabase'
import { getPublicProfilesByIds } from './user-profiles'

async function me() { try { return (await supabase.auth.getUser())?.data?.user?.id || null } catch { return null } }

export async function sendDirectMessage(toUserId, content) {
  const sender = await me()
  if (!sender) throw new Error('Not authenticated')
  const payload = { sender_id: sender, recipient_id: toUserId, content: (content||'').trim() }
  if (!payload.content) throw new Error('Mensaje vacío')
  const { error } = await supabase.from('direct_messages').insert([payload])
  if (error) throw error
}

export async function fetchConversation(peerId, limit = 200) {
  const uid = await me()
  if (!uid || !peerId) return { data: [] }
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${uid},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${uid})`)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) return { data: [], error }
  const rows = data || []
  // Enrich with names/avatars for the two participants
  try {
    const { data: profs } = await getPublicProfilesByIds([uid, peerId])
    const map = {}; for (const p of profs||[]) map[p.id] = p
    for (const m of rows) {
      const p = map[m.sender_id]; if (p) { m.display_name = p.display_name; m.avatar_url = p.avatar_url; m.email = p.email }
    }
  } catch {}
  return { data: rows }
}

export function subscribeConversation(peerId, handlers) {
  // handlers can be a function (onInsert) or an object { onInsert, onUpdate }
  const onInsert = typeof handlers === 'function' ? handlers : handlers?.onInsert
  const onUpdate = typeof handlers === 'object' ? handlers?.onUpdate : undefined
  const channel = supabase.channel(`dm:${peerId || 'all'}`)
  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
    const row = payload?.new
    if (!row || !onInsert) return
    onInsert(row)
  })
  channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, payload => {
    const row = payload?.new
    if (!row || !onUpdate) return
    onUpdate(row)
  })
  channel.subscribe()
  return () => { try { channel.unsubscribe() } catch {} }
}

export async function markConversationRead(peerId) {
  const uid = await me(); if (!uid) return
  await supabase
    .from('direct_messages')
    .update({ read: true })
    .eq('recipient_id', uid)
    .eq('sender_id', peerId)
}

// Fetch recent conversations (peers) for current user, with last message and unread count per peer
export async function fetchRecentConversations(limitPeers = 30) {
  const uid = await me(); if (!uid) return { data: [] }
  // 1) Fetch last N messages involving me (both directions)
  const { data: msgs, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) return { data: [], error }

  // 2) Build threads: for each peer id, pick latest message and compute unread counter from a second query
  const threadsMap = {}
  for (const m of (msgs || [])) {
    const peer = m.sender_id === uid ? m.recipient_id : m.sender_id
    if (!peer) continue
    if (!threadsMap[peer]) threadsMap[peer] = { peer_id: peer, last: m, last_from_me: m.sender_id === uid }
  }
  let peers = Object.values(threadsMap)
  // Cap to limitPeers
  if (peers.length > limitPeers) peers = peers.slice(0, limitPeers)
  const peerIds = peers.map(p => p.peer_id)

  // 3) Unread counts for messages where I am recipient and read=false
  const { data: unreadRows } = await supabase
    .from('direct_messages')
    .select('sender_id')
    .eq('recipient_id', uid)
    .eq('read', false)
  const unreadMap = {}
  for (const r of (unreadRows || [])) unreadMap[r.sender_id] = (unreadMap[r.sender_id] || 0) + 1

  // 4) Enrich with profiles
  let profiles = []
  try {
    const { data: profs } = await getPublicProfilesByIds(peerIds)
    profiles = profs || []
  } catch {}
  const profMap = {}; for (const p of profiles) profMap[p.id] = p

  const result = peers.map(p => ({
    peer_id: p.peer_id,
    last: p.last,
    last_from_me: !!p.last_from_me,
    unread: unreadMap[p.peer_id] || 0,
    profile: profMap[p.peer_id] || { id: p.peer_id }
  }))
  return { data: result }
}

export async function fetchUnreadCountFrom(peerId) {
  const uid = await me(); if (!uid) return { data: 0 }
  const { data, error } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', uid)
    .eq('sender_id', peerId)
    .eq('read', false)
  return { data: data?.length || 0, error }
}
