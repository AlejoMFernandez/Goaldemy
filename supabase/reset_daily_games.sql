-- Script para borrar TODAS las sesiones de juego del día actual
-- Útil para testing: permite volver a jugar todos los juegos del modo Challenge

-- Reemplazá 'YOUR_USER_ID' con tu user_id real
-- Para obtener tu user_id, podés ejecutar: SELECT auth.uid();

delete from public.game_sessions
where user_id = 'e31529d9-ea18-4da1-9792-69756316df24'
  and started_at >= current_date;

-- Si querés borrar solo juegos específicos, usá esto en su lugar:
-- delete from public.game_sessions
-- where user_id = 'e31529d9-ea18-4da1-9792-69756316df24'
--   and game_id in (select id from public.games where slug in ('shirt-number', 'guess-player', 'nationality'))
--   and started_at >= current_date;
