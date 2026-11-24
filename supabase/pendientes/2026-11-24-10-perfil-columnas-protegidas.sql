-- ════════════════════════════════════════════════════════════════════
--  2026-11-24-10 — user_profiles: EL CLIENTE NO PUEDE TOCAR role NI COLUMNAS DE SISTEMA
--  (hueco NUEVO encontrado durante la revisión, no estaba en la lista)
-- ════════════════════════════════════════════════════════════════════
--  QUÉ: trigger BEFORE INSERT/UPDATE en user_profiles que, SOLO cuando
--      escribe el cliente (anon/authenticated), conserva el valor viejo de:
--        role, referral_code, referred_by, direct_messages_sent_count,
--        equipped_frame/title/icon/banner/icon_bg
--      y en INSERT fuerza role = 'user' y los demás en NULL/0.
--      Las RPC del servidor (equip_cosmetic, set_icon_bg, claim_referral,
--      change_user_role_admin…) son SECURITY DEFINER → no se ven afectadas.
--
--  POR QUÉ (CRÍTICO): la política "Update own profile" permite actualizar
--      CUALQUIER columna de tu propia fila. Todos los chequeos de admin
--      (admin_grant_currency, delete_user_admin, get_users_admin, políticas
--      "admin write" de tienda/pase/cosméticos, lectura de bug reports…)
--      miran user_profiles.role. Entonces:
--         supabase.from('user_profiles').update({role:'admin'}).eq('id', miId)
--         supabase.rpc('admin_grant_currency', {p_target: miId, p_currency:'balones', p_amount: 1e6})
--      = admin + moneda paga infinita + borrar usuarios ajenos.
--      Además: equipped_* directo saltea el chequeo de propiedad de
--      equip_cosmetic (equiparse cosméticos premium sin tenerlos).
--
--  RIESGO: Bajo. El cliente (updateUserProfile / ProfileEdit) no manda esas
--      columnas (verificado). admin.js updateUser() con role tampoco funcionaba
--      para OTROS usuarios (RLS solo deja tu fila); el cambio de rol va por la
--      RPC change_user_role_admin, que sigue andando.
--
--  ROLLBACK:
--      DROP TRIGGER IF EXISTS user_profiles_protect_columns ON public.user_profiles;
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.tg_user_profiles_protect_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  cols TEXT[] := ARRAY['role', 'referral_code', 'referred_by', 'direct_messages_sent_count',
                       'equipped_frame', 'equipped_title', 'equipped_icon', 'equipped_banner', 'equipped_icon_bg'];
  c TEXT;
  j_new JSONB;
  j_old JSONB;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;

  j_new := to_jsonb(NEW);
  IF TG_OP = 'INSERT' THEN
    FOREACH c IN ARRAY cols LOOP
      IF j_new ? c THEN
        j_new := jsonb_set(j_new, ARRAY[c],
                   CASE c WHEN 'role' THEN to_jsonb('user'::text)
                          WHEN 'direct_messages_sent_count' THEN to_jsonb(0)
                          WHEN 'referral_code' THEN COALESCE(j_new->c, 'null'::jsonb)  -- lo genera el trigger de referidos
                          ELSE 'null'::jsonb END);
      END IF;
    END LOOP;
  ELSE
    j_old := to_jsonb(OLD);
    FOREACH c IN ARRAY cols LOOP
      IF j_new ? c THEN
        j_new := jsonb_set(j_new, ARRAY[c], j_old->c);
      END IF;
    END LOOP;
  END IF;

  NEW := jsonb_populate_record(NEW, j_new);
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS user_profiles_protect_columns ON public.user_profiles;
CREATE TRIGGER user_profiles_protect_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_profiles_protect_columns();

COMMIT;

-- Después de aplicar, revisá que los admins sean los que esperás:
--   SELECT id, role FROM public.user_profiles WHERE role = 'admin';
-- Si aparece alguien que no corresponde: UPDATE public.user_profiles SET role='user' WHERE id='<uuid>';
