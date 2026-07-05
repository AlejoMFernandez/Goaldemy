-- ============================================================
-- GOALDEMY — MEJORAS11: DOBLE MONEDA + TIENDA
--
-- Moneda BLANDA "Fichas": grindeable. Se gana por ganar juegos,
--   retos diarios, recompensa diaria, pase (gratis + premium),
--   logros y retos progresivos. Se engancha en dos únicos puntos:
--     • award_xp   → mapea reason→fichas (cubre retos/pase/logros/prog.)
--     • report_game_result → +fichas al GANAR un juego.
-- Moneda DURA "Balón de Oro": SOLO con plata real (modelo LoL RP).
--   No se gana jugando. Se carga por top-up (futuro MP) o admin.
--
-- Tienda de cosméticos: cada ítem tiene precio en Fichas y/o Balones.
-- Comprar entrega el cosmético (grant_cosmetic) y descuenta saldo,
-- todo atómico + registrado en el ledger.
--
-- Correr DESPUÉS de mejoras7-pass-timezone.sql. Idempotente.
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  1. BILLETERA + LEDGER
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_wallet (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fichas     INTEGER NOT NULL DEFAULT 0,   -- moneda blanda
  balones    INTEGER NOT NULL DEFAULT 0,   -- moneda dura (Balón de Oro)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.currency_ledger (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency   TEXT NOT NULL CHECK (currency IN ('fichas','balones')),
  delta      INTEGER NOT NULL,             -- + gana / - gasta
  reason     TEXT NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON public.currency_ledger(user_id, created_at DESC);

ALTER TABLE public.user_wallet     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Wallet read own" ON public.user_wallet;
DROP POLICY IF EXISTS "Ledger read own" ON public.currency_ledger;
CREATE POLICY "Wallet read own" ON public.user_wallet     FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Ledger read own" ON public.currency_ledger FOR SELECT USING (auth.uid() = user_id);
-- La escritura va sólo por funciones SECURITY DEFINER (abajo).


-- ════════════════════════════════════════════════════════════
--  2. HELPERS INTERNOS (no exponer a clientes)
-- ════════════════════════════════════════════════════════════

-- Suma Fichas (moneda blanda). p_amount debe ser > 0 (ganado).
CREATE OR REPLACE FUNCTION public.award_fichas(p_uid UUID, p_amount INTEGER, p_reason TEXT, p_meta JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_uid IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.user_wallet (user_id, fichas) VALUES (p_uid, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET fichas = public.user_wallet.fichas + p_amount, updated_at = now();
  INSERT INTO public.currency_ledger (user_id, currency, delta, reason, meta)
    VALUES (p_uid, 'fichas', p_amount, p_reason, COALESCE(p_meta, '{}'::jsonb));
END$$;

-- Suma Balones (moneda dura). Sólo top-up con plata real / admin.
CREATE OR REPLACE FUNCTION public.add_balones(p_uid UUID, p_amount INTEGER, p_reason TEXT, p_meta JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_uid IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.user_wallet (user_id, balones) VALUES (p_uid, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balones = public.user_wallet.balones + p_amount, updated_at = now();
  INSERT INTO public.currency_ledger (user_id, currency, delta, reason, meta)
    VALUES (p_uid, 'balones', p_amount, p_reason, COALESCE(p_meta, '{}'::jsonb));
END$$;

-- Blindaje: que ningún cliente pueda auto-regalarse monedas.
REVOKE ALL ON FUNCTION public.award_fichas(UUID, INTEGER, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_balones(UUID, INTEGER, TEXT, JSONB) FROM PUBLIC;


-- ════════════════════════════════════════════════════════════
--  3. ENGANCHE DE GANADO DE FICHAS
-- ════════════════════════════════════════════════════════════

-- (A) Trigger sobre xp_events: cada XP otorgado da Fichas según su motivo.
-- No tocamos award_xp (evita el error de "cambiar tipo de retorno" y no
-- depende de su firma). correct_answer (respuesta suelta) NO da Fichas
-- para no inflar la economía.
CREATE OR REPLACE FUNCTION public.trg_xp_to_fichas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fichas int;
BEGIN
  v_fichas := CASE NEW.reason
    WHEN 'daily_challenge'       THEN 15
    WHEN 'daily_reward'          THEN 10
    WHEN 'monthly_pass'          THEN 20
    WHEN 'achievement'           THEN 25
    WHEN 'progressive_challenge' THEN 40
    ELSE 0
  END;
  IF v_fichas > 0 AND NEW.user_id IS NOT NULL THEN
    PERFORM public.award_fichas(NEW.user_id, v_fichas, 'xp:' || NEW.reason, COALESCE(NEW.meta, '{}'::jsonb));
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS xp_to_fichas ON public.xp_events;
CREATE TRIGGER xp_to_fichas
  AFTER INSERT ON public.xp_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_xp_to_fichas();

-- (B) report_game_result: mismo cuerpo (mejoras7) + Fichas al GANAR.
CREATE OR REPLACE FUNCTION public.report_game_result(p_game_slug TEXT, p_won BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_today DATE := public.app_today();
  v_month DATE := date_trunc('month', public.app_today())::date;
  v_pts INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  -- (1) Retos diarios
  PERFORM public.ensure_daily_challenges(uid);
  UPDATE public.user_daily_challenges udc
  SET progress = LEAST(udc.target, udc.progress + 1)
  FROM public.daily_challenges dc
  WHERE udc.user_id = uid AND udc.day = v_today AND udc.claimed = false
    AND dc.code = udc.challenge_code
    AND ( dc.goal_type = 'play_any'
       OR (dc.goal_type = 'win_any' AND p_won)
       OR (dc.goal_type = 'win_game' AND p_won AND dc.goal_game = p_game_slug) );

  -- (2) Pase mensual
  v_pts := CASE WHEN p_won THEN 3 ELSE 1 END;
  INSERT INTO public.user_monthly_pass (user_id, month, points)
    VALUES (uid, v_month, v_pts)
    ON CONFLICT (user_id, month) DO UPDATE SET points = public.user_monthly_pass.points + v_pts;

  -- (3) Retos progresivos
  PERFORM public.ensure_progressive_challenges(uid);
  UPDATE public.user_progressive_progress upp
  SET progress = upp.progress + 1
  FROM public.progressive_challenges pc
  WHERE upp.user_id = uid AND pc.code = upp.code AND pc.active
    AND ( pc.goal_type = 'play_any'
       OR (pc.goal_type = 'win_any' AND p_won)
       OR (pc.goal_type = 'win_game' AND p_won AND pc.goal_game = p_game_slug) );

  -- (4) Fichas por ganar (moneda blanda)
  IF p_won THEN
    PERFORM public.award_fichas(uid, 10, 'game_win', json_build_object('game', p_game_slug)::jsonb);
  END IF;
END$$;
GRANT EXECUTE ON FUNCTION public.report_game_result(TEXT, BOOLEAN) TO authenticated;


-- ════════════════════════════════════════════════════════════
--  4. TIENDA
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.shop_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cosmetic_code TEXT NOT NULL UNIQUE REFERENCES public.cosmetics(code) ON DELETE CASCADE,
  price_fichas  INTEGER,   -- NULL = no comprable con Fichas
  price_balones INTEGER,   -- NULL = no comprable con Balones
  featured      BOOLEAN NOT NULL DEFAULT false,
  active        BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (price_fichas IS NOT NULL OR price_balones IS NOT NULL)
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop public read"  ON public.shop_items;
DROP POLICY IF EXISTS "Shop admin write"  ON public.shop_items;
CREATE POLICY "Shop public read" ON public.shop_items FOR SELECT USING (true);
CREATE POLICY "Shop admin write" ON public.shop_items
  FOR ALL
  USING      (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'))
  WITH CHECK (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── Seed inicial: cosméticos NO exclusivos del pase/logro ──
-- No-premium → precio en Fichas por rareza. Premium → sólo Balones.
-- Excluye unlock_level >= 999 (exclusivos de pase/logros).
INSERT INTO public.shop_items (cosmetic_code, price_fichas, price_balones, featured, sort_order)
SELECT c.code,
  CASE WHEN c.premium_only THEN NULL
       ELSE (CASE c.rarity WHEN 'common' THEN 200 WHEN 'rare' THEN 500 WHEN 'epic' THEN 1200 ELSE 2500 END) END,
  CASE WHEN c.premium_only
       THEN (CASE c.rarity WHEN 'rare' THEN 80 WHEN 'epic' THEN 150 WHEN 'legendary' THEN 300 ELSE 60 END)
       ELSE NULL END,
  (c.rarity = 'legendary'),
  c.sort_order
FROM public.cosmetics c
WHERE c.active AND c.unlock_level < 999
ON CONFLICT (cosmetic_code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  5. RPCs PÚBLICAS (billetera / tienda / compra)
-- ════════════════════════════════════════════════════════════

-- Saldo del usuario.
CREATE OR REPLACE FUNCTION public.get_wallet()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); w RECORD;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('fichas', 0, 'balones', 0); END IF;
  SELECT * INTO w FROM public.user_wallet WHERE user_id = uid;
  RETURN json_build_object('fichas', COALESCE(w.fichas, 0), 'balones', COALESCE(w.balones, 0));
END$$;
GRANT EXECUTE ON FUNCTION public.get_wallet() TO authenticated;

-- Catálogo de la tienda + flag de "ya lo tengo".
CREATE OR REPLACE FUNCTION public.get_shop()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); result JSON;
BEGIN
  SELECT COALESCE(json_agg(t ORDER BY t.featured DESC, t.sort_order, t.name), '[]'::json) INTO result
  FROM (
    SELECT s.id, s.cosmetic_code, s.price_fichas, s.price_balones, s.featured, s.sort_order,
           c.type, c.name, c.rarity, c.style_key, c.premium_only,
           EXISTS(SELECT 1 FROM public.user_cosmetics uc WHERE uc.user_id = uid AND uc.cosmetic_code = s.cosmetic_code) AS owned
    FROM public.shop_items s
    JOIN public.cosmetics c ON c.code = s.cosmetic_code
    WHERE s.active
  ) t;
  RETURN result;
END$$;
GRANT EXECUTE ON FUNCTION public.get_shop() TO authenticated;

-- Compra un ítem con la moneda elegida ('fichas' | 'balones').
CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_item_id UUID, p_currency TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid   UUID := auth.uid();
  it    RECORD;
  price INTEGER;
  bal   INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  IF p_currency NOT IN ('fichas','balones') THEN RETURN json_build_object('ok', false, 'error', 'bad_currency'); END IF;

  SELECT * INTO it FROM public.shop_items WHERE id = p_item_id AND active;
  IF it IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;

  IF EXISTS(SELECT 1 FROM public.user_cosmetics WHERE user_id = uid AND cosmetic_code = it.cosmetic_code) THEN
    RETURN json_build_object('ok', false, 'error', 'already_owned');
  END IF;

  price := CASE WHEN p_currency = 'fichas' THEN it.price_fichas ELSE it.price_balones END;
  IF price IS NULL THEN RETURN json_build_object('ok', false, 'error', 'currency_not_accepted'); END IF;

  -- Asegura fila de billetera y bloquea para descuento atómico.
  INSERT INTO public.user_wallet (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT CASE WHEN p_currency = 'fichas' THEN fichas ELSE balones END INTO bal
    FROM public.user_wallet WHERE user_id = uid FOR UPDATE;

  IF bal < price THEN RETURN json_build_object('ok', false, 'error', 'insufficient', 'balance', bal, 'price', price); END IF;

  IF p_currency = 'fichas' THEN
    UPDATE public.user_wallet SET fichas = fichas - price, updated_at = now() WHERE user_id = uid;
  ELSE
    UPDATE public.user_wallet SET balones = balones - price, updated_at = now() WHERE user_id = uid;
  END IF;

  INSERT INTO public.currency_ledger (user_id, currency, delta, reason, meta)
    VALUES (uid, p_currency, -price, 'shop_purchase', json_build_object('item', p_item_id, 'cosmetic', it.cosmetic_code)::jsonb);

  PERFORM public.grant_cosmetic(uid, it.cosmetic_code);

  RETURN json_build_object('ok', true, 'cosmetic', it.cosmetic_code, 'currency', p_currency, 'spent', price);
END$$;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(UUID, TEXT) TO authenticated;


-- ════════════════════════════════════════════════════════════
--  6. ADMIN: cargar monedas a un usuario (soporte / top-up manual)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_grant_currency(p_target UUID, p_currency TEXT, p_amount INTEGER)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_currency = 'fichas' THEN
    PERFORM public.award_fichas(p_target, p_amount, 'admin_grant', '{}'::jsonb);
  ELSIF p_currency = 'balones' THEN
    PERFORM public.add_balones(p_target, p_amount, 'admin_grant', '{}'::jsonb);
  ELSE
    RETURN json_build_object('ok', false, 'error', 'bad_currency');
  END IF;
  RETURN json_build_object('ok', true);
END$$;
GRANT EXECUTE ON FUNCTION public.admin_grant_currency(UUID, TEXT, INTEGER) TO authenticated;
