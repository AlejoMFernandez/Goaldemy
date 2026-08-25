-- ════════════════════════════════════════════════════════════
--  RACHA EN RIESGO — email de reactivación
-- ════════════════════════════════════════════════════════════
--  Cierra otro hueco del informe de mercado: la racha diaria (daily_streak,
--  last_activity_date en user_profiles) ya existe, pero si el usuario no
--  vuelve por su cuenta nadie se lo recuerda. Este script agrega:
--
--   1) streak_reminder_log        -> evita mandar el mismo día dos veces
--   2) get_streak_reminder_targets() -> a quién avisar hoy (solo service_role)
--
--  El envío real (Resend) vive en supabase/functions/send-streak-reminders/,
--  y un cron diario (bloque comentado al final) la dispara sola.
--  Correr en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.streak_reminder_log (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day_key)
);

ALTER TABLE public.streak_reminder_log ENABLE ROW LEVEL SECURITY;
-- Sin políticas de lectura: solo el service_role (usado por la Edge Function)
-- accede a esta tabla; RLS bloquea a anon/authenticated por defecto.

-- Candidatos de hoy: jugaron ayer (si no juegan hoy, pierden la racha),
-- tienen 2+ días de racha (no vale la pena molestar por una racha de 1),
-- tienen email, y todavía no se les mandó el aviso hoy.
CREATE OR REPLACE FUNCTION public.get_streak_reminder_targets()
RETURNS TABLE (user_id UUID, email TEXT, display_name TEXT, daily_streak INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.display_name, p.daily_streak
  FROM public.user_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.last_activity_date = (current_date - 1)
    AND COALESCE(p.daily_streak, 0) >= 2
    AND p.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.streak_reminder_log l
      WHERE l.user_id = p.id AND l.day_key = current_date
    );
$$;

-- Solo la Edge Function (con la service role key) puede llamar esto: no tiene
-- sentido exponerlo a usuarios comunes (revelaría emails de otras cuentas).
REVOKE ALL ON FUNCTION public.get_streak_reminder_targets() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_streak_reminder_targets() TO service_role;

-- ─── (OPCIONAL) Disparo automático diario con pg_cron + pg_net ──────────────
-- Requiere las extensiones pg_cron y pg_net habilitadas (Database > Extensions)
-- y la Edge Function send-streak-reminders ya deployada (supabase functions deploy).
-- Completá los 3 valores marcados <> y descomentá. Corre todos los días a las
-- 21:00 ART (00:00 UTC) — a esa hora ya se sabe si alguien "jugó ayer" y todavía
-- le queda la noche para no perder la racha hoy.
--
-- SELECT cron.schedule(
--   'streak-reminder-daily',
--   '0 0 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-streak-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-goaldemy-cron-secret', '<CRON_SECRET>'
--     ),
--     body := '{}'::jsonb
--   )
--   $$
-- );
