-- Demo achievements seed and unlock RPC
-- Safe to run multiple times

-- Seed achievements with gamification focus
insert into public.achievements (code, name, description, icon_url, points)
values
  -- 🎯 Logros de inicio
  ('first_correct', 'Primer toque', 'Consigue tu primer respuesta correcta', 'https://img.icons8.com/fluency/48/checkmark.png', 10),
  ('first_win', 'Debut ganador', 'Ganá tu primer juego del día', 'https://img.icons8.com/fluency/48/star.png', 15),
  
  -- 🔥 Rachas en dias
  ('streak_3', 'Calentando motores', 'Acumula 3 aciertos seguidos en un juego', 'https://img.icons8.com/emoji/48/fire.png', 20),
  ('streak_5', 'En racha', 'Acumula 5 aciertos seguidos en un juego', 'https://img.icons8.com/fluency/48/confetti.png', 30),
  ('streak_10', 'Imparable', 'Acumula 10 aciertos seguidos en un juego', 'https://img.icons8.com/fluency/48/trophy.png', 50),
  ('streak_15', 'Máquina', '15 aciertos seguidos... ¿cómo lo hacés?', 'https://img.icons8.com/fluency/48/crown.png', 80),
  
  -- 📅 Logros diarios (wins en el día)
  ('daily_wins_3', 'Triplete', 'Ganá 3 juegos en un mismo día', 'https://img.icons8.com/fluency/48/goal.png', 25),
  ('daily_wins_5', 'Quinteto de oro', 'Ganá 5 juegos en un mismo día', 'https://img.icons8.com/emoji/48/gem-stone.png', 40),
  ('daily_wins_all', 'Barrida limpia', 'Ganá todos los juegos del día', 'https://img.icons8.com/color/48/broom.png', 100),
  
  -- 🔁 Constancia diaria (daily streaks)
  ('daily_streak_3', 'Disciplinado', 'Volvé 3 días seguidos', 'https://img.icons8.com/color/48/calendar--v1.png', 20),
  ('daily_streak_5', 'Fanático', 'Jugá 5 días seguidos', 'https://img.icons8.com/color/48/fire-element--v1.png', 35),
  ('daily_streak_7', 'Semana perfecta', '7 días sin faltar', 'https://img.icons8.com/fluency/48/star.png', 60),
  ('daily_streak_14', 'Dos semanas al palo', '14 días consecutivos jugando', 'https://img.icons8.com/fluency/48/trophy.png', 120),
  ('daily_streak_30', 'Mes legendario', '30 días seguidos... ¡sos el GOAT!', 'https://img.icons8.com/fluency/48/crown.png', 300),
  
  -- ⚽ Logros por juego específico
  ('guess_master', 'Adivino profesional', 'Ganá 20 partidas de "Adivina el jugador"', 'https://img.icons8.com/fluency/48/crystal-ball.png', 50),
  ('nationality_expert', 'Experto en banderas', 'Acertá 50 nacionalidades correctas', 'https://img.icons8.com/color/48/around-the-globe.png', 50),
  ('position_guru', 'Técnico táctico', 'Identificá correctamente 50 posiciones', 'https://img.icons8.com/color/48/training.png', 50),
  
  -- 🎲 Logros curiosos y divertidos
  ('lucky_first', 'Suertudo', 'Acierta en el primer intento 10 veces', 'https://img.icons8.com/color/48/horseshoe.png', 40),
  ('comeback_king', 'Rey del comeback', 'Ganá después de 3 errores consecutivos', 'https://img.icons8.com/color/48/restart--v1.png', 30),
  ('night_owl', 'Ave nocturna', 'Jugá entre las 00:00 y las 05:00', 'https://img.icons8.com/fluency/48/owl.png', 25),
  ('early_bird', 'Madrugador', 'Jugá antes de las 07:00', 'https://img.icons8.com/fluency/48/sun.png', 25),
  ('weekend_warrior', 'Guerrero del finde', 'Ganá 10 juegos en sábado o domingo', 'https://img.icons8.com/fluency/48/beach.png', 40),
  
  -- 🏆 Logros épicos y desafiantes
  ('perfectionist', 'Perfeccionista', 'Completá un juego sin errores', 'https://img.icons8.com/fluency/48/star-half-empty.png', 60),
  ('hat_trick', 'Hat-trick', 'Ganá 3 juegos distintos el mismo día', 'https://img.icons8.com/color/48/football2--v1.png', 50),
  ('grand_slam', 'Grand Slam', 'Ganá todos los juegos disponibles en una semana', 'https://img.icons8.com/fluency/48/trophy.png', 150),
  ('centurion', 'Centurión', 'Acumula 100 victorias totales', 'https://img.icons8.com/fluency/48/medal.png', 100),
  
  -- 🌟 Logros sociales
  ('social_butterfly', 'Mariposa social', 'Conectá con 10 usuarios', 'https://img.icons8.com/fluency/48/conference-call.png', 30),
  ('chat_master', 'Charlatán', 'Envía 100 mensajes en el chat', 'https://img.icons8.com/fluency/48/chat.png', 40),
  
  -- 💎 Super logros
  ('streak_dual_100', 'Doble centenario', 'Acumulá 100 victorias en 2 juegos distintos', 'https://img.icons8.com/color/48/two-hearts.png', 150),
  ('xp_multi_5k_3', 'Triple 5K', 'Conseguí 5000 XP en 3 juegos diferentes', 'https://img.icons8.com/color/48/gems.png', 150),
  ('daily_super_5x3', 'Tri-rey semanal', 'Lográ 5 días seguidos ganando en 3 juegos distintos', 'https://img.icons8.com/color/48/prize.png', 120),
  ('daily_wins_10', 'Decena perfecta', 'Ganá 10 juegos diferentes en un mismo día', 'https://img.icons8.com/color/48/ten-percents.png', 150)
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
