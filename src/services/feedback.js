/**
 * Reportes de bug enviados por los usuarios desde la sidebar.
 * Guarda en public.bug_reports (ver supabase/mejoras10-bug-reports.sql y
 * supabase/mejoras16-bug-reports-v2.sql para borrado + captura adjunta).
 * Los ves en Supabase (o en el panel admin).
 */
import { supabase } from './supabase'
import { getAuthUser } from './auth'

const IMAGE_BUCKET = 'bug-report-images'

export async function submitBugReport({ message, contact, imageFile }) {
  const msg = (message || '').trim()
  if (msg.length < 5) return { ok: false, error: 'Contanos un poco más (mín. 5 caracteres)' }
  const { id } = getAuthUser() || {}

  let imagePath = null
  if (imageFile && id) {
    const ext = (imageFile.name?.split('.').pop() || 'png').toLowerCase().slice(0, 5)
    const path = `${id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, imageFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: imageFile.type || undefined,
    })
    if (uploadError) return { ok: false, error: 'No se pudo subir la imagen: ' + uploadError.message }
    imagePath = path
  }

  const { error } = await supabase.from('bug_reports').insert([{
    user_id: id || null,
    message: msg.slice(0, 2000),
    contact: (contact || '').trim().slice(0, 200) || null,
    url: (typeof location !== 'undefined' ? location.href : '') || null,
    user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : '') || null,
    image_path: imagePath,
  }])
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Admin ── (requiere policies de admin en bug_reports, ver el .sql)
export async function getBugReports(limit = 200) {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('id, user_id, message, contact, url, user_agent, status, image_path, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

export async function setBugReportStatus(id, status) {
  const { error } = await supabase.from('bug_reports').update({ status }).eq('id', id)
  return { ok: !error, error }
}

export async function deleteBugReport(id, imagePath) {
  if (imagePath) {
    await supabase.storage.from(IMAGE_BUCKET).remove([imagePath])
  }
  const { error } = await supabase.from('bug_reports').delete().eq('id', id)
  return { ok: !error, error }
}

// Signed URL de la captura (bucket privado, 1h de validez).
export async function getBugReportImageUrl(imagePath) {
  if (!imagePath) return null
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(imagePath, 3600)
  if (error) return null
  return data?.signedUrl || null
}
