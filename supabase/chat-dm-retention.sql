-- ════════════════════════════════════════════════════════════
--  CHAT DE AMIGOS — retención de 48h + logro "Charlatán" (chat_master)
-- ════════════════════════════════════════════════════════════
--  Contexto: direct_messages va a purgarse cada tanto (estilo LoL) para no
--  explotar la base de datos. El logro "chat_master" (100 mensajes) ANTES
--  contaba filas de global_chat_messages (una tabla vieja, sin uso real,
--  nunca conectada a este chat). Acá se arregla:
--
--   1) user_profiles.direct_messages_sent_count → contador que SOLO SUMA,
--      incrementado por trigger en cada INSERT. Al purgar mensajes viejos
--      el contador NO se toca (la purga borra filas, no decrementa nada),
--      así el logro queda a prueba de la limpieza automática.
--   2) Trigger AFTER INSERT en direct_messages → incrementa el contador.
--   3) _purge_old_direct_messages() → borra mensajes con más de 48hs.
--   4) Backfill del contador con los mensajes ya existentes.
--   5) pg_cron corriendo la purga cada hora, en vivo.
--
--  Ya se aplicó en producción (proyecto FULVO) vía Supabase MCP, 2026-09-22.
--  Este archivo queda como fuente de verdad / referencia — todo acá es
--  idempotente (CREATE OR REPLACE, DROP IF EXISTS, cron.schedule con el mismo
--  jobname pisa el job anterior), así que correrlo de nuevo no rompe nada.
-- ════════════════════════════════════════════════════════════

-- 1) Contador persistente en el perfil
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS direct_messages_sent_count integer NOT NULL DEFAULT 0;

-- 2) Trigger: cada mensaje directo enviado suma 1, para siempre
CREATE OR REPLACE FUNCTION public._dm_bump_sent_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET direct_messages_sent_count = direct_messages_sent_count + 1
  WHERE id = NEW.sender_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dm_bump_sent_count ON public.direct_messages;
CREATE TRIGGER trg_dm_bump_sent_count
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public._dm_bump_sent_count();

-- Postgres dispara el trigger igual sin este grant (no depende de que el rol que
-- hace el INSERT tenga EXECUTE); esto solo cierra la puerta a que alguien la llame
-- directo como RPC (PostgREST expone toda función SECURITY DEFINER por default).
REVOKE ALL ON FUNCTION public._dm_bump_sent_count() FROM PUBLIC, authenticated, anon;

-- 3) Purga: borra mensajes directos con más de 48 horas de antigüedad.
--    SECURITY DEFINER + search_path fijo (convención del resto de estas
--    funciones acá) para que corra segura vía cron sin depender de RLS.
CREATE OR REPLACE FUNCTION public._purge_old_direct_messages(p_older_than interval DEFAULT interval '48 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.direct_messages
  WHERE created_at < now() - p_older_than;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public._purge_old_direct_messages(interval) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public._purge_old_direct_messages(interval) TO service_role;

-- 4) Backfill: al agregar la columna todos arrancan en 0. Le seteamos el valor
--    real (mensajes ya mandados hasta hoy) para no atrasar el logro a nadie.
UPDATE public.user_profiles p
SET direct_messages_sent_count = sub.cnt
FROM (
  SELECT sender_id, count(*) AS cnt
  FROM public.direct_messages
  GROUP BY sender_id
) sub
WHERE p.id = sub.sender_id;

-- 5) Auto-purga cada hora con pg_cron (el proyecto ya tiene la extensión activa).
--    jobid queda visible en cron.job / cron.job_run_details.
SELECT cron.schedule(
  'purge-old-direct-messages',
  '0 * * * *',
  $$SELECT public._purge_old_direct_messages()$$
);
