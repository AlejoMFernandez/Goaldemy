# Fulvo — PRODE (pronósticos de resultados reales)

## Contexto

El owner pidió gamificar los datos de partidos reales que la app ya trae vía FotMob (hoy usados solo para el hub de competiciones: tabla, goleadores, bracket del Mundial). La idea: que el usuario prediga resultados de partidos y quién sale campeón, y gane XP, Fichas y (en el caso del campeón) Balón de Oro por acertar.

Esto es una feature nueva de punta a punta — no hay nada de "prode" en el código hoy. Se apoya en infraestructura ya existente y validada en esta misma conversación:
- `src/services/fotmob.js` — datos de partidos en vivo (fixtures, resultados, bracket) para las ligas marcadas `active: true` en `LEAGUES` (hoy, el Mundial).
- El patrón de cron + Edge Function ya usado en `streak-reminder.sql` / `supabase/functions/send-streak-reminders/` para trabajos server-side programados.
- El sistema de monedas (`award_xp`, `award_fichas`, `add_balones` en `mejoras11-currency-shop.sql`) y de logros (`achievement-triggers.js`).

**Decisión de diseño clave, ya charlada con el owner:** Balón de Oro está documentado en el código como moneda dura "solo top-up con plata real / admin". El owner confirmó que quiere que sea una moneda **muy difícil de conseguir** y que desbloquee cosas realmente diferenciales — no que se relaje esa regla. Acertar el campeón de un torneo completo (una vez cada varios meses, con cero información al momento de predecir) califica como esa clase de logro extremadamente raro, así que se trata como una **excepción intencional y documentada**, no como un agujero en la regla.

## Alcance

**Incluye:**
- Pronóstico de resultado exacto por partido, para los partidos de la competición activa.
- Pronóstico de campeón del torneo (un pick por usuario y torneo).
- Liquidación server-side automática contra los resultados reales de FotMob.
- Recompensas (XP, Fichas, Balón de Oro solo para el campeón) y logros nuevos.
- Presentación visual de la recompensa potencial ANTES de que el usuario cargue el pronóstico (pedido explícito del owner).
- UI nueva: pestaña "Pronósticos" en `CompetitionPage.vue`.

**No incluye (fuera de esta spec):**
- Extender el pronóstico a los 14 juegos de trivia (son un sistema de datos congelado, no en vivo — no aplica).
- Ranking/leaderboard específico de PRODE entre amigos (queda anotado como posible fase 2, no bloquea esta).
- Ítems nuevos en la tienda gastables con Balón de Oro — la spec solo cubre el lado de "ganar" la moneda, no el catálogo de qué comprar con ella (trabajo aparte de Tienda).
- Ampliar el pronóstico a ligas pausadas (`active: false`) — se activan solas cuando el owner las prenda en `LEAGUES`, sin cambios de código adicionales.

## Modelo de datos

Dos tablas nuevas en `supabase/prode.sql`, siguiendo el mismo patrón (RLS, `SECURITY DEFINER`, RPCs) que `reto-claim.sql` y `streak-reminder.sql`.

```sql
prode_picks (
  id            UUID PK default gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  competition   TEXT NOT NULL,        -- slug de LEAGUES, ej. 'world-cup'
  match_id      TEXT NOT NULL,        -- id de FotMob (string, no UUID propio)
  home_pick     SMALLINT NOT NULL,
  away_pick     SMALLINT NOT NULL,
  kickoff_at    TIMESTAMPTZ NOT NULL, -- copia de status.utcTime al momento de picker (para lockear sin depender de un fetch nuevo)
  points        SMALLINT,             -- NULL hasta liquidar. 3 | 1 | 0
  settled_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
)

prode_champion_picks (
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  competition   TEXT NOT NULL,
  team_id       TEXT NOT NULL,
  team_name     TEXT NOT NULL,        -- copia liviana para no depender de otra tabla de equipos
  locked_at     TIMESTAMPTZ NOT NULL, -- kickoff del primer partido del torneo
  result        TEXT,                 -- NULL | 'win' | 'loss', tras liquidar
  settled_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, competition)
)
```

RLS: cada usuario lee/escribe solo sus propias filas (`auth.uid() = user_id`), igual que el resto de la app. La liquidación (UPDATE de `points`/`result` + otorgar recompensas) corre exclusivamente vía RPC `SECURITY DEFINER` llamada por la Edge Function con la service role — el cliente nunca escribe `points` ni `result` directamente.

## Pronóstico de partidos

- **Dónde**: pestaña "Pronósticos" en `CompetitionPage.vue`, junto a Tabla/Goleadores/Bracket que ya existen. Lista los fixtures de `getUpcomingMatches`/`getAllMatches` (ya trae `id`, `home/away`, `status.utcTime`, `status.finished`).
- **Carga**: dos inputs numéricos (local/visitante) por partido. Mientras el partido no arrancó (`status.utcTime` en el futuro), el pick es editable — cada guardado hace upsert en `prode_picks` (RPC `submit_prode_pick`, valida server-side que el kickoff siga en el futuro antes de aceptar el upsert, para que nadie pueda mandar un pick tarde con el reloj del cliente desincronizado).
- **Preview de recompensa (pedido del owner)**: cada card de partido muestra, ANTES de cargar el resultado, algo así:

  ```
  ┌─────────────────────────────────────┐
  │  Argentina  vs  Francia              │
  │  Vie 12 dic · 16:00                  │
  │                                       │
  │  [ 2 ] – [ 1 ]      Guardar          │
  │                                       │
  │  🎯 Exacto     +30 XP  🪙+15 Fichas  │
  │  ⚽ Ganador     +10 XP  🪙+5 Fichas   │
  └─────────────────────────────────────┘
  ```
  Este bloque de recompensa potencial es visible siempre, no solo al acertar — es lo que "vende" cargar el pronóstico.
- **Puntaje**: exacto = 3 pts, ganador/empate correcto pero marcador distinto = 1 pt, error = 0 pts.
- **Recompensa**: 3 pts → +30 XP / +15 Fichas · 1 pt → +10 XP / +5 Fichas (constantes en la Edge Function, fáciles de tunear sin tocar el modelo de datos).
- **Logros nuevos** (mismo pipeline que `streak_3`/`ten_correct`, agregados a la tabla de logros vía seed, sin lógica nueva de motor):
  - `prode_5_correct` — 5 pronósticos acertados (exacto o ganador) en total.
  - `prode_10_correct` — 10 acertados.
  - `prode_perfect_matchday` — todos los partidos de una misma fecha/ronda acertados con resultado exacto.

## Pronóstico de campeón

- **Dónde**: misma pestaña "Pronósticos", sección destacada arriba (antes de la lista de partidos) — un pick es un evento mucho más importante que un partido suelto y visualmente debe sentirse así.
- **Elegir equipo**: grid de los equipos participantes del torneo (derivado de los fixtures ya cargados — no hace falta un endpoint nuevo). Un solo pick por usuario y torneo, vía RPC `submit_prode_champion_pick`.
- **Lock**: se bloquea en el kickoff del PRIMER partido del torneo — el pick tiene que hacerse a ciegas, sin ninguna información de cómo vienen los grupos. Una vez bloqueado, la UI muestra el pick como "sellado" con el equipo elegido, sin opción de cambiarlo.
- **Preview de recompensa, en grande** (pedido del owner) — un banner destacado arriba del grid, con el mismo peso visual que el popup de logro desbloqueado del resto de la app:

  ```
  ┌───────────────────────────────────────────┐
  │        🏆  ¿QUIÉN SALE CAMPEÓN?             │
  │                                             │
  │   Si acertás, ganás:                       │
  │   ⭐ +500 XP   🪙 +300 Fichas   ⚽ +20 Balón │
  │   + logro exclusivo "Profeta"              │
  │                                             │
  │   Se bloquea cuando arranca el torneo —    │
  │   elegí ahora, a ciegas.                   │
  └───────────────────────────────────────────┘
  ```
- **Recompensa al acertar**: +500 XP, +300 Fichas, +20 Balón de Oro, logro exclusivo `prode_champion`.

## Liquidación (server-side)

FotMob es una fuente externa en vivo — el cliente no puede ser la fuente de verdad de "gané o no". Se resuelve con el mismo patrón que ya existe para el recordatorio de racha:

- **Nueva Edge Function** `supabase/functions/settle-prode/index.ts` (Deno). Pega directo a `https://www.fotmob.com` (mismo host que usa el proxy `/fotmob` en dev/prod — la función corre server-side, no tiene problema de CORS) reimplementando la mínima porción de `fetchFotMob`/`getAllMatches`/`getPlayoff` necesaria (buildId + `_next/data/.../fixtures.json`).
- Cada corrida:
  1. Trae los fixtures de la competición activa.
  2. Para cada partido `finished: true` con picks pendientes (`points IS NULL`) en `prode_picks`, calcula puntos, otorga XP/Fichas vía `award_xp`/`award_fichas`, marca `settled_at`.
  3. Si el partido de la FINAL del torneo está `finished: true`, determina el campeón (ganador de esa final) y liquida `prode_champion_picks` pendientes: otorga XP/Fichas/Balón (`award_xp`, `award_fichas`, `add_balones`) + logro `prode_champion` a los que acertaron, marca `result` (`win`/`loss`) a todos.
- **Cron**: `pg_cron` + `pg_net` disparando la Edge Function cada 15-30 min, mismo bloque comentado que `streak-reminder.sql` (el owner lo descomenta y completa `<PROJECT_REF>`/`<CRON_SECRET>` cuando corra el SQL).
- Las RPCs que la Edge Function llama para escribir `points`/`result`/otorgar recompensas son `SECURITY DEFINER`, `REVOKE ALL ... GRANT TO service_role` — igual que `get_streak_reminder_targets()` — inaccesibles para `anon`/`authenticated`.

## Errores y casos borde

- **FotMob no responde / cambia de formato** (ya pasó con `getTeamDetails`, ver el fallback en `fotmob.js`): la Edge Function debe no-opear en esa corrida (no marcar nada como liquidado) y reintentar en la próxima corrida del cron — nunca liquidar con datos parciales.
- **Empate en el pick de partido con empate real**: cuenta como acierto de "ganador" (empate es un resultado válido de 1X2), 1 pt si el marcador exacto no coincide.
- **Usuario no cargó pick de campeón antes del lock**: simplemente no participa de esa recompensa ese torneo — sin penalización, sin mensaje de error intrusivo, solo la sección deja de mostrar el CTA de elegir y no vuelve a habilitarse hasta el próximo torneo.
- **Partido pospuesto/cancelado**: si FotMob nunca marca `finished: true`, el pick queda pendiente indefinidamente — aceptable para v1 (no hay volumen que lo justifique), anotado como conocido.
- **Límite honesto del lock por kickoff**: Postgres no puede re-consultar FotMob en el momento de guardar el pick (no hay un fetch HTTP síncrono barato desde la RPC), así que `submit_prode_pick` valida el kickoff contra el `kickoff_at` que manda el propio cliente, no contra una verificación fresca. Alguien podría, en teoría, mandar un pick con el reloj del navegador desincronizado justo después de empezado el partido. Dado que esto es un juego social sin apuesta real de por medio, se acepta el riesgo para v1 en vez de sumar la complejidad de una verificación server-side síncrona.

## Testing

Sin infraestructura de tests automatizados en el proyecto (confirmado al arrancar el piloto de invitado) — validación manual, igual que el resto de la app:
- Cargar un pronóstico de partido próximo, confirmar que el preview de recompensa se ve antes de guardar, y que el pick se bloquea al pasar el kickoff (probar con un partido ya empezado).
- Elegir un pick de campeón, confirmar el banner grande de recompensa, y que queda sellado tras el lock.
- Correr la Edge Function `settle-prode` manualmente (invoke) contra un partido ya finalizado (o con un `match_id` de prueba insertado a mano) y confirmar que se acredita XP/Fichas y se marca `settled_at`.
- Confirmar que un pronóstico de campeón acertado (forzado a mano en un entorno de prueba) acredita Balón de Oro y desbloquea el logro `prode_champion`.
