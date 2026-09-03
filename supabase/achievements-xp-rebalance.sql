-- Rebalance de XP: varios logros pagaban muy poco para lo que exigen
-- (grinding largo o resultados muy difíciles). Solo se tocan los 9 casos
-- desproporcionados; el resto de la tabla queda igual.
update public.achievements set points = 65  where code = 'streak_10';        -- 50 -> 65
update public.achievements set points = 140 where code = 'streak_15';       -- 80 -> 140 (15 aciertos seguidos)
update public.achievements set points = 180 where code = 'daily_wins_all'; -- 100 -> 180 (ganar TODOS los juegos del día)
update public.achievements set points = 90  where code = 'perfectionist'; -- 60 -> 90 (juego entero sin errores)
update public.achievements set points = 70  where code = 'hat_trick';     -- 50 -> 70
update public.achievements set points = 220 where code = 'grand_slam';   -- 150 -> 220 (ganar todo en una semana)
update public.achievements set points = 250 where code = 'centurion';   -- 100 -> 250 (100 victorias totales)
update public.achievements set points = 200 where code = 'streak_dual_100'; -- 150 -> 200 (200 victorias en total)
update public.achievements set points = 220 where code = 'xp_multi_5k_3'; -- 150 -> 220 (15000 XP acumulado)
