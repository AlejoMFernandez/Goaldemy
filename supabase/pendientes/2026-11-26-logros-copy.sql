-- ════════════════════════════════════════════════════════════════════
--  2026-11-26 — LOGROS: COPY RIOPLATENSE ("cromos" → "jugadores")
-- ════════════════════════════════════════════════════════════════════
--  QUÉ: cambia "cromos" por "jugadores" en la descripción del logro Scout
--       (y en cualquier otro que lo tenga). Idempotente.
--  POR QUÉ: "cromo" es de España; FULVO habla en rioplatense. El cliente ya
--       lo reemplaza al mostrar (services/achievements.js → fixAchievementCopy).
--  ROLLBACK: update public.achievements set description = replace(description, 'jugadores seguidos en Duelo', 'cromos seguidos en Duelo') where code = 'scout';
-- ════════════════════════════════════════════════════════════════════
update public.achievements
set description = regexp_replace(description, '\mcromos\M', 'jugadores', 'g')
where description ~ '\mcromos\M';

update public.achievements
set name = regexp_replace(name, '\mcromos\M', 'jugadores', 'g')
where name ~ '\mcromos\M';
