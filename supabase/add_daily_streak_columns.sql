-- Agregar columnas para daily login streak
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_daily_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_date date;

-- Comentario: last_login_date se usa para detectar si el usuario se loguea días consecutivos
-- daily_streak: racha actual de días consecutivos
-- best_daily_streak: mejor racha histórica
