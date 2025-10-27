-- Helper to purge all app data for a user ID from public tables
-- Usage (SQL editor): select public.purge_user_data('USER_UUID');
-- Then delete the auth user from Dashboard (Auth > Users) or via Admin API.

create or replace function public.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- App tables that reference the user (safe to run even if empty)
  delete from public.user_achievements where user_id = p_user_id;
  delete from public.xp_events where user_id = p_user_id;
  delete from public.global_chat_messages where sender_id = p_user_id;
  delete from public.game_sessions where user_id = p_user_id;

  -- Profiles table may use id or user_id; try both, ignore if table/cols don't exist
  begin
    delete from public.user_profiles where id = p_user_id or user_id = p_user_id;
  exception when undefined_table or undefined_column then
    -- ignore if environment doesn't have these
    null;
  end;
end
$$;

revoke all on function public.purge_user_data(uuid) from public;
grant execute on function public.purge_user_data(uuid) to authenticated;
-- service_role always has access
