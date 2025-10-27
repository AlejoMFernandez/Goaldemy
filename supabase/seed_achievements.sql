-- Demo achievements seed and unlock RPC
-- Safe to run multiple times

-- Seed demo achievements
insert into public.achievements (code, name, description, icon_url, points)
values
  ('first_correct', 'Primer acierto', 'Consigue tu primer respuesta correcta', 'https://img.icons8.com/fluency/48/checkmark.png', 10),
  ('streak_3', 'Racha de 3', 'Acumula una racha de 3 aciertos seguidos', 'https://img.icons8.com/emoji/48/party-popper.png', 20),
  ('streak_5', 'Racha de 5', 'Acumula una racha de 5 aciertos seguidos', 'https://img.icons8.com/fluency/48/confetti.png', 30),
  ('streak_10', 'Racha de 10', 'Acumula una racha de 10 aciertos seguidos', 'https://img.icons8.com/fluency/48/trophy.png', 50),
  ('ten_correct', 'Diez aciertos', 'Consigue 10 respuestas correctas', 'https://img.icons8.com/fluency/48/medal.png', 25),
  ('xp_100', '100 XP', 'Alcanza 100 puntos de experiencia', 'https://img.icons8.com/fluency/48/star.png', 15),
  ('xp_1000', '1000 XP', 'Alcanza 1000 puntos de experiencia', 'https://img.icons8.com/fluency/48/crown.png', 80),
  -- Logros diarios por cantidad de juegos ganados en el día
  ('daily_wins_3', 'Triplete diario', 'Ganá 3 juegos del día', 'https://img.icons8.com/fluency/48/goal.png', 20),
  ('daily_wins_5', 'Quinteto diario', 'Ganá 5 juegos del día', 'https://img.icons8.com/fluency/48/goal.png', 35),
  ('daily_wins_10', 'Diez del tirón', 'Ganá 10 juegos del día', 'https://img.icons8.com/fluency/48/goal.png', 60),
  ('daily_wins_all', 'Pleno diario', 'Ganá todos los juegos del día', 'https://img.icons8.com/fluency/48/trophy.png', 80),
  -- Rachas por día en un juego específico (genéricos, se registran con meta.game)
  ('daily_streak_3', 'Racha diaria ×3', 'Ganá el mismo juego 3 días seguidos', 'https://img.icons8.com/fluency/48/crown.png', 20),
  ('daily_streak_5', 'Racha diaria ×5', 'Ganá el mismo juego 5 días seguidos', 'https://img.icons8.com/fluency/48/confetti.png', 35),
  ('daily_streak_10', 'Racha diaria ×10', 'Ganá el mismo juego 10 días seguidos', 'https://img.icons8.com/fluency/48/trophy.png', 80),
  -- Superlogro: 5 días seguidos ganando en 3 juegos distintos
  ('daily_super_5x3', 'Tri-rey semanal', 'Lográ 5 días seguidos ganando en 3 juegos distintos', '/badges/special/streak-5x3.svg', 120)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon_url = excluded.icon_url,
  points = excluded.points;

-- RPC to unlock by code for current user
create or replace function public.unlock_achievement(
  p_code text,
  p_meta jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ach_id uuid;
  v_points int := 0;
  v_inserted boolean := false;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select id, points into v_ach_id, v_points from public.achievements where code = p_code;
  if v_ach_id is null then
    raise exception 'Achievement code % not found', p_code;
  end if;

  insert into public.user_achievements(user_id, achievement_id, metadata)
  values (v_user, v_ach_id, coalesce(p_meta, '{}'::jsonb))
  on conflict (user_id, achievement_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- If newly unlocked, award XP equal to achievement points
  if v_inserted then
    perform public.award_xp(v_points, 'achievement', null, null, jsonb_build_object('achievement', p_code));
  end if;

  return v_inserted; -- true if unlocked now, false if already had
end$$;

grant execute on function public.unlock_achievement(text, jsonb) to authenticated;
