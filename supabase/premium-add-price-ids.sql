-- Agrega columnas para los IDs de precio de cada proveedor de pago
-- Correr DESPUES de premium-schema.sql

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mp_preapproval_plan_id TEXT;

-- Despues de crear los productos en Stripe y Mercado Pago, actualizar:
-- UPDATE public.plans SET stripe_price_id = 'price_xxxxx' WHERE slug = 'pro';
-- UPDATE public.plans SET stripe_price_id = 'price_yyyyy' WHERE slug = 'legend';
-- UPDATE public.plans SET mp_preapproval_plan_id = 'xxx' WHERE slug = 'pro';
-- UPDATE public.plans SET mp_preapproval_plan_id = 'yyy' WHERE slug = 'legend';
