# Fulvo — Modo invitado en juegos reales (reemplaza "Reto del día")

## Contexto

Auditoría de los sistemas actuales de "jugar sin cuenta" realizada en esta misma conversación. Hallazgo: hoy existen **dos sistemas paralelos y parcialmente redundantes**:

1. **`daily-reto.js` (`/reto`, componente `DailyChallenge.vue`)** — motor de trivia MCQ propio, separado de los 13 juegos reales. Rota entre 3 mecánicas simplificadas (nacionalidad/posición/dorsal), semilla determinística por fecha (efecto Wordle: mismo desafío para todos el mismo día). Reclamo de XP/Fichas al registrarse ya funciona end-to-end vía RPC `claim_reto_reward`.
2. **`guest-play.js`** — piloto más nuevo para dejar jugar un juego REAL (WhoIs) sin cuenta, mismo patrón de reclamo pendiente → registro → claim vía RPC `claim_guest_game_reward` (este RPC **ya es genérico**, recibe `game_slug`). No está conectado: `/games/who-is` sigue con `requiresAuth: true` en el router.

El dueño del producto considera que el "Reto del día" (opción 1) no tiene sentido funcional de cara al lanzamiento: es una mecánica de juguete, no linkeable a un juego específico mostrado en un reel de marketing, y ahuyenta más de lo que convierte. Decisión: eliminarlo y generalizar el enfoque de la opción 2 a varios juegos reales.

**Hallazgo adicional (cambia el alcance):** el Reto del día no es solo un funnel de invitados — `duels.js` reusa su semilla diaria para una función social ya conectada de usuarios logueados: tablero "cómo le fue hoy a tus amigos" + botón "desafiar a un amigo", renderizado en `FriendsDock.vue`, con RPCs propias (`get_reto_duel_board`, `send_duel_challenge`) y un tipo de notificación (`duel_challenge`). El dueño decidió sacarlo también por ahora (ver Alcance).

**Hallazgo adicional (reduce el riesgo estimado):** `isChallengeAvailable`, `startChallengeSession` y `completeChallengeSession` (`game-modes.js`) **ya no-opean correctamente para invitados** (`!userId` → sesión no persistida, sin throw). El trabajo de "guestificar" cada juego es más acotado de lo que parecía en un primer análisis: no hay que tocar la capa de sesión, solo la capa de recompensa/resumen post-partida.

## Alcance

**Incluye:**
- Modo invitado (sin cuenta) en 3 juegos piloto: **WhoIs** (`/games/who-is`), **Mayor o Menor** (`/games/higher-or-lower`), **La Grilla** (`/games/football-grid`) — elegidos porque son los primeros con contenido de reels grabado/planeado.
- `guest-play.js` generalizado: almacenamiento de pendientes por MAPA (una entrada por juego, no un único pendiente que se pisa), reclamo en loop al registrarse, cálculo de recompensa-preview (XP/Fichas/nivel) migrado desde `daily-reto.js`.
- Teaser simulado de logro/cosmético (client-side, criterio simple de una sola partida: ej. resultado perfecto, tiempo rápido) — preview, no un desbloqueo real; el desbloqueo real solo ocurre server-side al registrarse y jugar logueado.
- Pantalla de resultado nueva para invitados (componente compartido entre los 3 juegos), rediseñada on-brand, con: recompensa de esta partida, acumulado si jugó más de un juego, CTA fuerte a registro, botón compartir con texto específico por juego (sin grilla de emojis tipo Wordle).
- Eliminación completa de `/reto`, `DailyChallenge.vue`, `daily-reto.js`, `duels.js`, la sección de tablero de amigos en `FriendsDock.vue`, y los links de navegación a `/reto`.

**No incluye (fuera de esta spec):**
- Rollout a los 10 juegos restantes — queda como paso siguiente una vez validado el piloto.
- El gancho social "mismo desafío para todos, comparar con amigos" (semilla diaria + duelos) — se descarta por ahora. Si se retoma en el futuro, se rediseña sobre un juego real, no sobre un motor propio.
- Borrado de los RPCs `get_reto_duel_board` / `send_duel_challenge` / `claim_reto_reward` de la base — quedan sin uso pero no rompen nada estando ociosos. Se puede limpiar en otra pasada.
- Rediseño visual final de la pantalla de resultado — se define en fase de implementación con `frontend-design`/`ui-ux-pro-max` contra la identidad real de marca (ver memoria `fulvo-identity-audit`), no en esta spec.

## Decisiones ya tomadas (de la sesión de brainstorming)

- Sin gancho viral diario por ahora — prioridad en variedad de juegos para linkear con reels.
- Piloto de 3 juegos, no los 13 de una.
- Duelos/tablero de amigos se eliminan junto con el Reto del día (no se migran a un juego real en esta spec).
- Logros/cosméticos: teaser simulado simple, no cálculo real contra el motor de logros (que requiere estado de cuenta — ver `achievement-triggers.js`, todos sus criterios no triviales dependen de historial server-side).
- CTA de navegación por defecto: apunta a WhoIs ("Jugá gratis") en vez de a un selector de 3 juegos, para no agregar una pantalla intermedia en el piloto. **A confirmar en la revisión de esta spec** — si se prefiere un mini-selector de los 3, es un cambio menor de UI, no de arquitectura.

## Modelo de datos (cliente)

`guest-play.js`, clave `goaldemy_guest_play_pending`, pasa de un objeto único a un mapa por juego:

```js
{
  'who-is':          { corrects, total, maxStreak, dayKey, at },
  'higher-or-lower':  { corrects, total, maxStreak, dayKey, at },
  'football-grid':    { corrects, total, maxStreak, dayKey, at },
}
```

- `setPendingGuestClaim(game, result)` — hace `upsert` de la entrada de ESE juego (rejugar antes de registrarse actualiza, no duplica ni acumula partidas del mismo juego).
- `getPendingGuestSummary()` — nueva función: devuelve el mapa completo + totales agregados (XP/Fichas estimados sumando todas las entradas vía `computeGuestRewards`, la función migrada de `daily-reto.js`), para que la pantalla de resultado muestre "llevás N juegos probados, total acumulado X".
- `claimPendingGuestReward()` — pasa de reclamar UNA entrada a recorrer el mapa completo, llamando `claim_guest_game_reward` por cada `game_slug` presente (el RPC ya soporta esto, es por juego+día). Suma los `xp`/`fichas` devueltos de cada llamada exitosa para el toast/resumen de bienvenida. Limpia solo las entradas reclamadas con éxito (si una falla, queda pendiente para reintentar).

## Cambios por juego (WhoIs, HigherOrLower, FootballGrid)

Mismo patrón en los 3 componentes:

1. **Router** (`router.js`): sacar `requiresAuth: true` de las 3 rutas piloto.
2. **Detección de invitado**: `const isGuest = !getAuthUser()?.id` al momento de terminar la partida (no hace falta chequearlo al montar — `game-modes.js` ya maneja el guest en `isChallengeAvailable`/`startChallengeSession` sin cambios).
3. **En el handler de fin de partida** (ej. `submit()` en `WhoIs.vue` línea ~172), envolver en la rama `isGuest`:
   - **Se saltan:** `awardXpBatch`, `captureLevelSnapshot`, `checkAndUnlockDailyWins`, el segundo `completeChallengeSession` con `xpView` (todo esto asume cuenta/nivel real).
   - **Se agregan:** `setPendingGuestClaim(gameSlug, { corrects, total, maxStreak })`, luego mostrar el nuevo componente de resultado invitado en vez de `GameSummaryPopup`.
   - `completeChallengeSession` (la primera llamada, la de persistir sesión) puede quedar tal cual — no-opea sola al no haber `sessionId`.
4. **Logueado**: cero cambios, mismo flujo de hoy.

## Pantalla de resultado invitado (componente nuevo, compartido)

Requisitos funcionales (de la sesión de brainstorming):
- Resultado de la partida actual en el formato propio del juego (no una grilla de emojis fija — cada juego pasa su propio texto/valor de resultado: WhoIs → intentos, Mayor o Menor → racha, La Grilla → celdas completadas).
- Card de XP ganada, card de Fichas ganadas.
- Si el XP simulado cruza el umbral de nivel 2 (mismo cálculo que `daily-reto.js` ya tenía, migrado a `guest-play.js`): card de "subiste de nivel".
- Si aplica el teaser simulado: card de logro o cosmético "a punto de desbloquear".
- Si hay más de una entrada en el mapa de pendientes: chip/banner de acumulado total ("ya llevás N juegos, total X XP / Y Fichas").
- CTA primario fuerte: crear cuenta y reclamar.
- Botón compartir (texto por juego, sin dependencia de semilla diaria — comparte SU resultado, no lo compara con nadie).
- Diseño visual: a resolver en implementación contra la identidad real de marca, no contra el estilo actual de `DailyChallenge.vue` (considerado feo/sin sentido visual por el dueño).

## `App.vue`

Reemplazar la línea que llama `claimPendingRetoReward` (de `daily-reto.js`) — se elimina. La llamada a `claimPendingGuestReward` (de `guest-play.js`) queda como el único reclamo de invitado, ahora recorriendo el mapa completo y mostrando el resumen agregado.

## Limpieza — archivos a eliminar o editar

**Eliminar:**
- `src/pages/DailyChallenge.vue`
- `src/services/daily-reto.js` (antes de borrar, migrar `computeRetoRewards` → `computeGuestRewards` en `guest-play.js`)
- `src/services/duels.js`

**Editar:**
- `src/router/router.js` — quitar la ruta `/reto`; quitar `requiresAuth: true` de los 3 juegos piloto.
- `src/App.vue` — quitar la línea de `claimPendingRetoReward`.
- `src/components/AppNavBar.vue` (4 lugares) — reemplazar links a `/reto` por el nuevo CTA "Jugá gratis" → `/games/who-is`.
- `src/components/AppFooter.vue` — ídem.
- `src/pages/info/AboutFulvo.vue` — ídem.
- `src/pages/social/Notifications.vue` — quitar el branch de render para `n.type==='duel_challenge'`.
- `src/components/FriendsDock.vue` — quitar la sección de tablero de duelos (usa `getRetoDuelBoard`/`sendDuelChallenge`).
- `src/services/career.js` — usa `todayKey` de `daily-reto.js` solo como utilidad de fecha; mover ese helper a un lugar neutral (ej. `game-common.js`) antes de borrar `daily-reto.js`.
- `src/services/share.js` — revisar las referencias a "Reto del día" en comentarios/nombres, no es lógica crítica pero conviene limpiar.

**Sin tocar (queda ocioso, no se borra en esta pasada):**
- RPCs de Supabase: `claim_reto_reward`, `get_reto_duel_board`, `send_duel_challenge`.

## Testing / validación

Manual (no hay entorno de test automatizado para flujos de juego completos en este proyecto):
1. Invitado (sin sesión) juega WhoIs completo → ve pantalla de resultado nueva, no el popup logueado.
2. El mismo invitado, sin registrarse, juega Mayor o Menor → pantalla de resultado muestra acumulado de 2 juegos.
3. Rejugar el mismo juego (ej. WhoIs de nuevo) sin registrarse → la entrada de WhoIs en el mapa se actualiza, no se duplica.
4. Registrarse (con los 2-3 pendientes acumulados) → confirmar toast/resumen de bienvenida con el total correcto sumado de las 3 llamadas RPC, y que si el XP total cruza el umbral de nivel se dispare el overlay de level-up.
5. Usuario YA logueado juega los 3 juegos piloto → cero regresión, mismo comportamiento de siempre (sesión persistida, XP real, logros reales).
6. Navegar por navbar/footer/AboutFulvo → los links viejos a `/reto` ya no existen en ningún lado (grep de `/reto` y `daily-reto` limpio salvo lo explícitamente dejado ocioso en DB).
7. `FriendsDock.vue` y `Notifications.vue` no rompen al no encontrar más notificaciones `duel_challenge` (regresión visual del componente).
