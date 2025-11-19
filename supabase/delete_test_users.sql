-- Script para eliminar usuarios de prueba y todos sus datos relacionados
-- ADVERTENCIA: Este script es DESTRUCTIVO. Revisa bien qué usuarios vas a eliminar.

-- ==============================================================================
-- PASO 1: Identifica los usuarios que quieres eliminar
-- ==============================================================================

-- Ver todos los usuarios (revisa cuáles son de prueba)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- ==============================================================================
-- PASO 2: Eliminar datos relacionados de usuarios específicos
-- ==============================================================================

DO $$
DECLARE
  users_to_delete TEXT[] := ARRAY[
    'aad00d3a-dac1-4fff-8421-2161a554d32c',
    '95fe35bd-9990-4aa8-8473-7098b68fc46a',
    'e90dc5a6-b37a-487d-8100-7e71dc2f0957',
    '1c71192f-73ce-4a44-9c36-2cc3d642828a',
    '2c2c4844-fd16-42f1-aec1-6fd4ad60ccc3',
    '2ec8865d-05fb-40b6-85cf-a90c7c5341d1',
    'fd468a2f-aba4-4458-9766-58affae823ba',
    'ea2716ae-faee-49ba-b5b5-cfe424bb3522',
    'de77e59a-cda3-4574-acd0-9cbe1141b6c7',
    '7ed4e300-7936-4588-a3d5-b6eb77c1a170',
    '7febd321-bc50-42e4-a195-15a9fbe01569',
    '8ea86fde-3a4b-41b1-b1a3-1629d0f67586',
    'd9565c4b-34e3-4575-b7da-94036f455400',
    '220e5717-5c04-4f2a-94a8-c8eb81217f68',
    'cfbcbd2a-ca80-46ef-a187-8cc6a36839c2'
  ];
  target_user_id TEXT;
BEGIN
  FOREACH target_user_id IN ARRAY users_to_delete
  LOOP
    RAISE NOTICE 'Eliminando datos de usuario: %', target_user_id;

    -- 1. Eliminar mensajes directos (enviados y recibidos)
    DELETE FROM direct_messages 
    WHERE sender_id = target_user_id::uuid OR recipient_id = target_user_id::uuid;
    
    -- 2. Eliminar mensajes del chat global
    DELETE FROM global_chat_messages 
    WHERE sender_id = target_user_id::uuid;
    
    -- 3. Eliminar XP events
    DELETE FROM xp_events 
    WHERE user_id = target_user_id::uuid;
    
    -- 4. Eliminar sesiones de juegos
    DELETE FROM game_sessions 
    WHERE user_id = target_user_id::uuid;
    
    -- 5. Eliminar notificaciones
    DELETE FROM notifications 
    WHERE to_user = target_user_id::uuid OR from_user = target_user_id::uuid;
    
    -- 6. Eliminar conexiones/amistades
    DELETE FROM connections 
    WHERE user_a = target_user_id::uuid OR user_b = target_user_id::uuid;
    
    -- 7. Eliminar logros desbloqueados
    DELETE FROM user_achievements 
    WHERE user_id = target_user_id::uuid;
    
    -- 8. Eliminar registros de news (tabla externa al proyecto)
    DELETE FROM news 
    WHERE sender_id = target_user_id::uuid;
    
    -- 9. Eliminar perfil público
    DELETE FROM user_profiles 
    WHERE id = target_user_id::uuid;
    
    -- 10. Eliminar de auth.users (esto también elimina identities automáticamente)
    DELETE FROM auth.users 
    WHERE id = target_user_id::uuid;
    
    RAISE NOTICE 'Usuario % eliminado completamente', target_user_id;
  END LOOP;
END $$;
