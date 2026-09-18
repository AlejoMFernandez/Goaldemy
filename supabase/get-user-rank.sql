-- Perf: Profile.vue pedía el leaderboard completo (top 100, get_leaderboard) solo para
-- buscar la posición de UN usuario client-side. Esta RPC calcula el mismo dense_rank()
-- que get_leaderboard (mismo criterio: suma total de xp_events, todo el tiempo) pero
-- devuelve una sola fila en vez de 100 → mucho menos payload/JSON para deserializar.
-- El cliente (services/xp.js getUserRank) ya tiene fallback al método viejo si esta
-- función no existe todavía, así que es seguro correr esto cuando quieras.
create or replace function public.get_user_rank(
    p_user_id uuid default null
) returns table (
    rank bigint,
    xp_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := coalesce(p_user_id, auth.uid());
begin
    return query
    with totals as (
        select e.user_id, sum(e.amount)::bigint as xp_total
        from public.xp_events e
        group by e.user_id
    ),
    ranked as (
        select t.user_id, t.xp_total, dense_rank() over (order by t.xp_total desc) as rnk
        from totals t
    )
    select r.rnk as rank, r.xp_total
    from ranked r
    where r.user_id = v_user_id;
end$$;

grant execute on function public.get_user_rank(uuid) to authenticated;
