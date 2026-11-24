# Juegos — relanzamiento (rama `fix/juegos-relanzamiento`)

Pasada de correctitud + celular sobre los 14 juegos. No es rediseño: se mantienen
la estética y las animaciones. Quedan dos decisiones abiertas para Alejo (abajo).

## Qué cambió (resumen técnico)

| # | Tema | Dónde | Decisión |
|---|------|-------|----------|
| 1 | Reporte doble a recompensas | `services/game-modes.js` | `completeChallengeSession` cierra y reporta **una vez por sesión** (Set en memoria + chequeo de `ended_at` en DB). Una 2ª llamada solo mezcla metadata. Nuevo `saveSessionXpView()` para el código nuevo. No se tocaron las 2ª llamadas de cada juego: el guard cubre a los 14. |
| 2 | Zona horaria | nuevo `services/app-date.js` | `appToday()`, `appDayStart()`, `appDayStartIso()`, `appDateKey()`, `msUntilAppMidnight()` en `America/Argentina/Buenos_Aires` (= `app_today()` del server). Lo usan disponibilidad, semilla diaria (`seeded-random`, tablero de Conexiones) y rachas. |
| 3 | "Mirar y reintentar" | `game-modes.js` | **Toda sesión empezada cuenta como intento.** Elegido sobre "reanudar" porque reanudar exige serializar el estado de 14 juegos distintos; esto es un cambio en un solo lugar. La revisión muestra el abandono como derrota en 0 (`metadata.abandoned`). Racha: manda la última sesión terminada del día; un día pasado solo con abandonos = derrota; hoy sin terminar no cuenta todavía. |
| 4 | Reloj en segundo plano | `mixins/timedChallenge.js`, `OnceIdeal.vue` | Tiempo restante = fecha límite (`Date.now`), tick de 250 ms y resync en `visibilitychange`. Salir de la app ya no frena el reloj. |
| 5 | Mayor o Menor 0 puntos al perder | `HigherOrLower.vue` | La cadena final se congela antes de la animación de ruptura. |
| 6 | Posición predecible | `game-common.js`, `player-position.js` | Bolsa mezclada con el RNG del juego (semilla diaria) en vez de rotación fija. Posición: 3 de cada posición por vuelta, sin repetir jugador. |
| 7 | ¿Quién es? | `guess-player-typing.js`, `WhoIs.vue`, `games.js` | Repetir nombre no cuesta vida. Pistas por cantidad de errores + por tiempo (Difícil 15/30 s; resto 30/60 s). Tip falso corregido. |
| 8 | Textos | Ordenar, Adiviná, `matchFicha` | Puntaje `/60·/100·/140`, ficha `/3·/5·/7`, "60/45/30 s". Fallbacks a 20 pts por jugador. |
| 9 | Bugs chicos | 4 juegos + Wordle + Grilla | `gameSummaryBlurb` sin importar (Valor, Edad, Altura, Camiseta). Revisión de Wordle/Once lee `xpView.xpEarned`. `PlayerSearch.focus()` expuesto. |
| 10 | Once Ideal | `OnceIdeal.vue`, `SQUAD_DIFFICULTY_CONFIG` | Restricción por semilla del día y solo entre las que cubren la 4-3-3 por posición. 240/180/120 s. Candado de nivel 18 dentro del juego → `/play/points` + aviso. |
| 11 | `DAILY_GAMES` | `game-modes.js` | = todos los juegos conocidos no pausados (14). Afecta superlogro 5x3, rachas del perfil y fallback del conteo. |
| 12 | Ayudas | `PowerupBar.vue`, mixin | Prop `canApply` consultado **antes** de consumir en el server (y para deshabilitar el botón). |
| 13 | Celular | `PlayerSearch`, `GameShell`, `style.css`, Wordle, `OrderLadder`, Grilla | Ver commit "partidas que entran en celus chicos". Verificado con Chrome headless: Adiviná entra sin scroll en 375×667 y 375×560. |
| 14 | Siguiente juego | `GameSummaryPopup.vue`, `findNextDailyGame()` | CTA principal; sin juegos pendientes → "Ver juegos del día". |

**Fuera de mi alcance, a revisar:** `index.html` no tiene `viewport-fit=cover`, así que
`env(safe-area-inset-*)` vale 0 hasta que se agregue (no es archivo mío). Landing y
PlayPoints muestran `ficha.score` sin cambios; ahora además viene `ficha.abandoned`
por si quieren marcarlo.

## Nota de diseño 1 — `useChallengeSession` (pendiente de OK)

Hoy cada juego repite ~60 líneas: snapshot de nivel antes, `startChallengeSession`,
`awardXpBatch`, `completeChallengeSession` ×2, snapshot después, animación de
barra, `fetchLifetimeMaxStreak`, `checkAndUnlockDailyWins`, y modo revisión.
Las diferencias entre juegos (qué metadata guardar, umbral de victoria) se
pasan como parámetros.

Propuesta (composable o mixin, para Options API sirve mixin):

```js
const s = useChallengeSession('who-is')
await s.start({ difficulty, seconds })          // snapshot + sesión + rng diario
await s.finish({ result, score, xp, corrects, meta }) // XP, cierre único, xpView, logros
const last = await s.loadReview()               // revisión (incluye abandonos)
s.summaryProps                                   // props listos para GameSummaryPopup
```

- Guarda el estado de la sesión (id, `finished`) → imposible cerrar dos veces.
- Invitados: misma API, por dentro `setPendingGuestClaim`.
- Migración: un juego por commit, empezando por los contrarreloj (comparten mixin).
- Riesgo: bajo si se migra de a uno con prueba manual; ~1 día.

## Nota de diseño 2 — fusionar los 3 juegos de Ordenar (pendiente de OK)

Valor, Edad y Altura son el mismo juego (OrderLadder + mismo flujo) con otro dato
y otra metáfora (`stairs` / `timeline` / `team`). Tres desafíos diarios casi
idénticos inflan la lista y aburren.

Opción A (recomendada): **un solo "Ordená"** con 3 rondas por partida (valor →
edad → altura, 3/5/7 jugadores según dificultad). Gana si ordena bien las 3. Un
solo slug nuevo (`order`); los 3 viejos quedan pausados (`PAUSED_GAMES`) para
no romper historial ni logros. Ojo: logros y rachas por slug viejo → decidir si
se migran o se congelan.

Opción B: un solo juego con el **criterio del día** sorteado por semilla.

## Veredicto por juego

| Juego | Veredicto | Por qué |
|---|---|---|
| Adiviná el jugador | **Mantener** | El mejor loop: foto que se aclara + reloj + XP por velocidad. |
| Nacionalidad | **Pulir** | Banderas lindas; con jugadores muy conocidos se vuelve fácil. Revisar pool por dificultad. |
| Posición del jugador | **Pulir / repensar** | Con 4 opciones = las 4 posiciones, es 25 % al azar. Sumar posiciones finas (LD/DFC/MC/EI…) en Difícil. |
| Número de camiseta | **Mantener** | Difícil y muy "de hincha". |
| ¿Quién es? | **Mantener** | Ahora con pistas en Difícil. Es la única con buscador: candidato a "juego estrella" del día. |
| Valor / Edad / Altura | **Fusionar** | Ver nota 2. |
| Wordle | **Mantener** | Gran juego diario, el más compartible. |
| Mayor o Menor | **Pulir** | Bien en ritmo; falta variedad de stat por ronda y cierre al perder más claro. |
| Conexiones | **Mantener** | Muy bueno; tablero diario ya determinístico. |
| La Grilla | **Mantener** | Buscador ya apto celu; revisar que siempre haya solución en 1 intento/celda (Difícil). |
| Duelo de Stats | **Pulir** | Depende de que el refresco semanal traiga stats; no se probó a fondo en celu chico (usa otro layout, `ds-*`). |
| Once Ideal | **Pulir** | Ahora diario y con dificultades reales; el nivel 18 lo esconde a la mayoría: evaluar bajarlo. |

Ninguno para **cortar** en esta pasada.
