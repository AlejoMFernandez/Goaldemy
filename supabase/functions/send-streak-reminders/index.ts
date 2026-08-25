// Envía el email "tu racha se corta hoy" a los usuarios que jugaron ayer y
// todavía no jugaron hoy. Pensada para dispararse una vez por día vía pg_cron
// (ver el bloque comentado al final de supabase/streak-reminder.sql).
//
// Secrets necesarios (Project Settings > Edge Functions > Secrets):
//   RESEND_API_KEY      - cuenta en resend.com con un dominio verificado
//   STREAK_EMAIL_FROM    - ej: "Goaldemy <hola@tudominio.com>" (debe matchear el dominio de Resend)
//   FRONTEND_URL          - ej: https://goaldemy.vercel.app (para el botón "Jugar ahora")
//   CRON_SECRET           - string cualquiera; el mismo valor va en el header del cron
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen inyectados automáticamente.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goaldemy-cron-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret && req.headers.get('x-goaldemy-cron-secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY no configurado')
    const from = Deno.env.get('STREAK_EMAIL_FROM') || 'Goaldemy <onboarding@resend.dev>'
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://goaldemy.vercel.app'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: targets, error } = await supabase.rpc('get_streak_reminder_targets')
    if (error) throw error

    let sent = 0
    let failed = 0
    const today = new Date().toISOString().slice(0, 10)

    for (const t of targets || []) {
      const ok = await sendReminderEmail({ resendKey, from, frontendUrl, to: t.email, name: t.display_name, streak: t.daily_streak })
      if (ok) {
        sent++
        await supabase.from('streak_reminder_log').insert({ user_id: t.user_id, day_key: today })
      } else {
        failed++
      }
    }

    return new Response(JSON.stringify({ ok: true, total: (targets || []).length, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-streak-reminders error:', e)
    return new Response(JSON.stringify({ error: e.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function sendReminderEmail({ resendKey, from, frontendUrl, to, name, streak }: {
  resendKey: string; from: string; frontendUrl: string; to: string; name: string | null; streak: number
}): Promise<boolean> {
  const firstName = (name || 'crack').split(' ')[0]
  const subject = `🔥 Tu racha de ${streak} días se corta hoy`
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; background:#0f172a; color:#e2e8f0; border-radius:16px; overflow:hidden;">
      <div style="padding: 28px 28px 8px;">
        <p style="font-size:13px; letter-spacing:0.06em; text-transform:uppercase; color:#fbbf24; font-weight:700; margin:0 0 12px;">GOALDEMY ⚽</p>
        <h1 style="font-size:22px; margin:0 0 12px; color:#fff;">¡Che ${firstName}, no dejes que se corte!</h1>
        <p style="font-size:15px; line-height:1.6; color:#cbd5e1; margin:0 0 20px;">
          Llevás <strong style="color:#fbbf24;">${streak} días seguidos</strong> jugando en Goaldemy.
          Si hoy no jugás al menos un desafío, mañana arrancás de cero.
        </p>
        <a href="${frontendUrl}/play/points" style="display:inline-block; background:linear-gradient(90deg,#f59e0b,#d97706); color:#0f172a; font-weight:800; text-decoration:none; padding:12px 24px; border-radius:12px; font-size:14px;">
          Jugar ahora y mantener la racha
        </a>
        <p style="font-size:12px; color:#64748b; margin:28px 0 0;">
          Recibiste este email porque tenés una racha activa en Goaldemy.
        </p>
      </div>
    </div>
  `.trim()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    console.error('resend error:', await res.text())
    return false
  }
  return true
}
