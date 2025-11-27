-- Agregar columna role a la tabla user_profiles
-- Solo puede ser 'user' o 'admin'
-- Por defecto todos son 'user'

-- Agregar columna role si no existe
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Setear alejo@gmail.com como admin
-- Primero necesitamos encontrar el user_id de alejo@gmail.com
UPDATE user_profiles 
SET role = 'admin' 
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'alejo@gmail.com'
);

-- Crear índice para búsquedas por role
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Nota: NO creamos políticas RLS específicas para admins aquí
-- porque causarían recursión infinita al verificar el rol en la misma tabla.
-- La verificación de admin se hace a nivel de aplicación con la función isAdmin()
-- que ya maneja correctamente las consultas sin causar loops.
