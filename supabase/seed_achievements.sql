-- Demo achievements seed and unlock RPC
-- Safe to run multiple times

-- Seed demo achievements
insert into public.achievements (code, name, description, icon_url, points)
values
  ('first_correct', 'Primer acierto', 'Consigue tu primer respuesta correcta', 'https://img.icons8.com/color/48/ok.png', 10),
  ('streak_3', 'Racha de 3', 'Acumula una racha de 3 aciertos seguidos', 'https://img.icons8.com/color/48/party-baloons.png', 20)
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
  v_inserted boolean := false;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_ach_id from public.achievements where code = p_code;
  if v_ach_id is null then
    raise exception 'Achievement code % not found', p_code;
  end if;

  insert into public.user_achievements(user_id, achievement_id, metadata)
  values (v_user, v_ach_id, coalesce(p_meta, '{}'::jsonb))
  on conflict (user_id, achievement_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted; -- true if unlocked now, false if already had
end$$;

grant execute on function public.unlock_achievement(text, jsonb) to authenticated;
