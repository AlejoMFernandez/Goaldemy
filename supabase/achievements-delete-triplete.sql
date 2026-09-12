-- Triplete (daily_wins_3) duplicaba a Hat-trick (hat_trick) — ya estaba retirado
-- (active=false, ver achievements-curation-1.sql) pero 3 usuarios lo tenían
-- desbloqueado desde antes y seguía apareciendo en su perfil. Se borra del todo:
-- no se pierde el XP ya otorgado (award_xp es un ledger aparte), solo deja de
-- figurar como logro conseguido.
-- Ejecutado ya en producción (2026-09-03). Este archivo queda como registro.
delete from public.user_achievements where achievement_id = (select id from public.achievements where code = 'daily_wins_3');
delete from public.achievements where code = 'daily_wins_3';
