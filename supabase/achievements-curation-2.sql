-- Curaduría de logros #2: los de la primera partida saturaban a las cuentas
-- nuevas. Retira los más triviales/redundantes de la primera sesión y renombra
-- comeback_king a "Revancha" (ahora es un comeback entre días, no dentro del
-- juego). Safe to run multiple times. No borra filas de user_achievements:
-- quien ya tiene alguno de estos logros lo conserva (ver achievements.js:
-- getUserAchievements no filtra por active).

-- 1) Retirar logros de la primera partida que saturaban a cuentas nuevas:
--    first_correct (primera respuesta correcta), streak_3 (3 aciertos seguidos,
--    ya cubierto en la práctica por streak_5+), ten_correct (10 correctas en
--    una sesión), night_owl (jugar de madrugada).
update public.achievements set active = false
where code in ('first_correct', 'streak_3', 'ten_correct', 'night_owl');

-- 2) El cosmético icon_sun (Amanecer) quedaba atado a night_owl (curation-1);
--    ahora se desbloquea con daily_streak_7 para no depender de un logro retirado.
update public.cosmetics set unlock_achievement = 'daily_streak_7' where code = 'icon_sun';

-- 3) comeback_king pasa a llamarse "Revancha": ya no es ganar tras 3 errores
--    seguidos dentro del juego, sino ganar hoy un juego que se había perdido
--    ayer (ver checkComebackKingAchievement en achievement-triggers.js).
--    Mantiene código, rareza (cliente) y XP (points) sin cambios.
update public.achievements
set name = 'Revancha',
    description = 'Ganá un juego que perdiste el día anterior'
where code = 'comeback_king';
