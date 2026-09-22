# Fulvo — Modo invitado: rollout completo + índice unificado

## Contexto

Spec y plan anteriores (`2026-09-18-guest-play-real-games-*`) implementaron modo invitado como **piloto** en 3 juegos (WhoIs, Mayor o Menor, La Grilla) más uno ya existente (Adivina el jugador), con un CTA de navegación separado ("Jugá gratis") apuntando directo a ese piloto. Ya está mergeado y en producción local.

El dueño del producto aclaró que la visión real es más amplia: **no** un índice separado de "jugá gratis", sino que el índice REAL de juegos (`/play/points`, hoy con `requiresAuth: true`) sea accesible estando o no logueado, y que **todos** los juegos (salvo Once Ideal, que se oculta por ahora) se puedan jugar sin cuenta — sin persistir XP/logros, pero con la misma pantalla de cierre que ya incentiva crear cuenta.

Investigación de esta sesión:
- Los 9 juegos que faltan (Nacionalidad, Posición, Orden por valor/edad/altura, Número de camiseta, Football Wordle, Conexiones, Desafío de estadísticas) usan **exactamente el mismo patrón** ya implementado 4 veces: `awardXpBatch({gameCode, totalXp, corrects})` dentro de `if (this.allowXp && this.xpEarned > 0)`, y el mismo par `corrects`/`winThreshold` ya pasado a `<GameSummaryPopup>`. Sin sorpresas de mecánica.
- El sistema de desbloqueo por nivel (`level-rewards.js`, `GAME_UNLOCK_LEVELS`) hoy solo tiene **una** entrada real por encima de nivel 1: `once-ideal: 18`. Todo lo demás ya está desbloqueado desde nivel 1. Ocultando Once Ideal, el sistema queda inerte sin tener que desarmar el mecanismo — se puede retomar en el futuro con solo agregar una entrada.
- `/play/points` (`PlayPoints.vue`) ya maneja la ausencia de usuario con gracia (nivel cae a 1, racha diaria no rompe) — no necesita rediseño, solo que la ruta deje de exigir auth.
- `Landing.vue` (la home) también lista juegos con el mismo sistema de desbloqueo — tiene cambios sin commitear del dueño en curso; el dueño confirmó que puedo tocarlo igual (cambio chico y acotado).
- Una vez que `/play/points` sea pública, el link "Jugar por puntos" que YA existe en la navegación (navbar, dropdown "Jugar") empieza a funcionar para invitados solo. El CTA "Jugá gratis" agregado en la ronda anterior queda redundante — se elimina, no se repuntea.
- Con `/play/points` abierto, el `backPath()` de los juegos ya no necesita una rama especial para invitados (antes mandaba a `/` para no chocar con el login) — puede volver a su lógica original (`/play/points` o `/play/free`), ahora accesible para cualquiera.

## Alcance

**Incluye:**
- Abrir `/play/points` sin `requiresAuth`.
- Modo invitado en los 9 juegos restantes, mismo patrón que los 4 ya shippeados: `isGuest` computed, rama en el handler de fin de partida (`setPendingGuestClaim` en vez de `awardXpBatch`), prop `:guest="isGuest"` en `GameSummaryPopup`. Solo Football Wordle (single-shot, `winThreshold=1`) necesita además `:resultLine` custom — los otros 8 ya usan una grilla de "X de N preguntas/celdas" que encaja bien con el formato default, mismo criterio que se usó para La Grilla en la ronda anterior.
- Revertir el `backPath()` de los 3 juegos de la ronda anterior (WhoIs, Mayor o Menor, La Grilla) a su lógica original sin rama de invitado — ya no hace falta, `/play/points` es pública.
- Vaciar `GAME_UNLOCK_LEVELS`/`GAME_NAMES` de la entrada `once-ideal` en `level-rewards.js` (deja el mecanismo intacto, solo sin datos que bloqueen nada).
- Ocultar Once Ideal del listado de juegos en `PlayPoints.vue` y `Landing.vue` (filtro client-side, sin tocar la tabla `games` de Supabase).
- Eliminar el CTA "Jugá gratis" (navbar ×4, footer, `AboutFulvo.vue`) — no se repuntea, se borra. El link "Jugar por puntos" que ya existe pasa a ser el único punto de entrada, funcionando para cualquiera.

**No incluye:**
- Tocar la ruta ni el componente de Once Ideal (sigue existiendo, sigue pidiendo cuenta, solo se oculta del índice).
- Borrar la fila de `once-ideal` de la tabla `games` en Supabase — sigue en la base, solo no se lista en el cliente.
- Rediseño visual de `PlayPoints.vue`/`Landing.vue` — ningún cambio de layout, solo el filtro de un juego y la apertura de la ruta.
- Reintroducir el desbloqueo por nivel en el futuro — queda anotado como posible trabajo futuro, no en esta spec.

## Modelo por juego (9 juegos)

Mismo modelo ya validado — cada juego pasa exactamente el mismo par `corrects`/`total` que ya usa para `<GameSummaryPopup>`:

| Juego | `corrects` | `total` | `maxStreak` | `resultLine` custom |
|---|---|---|---|---|
| Nacionalidad | `this.corrects` | `10` (default) | `this.maxStreak` | no |
| Posición del jugador | `this.corrects` | `10` | `this.maxStreak` | no |
| Orden por valor | `correctPositions` (local) | `this.slots.length` | `0` | no |
| Orden por edad | `correctPositions` | `this.slots.length` | `0` | no |
| Orden por altura | `correctPositions` | `this.slots.length` | `0` | no |
| Número de camiseta | `this.corrects` | `10` | `this.maxStreak` | no |
| Football Wordle | `this.won ? 1 : 0` | `1` | `0` | **sí** — mismo criterio que WhoIs |
| Conexiones | `this.corrects` | `4` | `0` | no |
| Desafío de estadísticas | `this.corrects` | `10` | `this.maxStreak` | no |

## Testing / validación

Mismo criterio que la ronda anterior — sin runner de tests automatizado: `npm run build` por tarea + una pasada manual final jugando varios de los 9 juegos como invitado desde `/play/points` directamente (sin pasar por un link directo al juego), confirmando que el índice carga sin pedir login, que Once Ideal no aparece, y que los juegos bloqueados por nivel ya no muestran candado.
