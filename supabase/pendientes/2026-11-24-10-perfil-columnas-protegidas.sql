-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-10 — user_profiles: EL CLIENTE NO PUEDE TOCAR role NI COLUMNAS DE SISTEMA
--  (ajustado al esquema REAL de producción leído el 2026-11-26)
-- ════════════════════════════════════════════════════════════════════
--  QUÉ: trigger BEFORE INSERT/UPDATE en user_profiles que, SOLO cuando escribe
--      el cliente (current_user anon/authenticated), conserva el valor viejo de:
--        role, referral_code, referred_by, direct_messages_sent_count,
--        equipped_frame/title/icon/banner/icon_bg
--      En INSERT fuerza role = 'user', referred_by/equipped_* = NULL,
--      direct_messages_sent_count = 0 y un referral_code generado por el servidor.
--      Las RPC SECURITY DEFINER (equip_cosmetic, set_icon_bg, claim_referral,
--      change_user_role_admin, handle_new_user…) corren como su owner → no se ven
--      afectadas.
--
--  POR QUÉ (CRÍTICO): la política real "Users can update own profile" deja
--      escribir CUALQUIER columna de tu fila. Todos los chequeos de admin miran
--      user_profiles.role:
--         supabase.from('user_profiles').update({role:'admin'}).eq('id', miId)
--      = admin → admin_grant_currency, delete_user_admin, etc.
--
--  CLIENTES (grep en main y v4): las únicas escrituras directas son
--      updateUserProfile (datos de perfil), featured_achievements,
--      daily-streak.js (daily_streak/best/last_activity_date) y
--      createUserProfile (id/email/display_name). Los equipped_* se escriben
--      SIEMPRE por RPC (equip_cosmetic / set_icon_bg, también para "Quitar
--      título"), así que se pueden proteger sin romper nada. La racha NO se
--      protege acá (eso es el parche 08, que queda para después).
--      Los cambios prohibidos se ignoran en silencio (no tiran error).
--
--  ROLLBACK:
--      DROP TRIGGER IF EXISTS user_profiles_protect_columns ON public.user_profiles;
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.tg_user_profiles_protect_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Servidor (SECURITY DEFINER, service_role, SQL Editor): sin restricciones.
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role                       := 'user';
    NEW.referred_by                := NULL;
    NEW.direct_messages_sent_count := 0;
    NEW.equipped_frame             := NULL;
    NEW.equipped_title             := NULL;
    NEW.equipped_icon              := NULL;
    NEW.equipped_banner            := NULL;
    NEW.equipped_icon_bg           := NULL;
    -- trg_set_referral_code corre antes (orden alfabético) y respeta un código
    -- que mande el cliente: acá se pisa siempre con uno del servidor.
    NEW.referral_code              := public.generate_referral_code();
  ELSE
    NEW.role                       := OLD.role;
    NEW.referral_code              := OLD.referral_code;
    NEW.referred_by                := OLD.referred_by;
    NEW.direct_messages_sent_count := OLD.direct_messages_sent_count;
    NEW.equipped_frame             := OLD.equipped_frame;
    NEW.equipped_title             := OLD.equipped_title;
    NEW.equipped_icon              := OLD.equipped_icon;
    NEW.equipped_banner            := OLD.equipped_banner;
    NEW.equipped_icon_bg           := OLD.equipped_icon_bg;
  END IF;
  RETURN NEW;
END$$;

REVOKE ALL ON FUNCTION public.tg_user_profiles_protect_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_profiles_protect_columns ON public.user_profiles;
CREATE TRIGGER user_profiles_protect_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_profiles_protect_columns();

COMMIT;

-- Verificación: trigger activo + lista de admins actuales (revisá que sean los que esperás).
SELECT EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'user_profiles_protect_columns'
                 AND tgrelid = 'public.user_profiles'::regclass AND tgenabled <> 'D') AS ok,
       (SELECT string_agg(coalesce(display_name, id::text), ', ') FROM public.user_profiles WHERE role = 'admin') AS admins;
