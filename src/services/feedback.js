/**
 * Reportes de bug enviados por los usuarios desde la sidebar.
 * Guarda en public.bug_reports (ver supabase/mejoras10-bug-reports.sql).
 * Los ves en Supabase (o en el panel admin cuando sumemos la vista).
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'

export async function submitBugReport({ message, contact }) {
  const msg = (message || '').trim()
  if (msg.length < 5) return { ok: false, error: 'Contanos un poco más (mín. 5 caracteres)' }
  const { id } = getAuthUser() || {}
  const { error } = await supabase.from('bug_reports').insert([{
    user_id: id || null,
    message: msg.slice(0, 2000),
    contact: (contact || '').trim().slice(0, 200) || null,
    url: (typeof location !== 'undefined' ? location.href : '') || null,
    user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : '') || null,
  }])
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Admin ── (requiere policies de admin en bug_reports, ver el .sql)
export async function getBugReports(limit = 200) {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('id, user_id, message, contact, url, user_agent, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

export async function setBugReportStatus(id, status) {
  const { error } = await supabase.from('bug_reports').update({ status }).eq('id', id)
  return { ok: !error, error }
}
