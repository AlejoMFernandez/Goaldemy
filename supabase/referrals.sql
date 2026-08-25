-- ════════════════════════════════════════════════════════════
--  REFERIDOS — invitá a un amigo y ganen los dos
-- ════════════════════════════════════════════════════════════
--  Cierra el hueco marcado en el informe de mercado: el botón de "Compartir
--  resultado" ya existía (services/share.js) pero no daba nada a cambio.
--  Ahora cada usuario tiene un código propio; quien lo usa al registrarse
--  le da Fichas a los dos (server-side, idempotente, anti-abuso básico).
--
--  Correr en el SQL Editor de Supabase. Requiere award_fichas() (definida
--  en mejoras11-currency-shop.sql).
-- ════════════════════════════════════════════════════════════

-- Código propio de cada usuario (se muestra en el link de invitación) y
-- registro de quién lo invitó (solo para analítica, la recompensa se
-- controla con referral_claims más abajo).
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS referral_code text,
ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_referral_code
ON public.user_profiles(referral_code);

-- Genera un código corto (8 chars, base36) sin colisionar con uno existente.
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  LOOP
    code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END$$;

-- Autoasigna un código al crear el perfil (si no vino uno ya seteado).
CREATE OR REPLACE FUNCTION public.set_referral_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_set_referral_code ON public.user_profiles;
CREATE TRIGGER trg_set_referral_code
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_referral_code_on_insert();

-- Backfill: usuarios que ya existían antes de este cambio.
UPDATE public.user_profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- Registro de recompensas otorgadas (1 por usuario referido, para siempre).
CREATE TABLE IF NOT EXISTS public.referral_claims (
  referred_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fichas_referrer INTEGER NOT NULL,
  fichas_referred INTEGER NOT NULL,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_claims read own" ON public.referral_claims;
CREATE POLICY "referral_claims read own" ON public.referral_claims
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = referred_id OR (select auth.uid()) = referrer_id);

-- RPC: el usuario recién logueado reclama la recompensa por haber entrado
-- con el código de un amigo. Se llama una sola vez por cuenta (PK en la tabla).
CREATE OR REPLACE FUNCTION public.claim_referral(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          UUID := auth.uid();
  v_referrer   UUID;
  v_fichas_ref INTEGER := 150; -- Fichas para quien invitó
  v_fichas_new INTEGER := 80;  -- Fichas de bienvenida para quien se sumó
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'auth');
  END IF;

  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'no_code');
  END IF;

  SELECT id INTO v_referrer
  FROM public.user_profiles
  WHERE referral_code = upper(btrim(p_code));

  IF v_referrer IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_referrer = uid THEN
    RETURN json_build_object('ok', false, 'error', 'self');
  END IF;

  BEGIN
    INSERT INTO public.referral_claims (referred_id, referrer_id, fichas_referrer, fichas_referred)
      VALUES (uid, v_referrer, v_fichas_ref, v_fichas_new);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END;

  UPDATE public.user_profiles SET referred_by = v_referrer WHERE id = uid AND referred_by IS NULL;

  PERFORM public.award_fichas(v_referrer, v_fichas_ref, 'referral_bonus', json_build_object('referred_id', uid)::jsonb);
  PERFORM public.award_fichas(uid, v_fichas_new, 'referral_welcome', json_build_object('referrer_id', v_referrer)::jsonb);

  RETURN json_build_object('ok', true, 'fichas_referrer', v_fichas_ref, 'fichas_referred', v_fichas_new);
END$$;

REVOKE ALL ON FUNCTION public.claim_referral(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(TEXT) TO authenticated;

-- RPC: cuántos amigos trajo el usuario actual (para mostrar en su perfil).
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'referral_code', (SELECT referral_code FROM public.user_profiles WHERE id = auth.uid()),
    'invited_count', (SELECT count(*) FROM public.referral_claims WHERE referrer_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.get_referral_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;
