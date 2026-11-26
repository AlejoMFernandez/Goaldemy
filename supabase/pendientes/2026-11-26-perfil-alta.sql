-- ════════════════════════════════════════════════════════════════════
--  2026-11-26 — PERFIL AL DARSE DE ALTA: EL NOMBRE ELEGIDO LLEGA AL PERFIL
-- ════════════════════════════════════════════════════════════════════
--  QUÉ:
--   1) handle_new_user() (trigger on_auth_user_created) toma el nombre de
--      raw_user_meta_data->>'display_name' (o 'username'), que el cliente ahora
--      manda en el signUp (services/auth.js → register). Si no viene, usa la
--      parte del mail antes de la @, como hasta hoy. Idempotente (on conflict).
--   2) Backfill: perfiles que quedaron con el nombre del mail aunque en los
--      metadatos del alta había un nombre elegido → se les pone el elegido.
--
--  POR QUÉ: el signUp no mandaba el nombre en los metadatos, así que el trigger
--      creaba el perfil con "alejofernandeztravel" (parte del mail) y el insert
--      del cliente con el nombre elegido fallaba (fila ya creada / sin sesión
--      hasta confirmar el mail). El usuario nuevo no veía su nombre en el Perfil.
--      El cliente ya lo corrige solo al entrar (loadExtendedProfile); esto lo
--      deja bien desde el servidor y arregla las cuentas viejas que no vuelvan a entrar.
--
--  ROLLBACK: volver a correr la versión de supabase/patch-fix-profiles.sql
--      (sección 1). El backfill no tiene rollback automático (solo cambia
--      display_name de perfiles que tenían el nombre del mail).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'username'), ''),
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end$$;

-- Sigue siendo interna (ver 2026-11-24-02): nadie la llama por RPC.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill
update public.user_profiles p
set display_name = btrim(u.raw_user_meta_data->>'display_name')
from auth.users u
where u.id = p.id
  and nullif(btrim(u.raw_user_meta_data->>'display_name'), '') is not null
  and (p.display_name is null or btrim(p.display_name) = '' or p.display_name = split_part(u.email, '@', 1));
