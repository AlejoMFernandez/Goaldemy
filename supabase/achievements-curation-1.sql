-- Curaduría de logros (retiro de logros redundantes/de relleno, fusión de horarios,
-- renombres para mayor claridad). Safe to run multiple times.

-- 1) Columna para retirar logros sin borrar el historial de quien ya los tiene.
alter table public.achievements add column if not exists active boolean not null default true;

-- 2) Retirar: daily_wins_3 (fusionado en hat_trick), early_bird (fusionado en night_owl),
--    weekend_warrior (cortado: no premiaba mérito futbolístico, solo día de la semana).
update public.achievements set active = false
where code in ('daily_wins_3', 'early_bird', 'weekend_warrior');

-- 3) Backfill: nadie pierde su trofeo por la fusión. Quien ya tenía daily_wins_3
--    pero no hat_trick, recibe hat_trick con la fecha original (sin XP extra: ya la ganó).
insert into public.user_achievements (user_id, achievement_id, earned_at, metadata)
select ua.user_id, ha.id, ua.earned_at, ua.metadata
from public.user_achievements ua
join public.achievements da on da.id = ua.achievement_id and da.code = 'daily_wins_3'
join public.achievements ha on ha.code = 'hat_trick'
on conflict (user_id, achievement_id) do nothing;

-- 4) night_owl absorbe la ventana horaria de early_bird (00:00–08:00).
update public.achievements
set description = 'Jugá entre las 00:00 y las 08:00'
where code = 'night_owl';

-- 5) Renombres para que se entiendan sin leer la descripción.
update public.achievements set name = 'Bicampeón' where code = 'streak_dual_100';
update public.achievements set name = 'Rey de la semana' where code = 'daily_super_5x3';

-- 6) Cosméticos exclusivos que quedaban huérfanos (nadie los tenía aún):
--    Amanecer (early_bird) → night_owl; Espada (weekend_warrior) → centurion.
update public.cosmetics set unlock_achievement = 'night_owl' where code = 'icon_sun';
update public.cosmetics set unlock_achievement = 'centurion' where code = 'icon_sword';
