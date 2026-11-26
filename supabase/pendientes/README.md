# Parches de seguridad pendientes (2026-11-24)

> **2026-11-26 — PLAN VIGENTE: [`APLICAR-2026-11-26.md`](APLICAR-2026-11-26.md).** Orden, archivos
> corregidos contra el esquema REAL de producción (nombres de políticas, firmas) y una consulta de
> verificación por archivo. Lo que sigue abajo es el README original de los parches del 24/11
> (03, 05, 08, 09 quedaron para después; la curva 31–50/51–100 la reemplaza `2026-11-26-curva-niveles-1-100.sql`).


Estos archivos **no se aplicaron en ninguna base**. Están para que los revises y los apliques vos, primero en un proyecto de staging. Ninguno se corrió ni se parseó contra Postgres: escribirlos fue revisión manual, así que **probalos en staging antes de producción**.

## Qué arregla cada uno

| # | Archivo | Hueco | Gravedad |
|---|---------|-------|----------|
| 01 | `-01-verificar-permisos.sql` | **Solo lectura.** Confirma cada hueco en la base real (consulta 6 = resumen true/false). | — |
| 02 | `-02-revocar-funciones-internas.sql` | `award_fichas`, `add_balones`, `grant_cosmetic`, `grant_powerup`, `activate_subscription`… ejecutables por cualquier logueado (Supabase da EXECUTE a `authenticated` aunque hagas `REVOKE … FROM PUBLIC`). | Crítico |
| 03 | `-03-purge-y-borrado-de-cuenta.sql` | `purge_user_data(uuid)` borraba los datos de **cualquier** usuario. Agrega `delete_my_account()`. | Crítico |
| 04 | `-04-xp-servidor.sql` | `award_xp` aceptaba cualquier monto/motivo (+ Fichas vía trigger); política "Insert xp for self". Bonus de nivel lo daba el cliente. | Crítico |
| 05 | `-05-logros.sql` | "Insert/Delete own achievement": desbloquear cualquier logro y bucle borrar→desbloquear = XP+Fichas infinitas. | Alto |
| 06 | `-06-reclamos-dia-servidor.sql` | `p_day_key` libre en reto/invitado/carrera = reclamos infinitos. `report_game_result` no idempotente (pase + Fichas). | Alto |
| 07 | `-07-sesiones.sql` | UPDATE/DELETE libres en `game_sessions` (reescribir resultados / borrar para rejugar). | Medio |
| 08 | `-08-racha-servidor.sql` | Racha diaria escrita por el cliente, en UTC. RPC `touch_daily_streak()` en hora ART que consume protectores. | Medio |
| 09 | `-09-webhook-idempotencia.sql` | Tabla e RPCs para el webhook nuevo (idempotencia + renovaciones). | Alto (negocio) |
| 10 | `-10-perfil-columnas-protegidas.sql` | **Nuevo:** "Update own profile" deja escribir `role` → cualquiera se hace admin. También `equipped_*`, `referred_by`. | Crítico |

Cada `.sql` tiene en el encabezado QUÉ / POR QUÉ / RIESGO / ROLLBACK y corre dentro de una transacción (`BEGIN … COMMIT`). Son idempotentes: se pueden correr dos veces.

## Orden de aplicación

1. **Staging primero.** Si no tenés staging: Supabase → New project (free), y cargale el esquema de prod con `supabase db dump` / `db pull` (ver abajo). Hacé un backup de prod antes de tocarla (Database → Backups, o `supabase db dump -f backup.sql`).
2. Correr **01** y guardar el resultado (sirve de "antes").
3. Correr **02 → 10** en orden numérico, uno por vez, en el SQL Editor. Si uno falla, la transacción se revierte sola: leé el error y no sigas con el resto.
4. Correr **01** de nuevo: la consulta 6 tiene que dar todo `false`.
5. Edge Functions:
   ```bash
   supabase functions deploy payment-webhook
   supabase functions deploy delete-account
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...       # OBLIGATORIO ahora
   supabase secrets set MERCADOPAGO_WEBHOOK_SECRET=...        # recomendado (panel de MP → Webhooks → clave secreta)
   ```
   En Stripe → Webhooks, sumá los eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   En MercadoPago → Webhooks, activá los tópicos: **Planes y suscripciones** (`subscription_preapproval` y `subscription_authorized_payment`).
6. Cliente: en staging poné `VITE_SERVER_ECONOMY=1` y `VITE_ACCOUNT_DELETION=1` y probá el checklist. Recién después pasalos a producción (Vercel → Environment Variables → redeploy).

> Los parches 02–10 son **compatibles con el cliente actual** (flag apagado): podés aplicar el SQL antes de deployar el front. El flag solo cambia a las RPC nuevas (XP base + multiplicador en el servidor, bonus de nivel, racha).

## Checklist de prueba (staging)

Con un usuario de prueba logueado, en la consola del navegador (`supabase` está en `window` si lo exponés, o usá un script):

- [ ] `rpc('award_fichas', {p_uid: miId, p_amount: 1000, p_reason: 'x'})` → **error de permisos**.
- [ ] `rpc('activate_subscription', {...})` → error de permisos.
- [ ] `rpc('purge_user_data', {p_user_id: '<otro uuid>'})` → `forbidden`.
- [ ] `rpc('award_xp', {p_amount: 999999, p_reason: 'daily_challenge'})` → error 42501.
- [ ] `rpc('award_xp', {p_amount: 999999, p_reason: 'correct_answer'})` → como mucho 5000 × multiplicador.
- [ ] `from('xp_events').insert({...})` y `from('user_achievements').delete()...` → bloqueado.
- [ ] `from('user_profiles').update({role: 'admin'}).eq('id', miId)` → no da error pero `role` sigue en `user`.
- [ ] `rpc('claim_career_reward', {p_grade_key: 'legend', p_day_key: 'x2'})` dos veces → la segunda `already_claimed`.
- [ ] `rpc('report_game_result', {p_game_slug: 'nationality', p_won: true})` en bucle → el pase sube una sola vez (y solo si terminaste ese desafío hoy).
- [ ] Jugar un desafío completo de punta a punta: XP, pantalla de resumen, retos diarios, pase, racha → todo igual que antes.
- [ ] Subir de nivel y reclamar el bonus en el Centro de recompensas.
- [ ] Desbloquear un logro normal (toast + XP una vez).
- [ ] Admin: panel admin, dar monedas, cambiar rol → sigue andando.
- [ ] Pago de prueba (Stripe test mode / MP sandbox): alta → PRO; reenviar el mismo evento desde el panel → `duplicate: true`; `invoice.paid` extiende `current_period_end`.
- [ ] Borrar cuenta de prueba (Perfil → Editar → Zona de peligro → escribir BORRAR) → el usuario desaparece de Auth y de las tablas; si tenía suscripción, queda cancelada en el proveedor.

## Rollback

Cada archivo trae su bloque `ROLLBACK` en el encabezado. Resumen:
- 02: `GRANT EXECUTE ON FUNCTION <firma> TO authenticated;` para la función puntual.
- 04: recrear la política "Insert xp for self" + `award_xp` original de `schema.sql` (vuelve a ser inseguro).
- 07 / 08 / 10: `DROP TRIGGER …` (los nombres están en cada archivo).
- 09: borrar las funciones/tabla nuevas (ojo: el webhook nuevo depende de ellas, volvé a la versión anterior de la función también).
- Cliente: apagar `VITE_SERVER_ECONOMY` / `VITE_ACCOUNT_DELETION` y redeploy.

## Cambios que hacen falta en archivos que no toqué

- `src/services/game-modes.js`: nada obligatorio. Recomendado: borrar `resetTodaySessionsForCurrentUser()` (ya no funciona para no-admins) y no llamar `report_game_result` dos veces (hoy los juegos que hacen 2 `completeChallengeSession` lo llaman 2 veces; el servidor ya lo ignora).
- `src/services/admin.js` → `updateUser()` actualiza `user_profiles` de otro usuario: nunca funcionó por RLS (solo tu fila). Si lo necesitás, hacé una RPC de admin.
- `src/pages/games/*`: los logros siguen evaluándose en el cliente (`achievement-rules.js`). Para cerrar del todo el hueco 05 hay que portar esas reglas a SQL (tarea grande, aparte).
- `App.vue`: sin cambios.

## Pendientes / riesgos conocidos (no resueltos acá)

- **Referidos**: `claim_referral` no limita cuentas nuevas por referidor → se pueden crear cuentas truchas para farmear 150 Fichas por cuenta. Sugerencia: exigir email confirmado + tope mensual por referidor.
- **Política "Profiles readable (public)"** (anon): expone todas las columnas de perfiles públicos, incluido `email` si existe en `user_profiles`. Revisar con una vista pública sin email.
- **Carrera**: el grado lo decide el cliente; queda acotado a 1 reclamo/día (200 XP + 80 F).
- **get_user_plan(p_user_id)**: cualquiera puede consultar el plan de otro (dato menor).

## Recomendación: migraciones con Supabase CLI

Hoy el esquema vive en ~60 `.sql` sueltos que se corrieron a mano, en un orden que no está escrito, y `schema.sql` llegó a tener conflictos de git sin resolver. Eso hace imposible saber qué hay en prod. Pasos para ordenarlo:

```bash
npm i -D supabase                          # o brew install supabase/tap/supabase
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db pull                       # crea supabase/migrations/<ts>_remote_schema.sql = baseline REAL de prod
git add supabase/migrations && git commit -m "chore(db): baseline desde producción"
```

Desde ahí:
1. Cada cambio nuevo = `npx supabase migration new <nombre>` y pegás el SQL (por ejemplo, estos parches 02–10, uno por migración).
2. Probás local con `npx supabase start` + `npx supabase db reset` (levanta Postgres en Docker y aplica baseline + migraciones).
3. Aplicás a staging/prod con `npx supabase db push` (aplica solo las que faltan y las registra en `supabase_migrations.schema_migrations`).
4. Mover los `.sql` viejos sueltos a `supabase/legacy/` (quedan como historia; la verdad pasa a ser `migrations/`).
5. Opcional: GitHub Action que corra `supabase db lint` en cada PR.

## Progresión y rangos (aparte de los parches de seguridad)

Orden: `2026-11-24-10-curva-31-50.sql` → `2026-10-03-rangos-curva-xp-51-100.sql` → `2026-10-02-rangos-iconos-nombre.sql` y `2026-10-03-rangos-nuevos-cosmeticos.sql` → `2026-11-24-11-colecciones.sql`. Detalle en `docs/relanzamiento/PROGRESION.md` §6.
