-- Da powerups de prueba a una cuenta para testear
-- Correr en Supabase SQL Editor
-- Reemplazar el email si es necesario

DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'sergiosafer@gmail.com';

  IF uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  INSERT INTO public.powerup_inventory (user_id, fifty_fifty, shield, extra_time, reveal_hint)
  VALUES (uid, 10, 10, 10, 10)
  ON CONFLICT (user_id) DO UPDATE SET
    fifty_fifty = 10,
    shield = 10,
    extra_time = 10,
    reveal_hint = 10;

  RAISE NOTICE 'Powerups cargados: 10 de cada tipo para %', uid;
END $$;
