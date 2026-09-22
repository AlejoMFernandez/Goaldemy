# Modo invitado: rollout completo + índice unificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir el índice real de juegos (`/play/points`) sin login, extender el modo invitado (ya probado en 4 juegos) a los 9 juegos restantes, ocultar Once Ideal y vaciar el desbloqueo por nivel, y sacar el CTA "Jugá gratis" separado a favor del link "Jugar por puntos" que ya existe.

**Architecture:** Cada uno de los 9 juegos recibe el MISMO patrón ya shippeado 4 veces (`isGuest` computed → rama en el handler de fin de partida que llama `setPendingGuestClaim` en vez de `awardXpBatch` → prop `:guest="isGuest"` en `GameSummaryPopup`), usando exactamente el mismo par `corrects`/`total` que cada juego ya pasa a `GameSummaryPopup`. `guest-play.js`, `GameSummaryPopup.vue` y el RPC `claim_guest_game_reward` no cambian — ya son genéricos por diseño. El desbloqueo por nivel se vacía de datos (no se borra el mecanismo) y Once Ideal se oculta por filtro client-side, sin tocar Supabase.

**Tech Stack:** Vue 3 (Options API), sin runner de tests automatizado — cada tarea termina con `npm run build` + verificación manual.

**Spec:** `docs/superpowers/specs/2026-09-22-guest-mode-full-rollout-design.md`

## Global Constraints

- Ningún juego de esta tanda necesita rama especial para `captureLevelSnapshot()`, `completeChallengeSession()`, `checkAndUnlockDailyWins()` — ya no-opean de forma segura sin `userId` (mismo comportamiento confirmado y usado en los 4 juegos de la ronda anterior). Solo `awardXpBatch` necesita la rama guest/logueado.
- El par `corrects`/`total` que se le pasa a `setPendingGuestClaim` en cada juego DEBE ser exactamente el mismo que ya recibe `<GameSummaryPopup>` vía `:corrects`/`:winThreshold` — ver la tabla de la spec, ya verificada contra el código real.
- No tocar `src/services/guest-play.js`, `src/components/game/GameSummaryPopup.vue`, ni `src/pages/games/GuessPlayer.vue` — genéricos/ya correctos, fuera de alcance.
- No borrar la fila `once-ideal` de la tabla `games` en Supabase — solo se filtra client-side.
- Sin runner de tests: cada tarea termina con `npm run build` (debe compilar sin errores) + una verificación manual puntual.

---

## Task 1: Router — abrir `/play/points` y los 9 juegos restantes

**Files:**
- Modify: `src/router/router.js`

- [ ] **Step 1: Quitar `requiresAuth: true` de `/play/points`**

Buscar:
```js
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Jugar', noindex: true } } },
```
Reemplazar por:
```js
    { path: '/play/points', component: PlayPoints, meta: { zone: 'hub', seo: { title: 'Jugar', noindex: true } } },
```

- [ ] **Step 2: Quitar `requiresAuth: true` de los 9 juegos restantes**

Para cada una de estas 9 líneas, quitar únicamente el segmento `requiresAuth: true, ` (dejando el resto del objeto `meta` intacto):

```js
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Nacionalidad', noindex: true } } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Posición del jugador', noindex: true } } },
    { path: '/games/value-order', component: ValueOrder, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Orden por valor', noindex: true } } },
    { path: '/games/age-order', component: AgeOrder, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Orden por edad', noindex: true } } },
    { path: '/games/height-order', component: HeightOrder, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Orden por altura', noindex: true } } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Número de camiseta', noindex: true } } },
    { path: '/games/football-wordle', component: FootballWordle, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Football Wordle', noindex: true } } },
    { path: '/games/connections', component: Connections, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Conexiones', noindex: true } } },
    { path: '/games/stat-challenge', component: StatChallenge, meta: { requiresAuth: true, zone: 'play', seo: { title: 'Desafío de estadísticas', noindex: true } } },
```

resultan en:

```js
    { path: '/games/nationality', component: NationalityGame, meta: { immersive: true, zone: 'play', seo: { title: 'Nacionalidad', noindex: true } } },
    { path: '/games/player-position', component: PlayerPosition, meta: { immersive: true, zone: 'play', seo: { title: 'Posición del jugador', noindex: true } } },
    { path: '/games/value-order', component: ValueOrder, meta: { immersive: true, zone: 'play', seo: { title: 'Orden por valor', noindex: true } } },
    { path: '/games/age-order', component: AgeOrder, meta: { immersive: true, zone: 'play', seo: { title: 'Orden por edad', noindex: true } } },
    { path: '/games/height-order', component: HeightOrder, meta: { immersive: true, zone: 'play', seo: { title: 'Orden por altura', noindex: true } } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { immersive: true, zone: 'play', seo: { title: 'Número de camiseta', noindex: true } } },
    { path: '/games/football-wordle', component: FootballWordle, meta: { immersive: true, zone: 'play', seo: { title: 'Football Wordle', noindex: true } } },
    { path: '/games/connections', component: Connections, meta: { immersive: true, zone: 'play', seo: { title: 'Conexiones', noindex: true } } },
    { path: '/games/stat-challenge', component: StatChallenge, meta: { zone: 'play', seo: { title: 'Desafío de estadísticas', noindex: true } } },
```

- [ ] **Step 3: NO tocar la ruta de `once-ideal`**

Verificar con `grep -n "once-ideal" src/router/router.js` que la línea sigue con `requiresAuth: true` — se deja así a propósito (el juego sigue existiendo, solo se oculta del índice en tareas posteriores).

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: compila sin errores.

Manual: `npm run dev`, sin sesión iniciada, navegar directo a `/play/points` → debe cargar el índice (no redirigir a `/login`).

- [ ] **Step 5: Commit**

```bash
git add src/router/router.js
git commit -m "feat: abrir /play/points y 9 juegos más para modo invitado"
```

---

## Task 2: `level-rewards.js` — vaciar el desbloqueo por nivel

**Files:**
- Modify: `src/services/level-rewards.js`

- [ ] **Step 1: Quitar la entrada de `once-ideal` de `GAME_UNLOCK_LEVELS`**

Buscar:
```js
export const GAME_UNLOCK_LEVELS = {
  'guess-player': 1,
  'nationality': 1,
  'player-position': 1,
  'shirt-number': 1,
  'who-is': 1,
  'value-order': 1,
  'age-order': 1,
  'height-order': 1,
  'once-ideal': 18,
}
```
Reemplazar por:
```js
export const GAME_UNLOCK_LEVELS = {
  'guess-player': 1,
  'nationality': 1,
  'player-position': 1,
  'shirt-number': 1,
  'who-is': 1,
  'value-order': 1,
  'age-order': 1,
  'height-order': 1,
}
```

- [ ] **Step 2: Quitar la entrada de `once-ideal` de `GAME_NAMES`**

Buscar:
```js
const GAME_NAMES = {
  'guess-player': 'Adivina el Jugador',
  'nationality': 'Nacionalidad',
  'player-position': 'Posición del Jugador',
  'shirt-number': 'Número de Camiseta',
  'who-is': '¿Quién Es?',
  'value-order': 'Orden por Valor',
  'age-order': 'Orden por Edad',
  'height-order': 'Orden por Altura',
  'once-ideal': 'Once Ideal',
}
```
Reemplazar por:
```js
const GAME_NAMES = {
  'guess-player': 'Adivina el Jugador',
  'nationality': 'Nacionalidad',
  'player-position': 'Posición del Jugador',
  'shirt-number': 'Número de Camiseta',
  'who-is': '¿Quién Es?',
  'value-order': 'Orden por Valor',
  'age-order': 'Orden por Edad',
  'height-order': 'Orden por Altura',
}
```

No tocar ninguna otra función de este archivo (`isGameUnlocked`, `getGameUnlockLevel`, `getLevelRewards`, `getUpcomingRewards`, `getLevelUnlocks`, los cosméticos, los milestones) — quedan tal cual, ahora simplemente no encuentran ninguna entrada de juego por encima de nivel 1.

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: compila sin errores. `grep -n "once-ideal" src/services/level-rewards.js` → sin resultados.

- [ ] **Step 4: Commit**

```bash
git add src/services/level-rewards.js
git commit -m "chore: vaciar el desbloqueo por nivel de once-ideal (se oculta, no se borra el mecanismo)"
```

---

## Task 3: `PlayPoints.vue` — ocultar Once Ideal del índice

**Files:**
- Modify: `src/pages/PlayPoints.vue`

- [ ] **Step 1: Agregar el filtro**

Buscar (línea ~30, dentro de `load()`):
```js
    const list = (all || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
```
Reemplazar por:
```js
    const list = (all || []).filter(g => !!g?.slug && g.slug !== 'once-ideal' && gameRouteForSlug(g.slug) !== '/games')
```

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: compila sin errores.

Manual: `npm run dev`, ir a `/play/points` (logueado o no) → Once Ideal no debe aparecer en la grilla de juegos.

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlayPoints.vue
git commit -m "chore: ocultar Once Ideal del índice de juegos"
```

---

## Task 4: `Landing.vue` — ocultar Once Ideal de la home

**Files:**
- Modify: `src/pages/Landing.vue`

Este archivo puede tener trabajo en curso sin commitear del dueño del proyecto en zonas NO relacionadas a esta línea — el cambio de este task es de una sola línea, acotado. Si el texto de "Antes" de abajo no matchea exactamente el archivo actual, DETENERSE y reportar (no adivinar ni tocar nada más del archivo).

- [ ] **Step 1: Agregar el filtro**

Buscar (dentro de `load()`):
```js
    const playable = (allGames || []).filter(g => !!g?.slug && gameRouteForSlug(g.slug) !== '/games')
```
Reemplazar por:
```js
    const playable = (allGames || []).filter(g => !!g?.slug && g.slug !== 'once-ideal' && gameRouteForSlug(g.slug) !== '/games')
```

No tocar ninguna otra línea de este archivo.

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Landing.vue
git commit -m "chore: ocultar Once Ideal de la vidriera de juegos en la home"
```

---

## Task 5: Nav — sacar el CTA "Jugá gratis" separado

**Files:**
- Modify: `src/components/AppNavBar.vue` (4 lugares)
- Modify: `src/components/AppFooter.vue`
- Modify: `src/pages/info/AboutFulvo.vue`

El link "Jugar por puntos" (a `/play/points`) YA EXISTE en los 3 archivos y no se toca — queda como el único punto de entrada, ahora funcionando para cualquiera gracias al Task 1.

- [ ] **Step 1: `AppNavBar.vue` — píldora de escritorio (líneas 483-492)**

Eliminar el bloque completo:
```html
                    <!-- Jugá gratis — píldora de acento (funnel público, sin cuenta) -->
                    <li>
                        <RouterLink to="/games/guess-player?mode=challenge" class="nav-pill nav-pill--cyan">
                            <span class="relative flex h-2 w-2">
                                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                                <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
                            </span>
                            Jugá gratis
                        </RouterLink>
                    </li>
```
(la lista `<ul class="hidden lg:flex ...">` pasa a empezar directo con el `<li>` de "Jugar (dropdown)").

- [ ] **Step 2: `AppNavBar.vue` — item del dropdown "Jugar" (líneas 506-509)**

Eliminar:
```html
                            <RouterLink @click="playOpen=false" to="/games/guess-player?mode=challenge" class="nav-menu-item">
                                <div class="nav-menu-item-title">Jugá gratis</div>
                                <p class="nav-menu-item-sub">Probá un juego real ahora mismo. Sin login.</p>
                            </RouterLink>
```
Dejando el `<RouterLink to="/play/points" class="nav-menu-item">...Jugar por puntos...</RouterLink>` que está justo arriba como único item del dropdown, y el `</div>`/`</transition>` que cierran el menú intactos.

- [ ] **Step 3: `AppNavBar.vue` — menú mobile, item destacado (líneas 765-774)**

Eliminar el bloque completo:
```html
                        <li>
                            <RouterLink @click="isOpen=false" to="/games/guess-player?mode=challenge" class="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2.5 font-bold text-cyan-300 hover:bg-cyan-500/15">
                                <span class="relative flex h-2 w-2">
                                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                                    <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
                                </span>
                                Jugá gratis
                            </RouterLink>
                        </li>
```
(el `<!-- Nav items -->` comment de arriba queda, seguido directo por el `<li>` del `<details>` "Jugar").

- [ ] **Step 4: `AppNavBar.vue` — menú mobile, submenú "Jugar" (línea 780)**

Eliminar la línea:
```html
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/games/guess-player?mode=challenge">Jugá gratis</RouterLink></li>
```
Dejando solo el `<li>` de "Jugar por puntos" dentro de ese `<ul>`.

- [ ] **Step 5: `AppFooter.vue` (línea 47)**

Eliminar la línea:
```html
            <li><RouterLink to="/games/guess-player?mode=challenge" class="text-slate-400 hover:text-emerald-400 transition">Jugá gratis</RouterLink></li>
```

- [ ] **Step 6: `AboutFulvo.vue` (líneas 130-132)**

Eliminar el bloque:
```html
            <RouterLink to="/games/guess-player?mode=challenge" class="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-6 py-3 font-semibold text-cyan-400 transition hover:bg-cyan-500/10 hover:border-cyan-400/50">
              Jugá gratis
            </RouterLink>
```
Dejando el `<RouterLink to="/play/points">...PlayPoints...</RouterLink>` de arriba y el `<RouterLink to="/leaderboards">...Leaderboards...</RouterLink>` de abajo como están.

- [ ] **Step 7: Verificar**

Run: `npm run build`
Expected: compila sin errores. `grep -rn "guess-player?mode=challenge\|Jugá gratis" src/components/AppNavBar.vue src/components/AppFooter.vue src/pages/info/AboutFulvo.vue` → sin resultados.

Manual: revisar navbar desktop, menú mobile, footer y `/about-fulvo` → el único CTA de juego es "Jugar por puntos"/"PlayPoints", sin duplicados.

- [ ] **Step 8: Commit**

```bash
git add src/components/AppNavBar.vue src/components/AppFooter.vue src/pages/info/AboutFulvo.vue
git commit -m "chore: sacar el CTA Jugá gratis, Jugar por puntos queda como único punto de entrada"
```

---

## Task 6: Revertir `backPath()` de WhoIs, Mayor o Menor y La Grilla

Con `/play/points` público (Task 1), ya no hace falta la rama especial que mandaba a los invitados a `/` en vez de al índice.

**Files:**
- Modify: `src/pages/games/WhoIs.vue`
- Modify: `src/pages/games/HigherOrLower.vue`
- Modify: `src/pages/games/FootballGrid.vue`

- [ ] **Step 1: `WhoIs.vue`**

Buscar:
```js
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
```
Reemplazar por:
```js
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
```

- [ ] **Step 2: `HigherOrLower.vue`**

Mismo cambio: buscar
```js
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
```
reemplazar por
```js
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
```

- [ ] **Step 3: `FootballGrid.vue`**

Mismo cambio: buscar
```js
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
```
reemplazar por
```js
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
```

No tocar el resto de `isGuest`, `setPendingGuestClaim`, ni las props `:guest`/`:resultLine` de estos 3 archivos — siguen igual.

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/pages/games/WhoIs.vue src/pages/games/HigherOrLower.vue src/pages/games/FootballGrid.vue
git commit -m "chore: revertir backPath especial de invitado, /play/points ya es público"
```

---

## Task 7: Modo invitado — Nacionalidad, Posición, Número de camiseta, Desafío de estadísticas

Los 4 juegos con el mismo patrón exacto: `finishChallenge(result)`, `if (this.allowXp && this.xpEarned > 0)`, `corrects: this.corrects`, `total: 10` (winThreshold ya es 10 o el default), `maxStreak: this.maxStreak`. Ningún juego de este grupo necesita `resultLine` custom (la grilla default de "X de 10 preguntas" ya es apropiada, mismo criterio que se usó para La Grilla en la ronda anterior).

**Files:**
- Modify: `src/pages/games/NationalityGame.vue`
- Modify: `src/pages/games/PlayerPosition.vue`
- Modify: `src/pages/games/ShirtNumber.vue`
- Modify: `src/pages/games/StatChallenge.vue`

### `NationalityGame.vue`

- [ ] **Step 1: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 7), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 2: `isGuest` computed** — en el bloque `computed` (línea 54-57), después de `gameMetadata()`, agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 3: Ramificar `finishChallenge()`** — reemplazar (línea 187-190):
```js
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'nationality', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```
por:
```js
    async finishChallenge(result) {
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'nationality', corrects: this.corrects, total: 10, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'nationality', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```
(dejar el resto del método — `completeChallengeSession`, `captureLevelSnapshot`, etc. — sin tocar).

- [ ] **Step 4: Prop `:guest` en el popup** — en `<GameSummaryPopup ...>` (línea ~303), agregar junto a `backPath="/play/points"`:
```html
            :guest="isGuest"
```
(esta línea SIGUE con `backPath="/play/points"` como string estático — no tocarla, ya apunta al índice público).

### `PlayerPosition.vue`

- [ ] **Step 5: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 15), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 6: `isGuest` computed** — en `computed` (línea 55-57), agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 7: Ramificar `finishChallenge()`** — reemplazar (línea 167-170):
```js
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'player-position', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```
por:
```js
    async finishChallenge(result) {
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'player-position', corrects: this.corrects, total: 10, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'player-position', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

- [ ] **Step 8: Prop `:guest`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="10"` (línea 287):
```html
          :guest="isGuest"
```

### `ShirtNumber.vue`

- [ ] **Step 9: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 5), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 10: `isGuest` computed** — en `computed` (línea 22-24), agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 11: Ramificar `finishChallenge()`** — reemplazar (línea 244-247):
```js
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'shirt-number', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```
por:
```js
    async finishChallenge(result) {
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'shirt-number', corrects: this.corrects, total: 10, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'shirt-number', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

- [ ] **Step 12: Prop `:guest`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="10"` (línea 361):
```html
          :guest="isGuest"
```

### `StatChallenge.vue`

- [ ] **Step 13: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 5), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 14: `isGuest` computed** — en `computed` (línea 57-60), agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 15: Ramificar `finishChallenge()`** — reemplazar (línea 243-246):
```js
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'stat-challenge', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```
por:
```js
    async finishChallenge(result) {
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'stat-challenge', corrects: this.corrects, total: 10, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'stat-challenge', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

- [ ] **Step 16: Prop `:guest`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="10"` (línea 382):
```html
          :guest="isGuest"
```

- [ ] **Step 17: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 18: Commit**

```bash
git add src/pages/games/NationalityGame.vue src/pages/games/PlayerPosition.vue src/pages/games/ShirtNumber.vue src/pages/games/StatChallenge.vue
git commit -m "feat: modo invitado en Nacionalidad, Posición, Número de camiseta y Desafío de estadísticas"
```

---

## Task 8: Modo invitado — Orden por valor, edad y altura

Los 3 juegos comparten estructura: `correctPositions` es una variable local (ya calculada antes del bloque a editar), `winThreshold` también es local = `this.slots.length`, `maxStreak` siempre `0` (no aplica a este tipo de juego), y el `awardXpBatch` ya está envuelto en un `try {} catch {}` en vez de `.catch()`. Ninguno necesita `resultLine` custom.

**Files:**
- Modify: `src/pages/games/ValueOrder.vue`
- Modify: `src/pages/games/AgeOrder.vue`
- Modify: `src/pages/games/HeightOrder.vue`

### `ValueOrder.vue`

- [ ] **Step 1: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 7), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 2: `isGuest` computed** — en `computed` (línea 18-20), agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 3: Ramificar el award de XP** — reemplazar (línea 201-203):
```js
        if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'value-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
```
por:
```js
        if (this.isGuest) {
          if (this.xpEarned > 0) {
            setPendingGuestClaim({ game: 'value-order', corrects: correctPositions, total: winThreshold, maxStreak: 0 })
          }
        } else if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'value-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
```
(`winThreshold` ya es una variable local en este mismo bloque, definida un par de líneas antes — no hace falta declararla de nuevo).

- [ ] **Step 4: Prop `:guest`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="slots.length"` (línea 350):
```html
          :guest="isGuest"
```

### `AgeOrder.vue`

- [ ] **Step 5: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 7), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 6: `isGuest` computed** — en `computed` (línea 18-20), agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 7: Ramificar el award de XP** — reemplazar (línea 169-171):
```js
        if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'age-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
```
por:
```js
        if (this.isGuest) {
          if (this.xpEarned > 0) {
            setPendingGuestClaim({ game: 'age-order', corrects: correctPositions, total: winThreshold, maxStreak: 0 })
          }
        } else if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'age-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
```

- [ ] **Step 8: Prop `:guest`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="slots.length"` (línea 314):
```html
          :guest="isGuest"
```

### `HeightOrder.vue`

- [ ] **Step 9: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 7), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 10: `isGuest` computed** — en `computed` (línea 18-20), agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 11: Ramificar el award de XP** — reemplazar (línea 168-170):
```js
        if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'height-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
```
por:
```js
        if (this.isGuest) {
          if (this.xpEarned > 0) {
            setPendingGuestClaim({ game: 'height-order', corrects: correctPositions, total: winThreshold, maxStreak: 0 })
          }
        } else if (this.allowXp && this.xpEarned > 0) {
          try { await awardXpBatch({ gameCode: 'height-order', totalXp: this.xpEarned, corrects: correctPositions }) } catch {}
        }
```

- [ ] **Step 12: Prop `:guest`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="slots.length"` (línea 312):
```html
          :guest="isGuest"
```

- [ ] **Step 13: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 14: Commit**

```bash
git add src/pages/games/ValueOrder.vue src/pages/games/AgeOrder.vue src/pages/games/HeightOrder.vue
git commit -m "feat: modo invitado en Orden por valor, edad y altura"
```

---

## Task 9: Modo invitado — Football Wordle y Conexiones

**Files:**
- Modify: `src/pages/games/FootballWordle.vue`
- Modify: `src/pages/games/Connections.vue`

### `FootballWordle.vue`

Único juego de esta tanda de 9 con `winThreshold=1` (una sola adivinanza) — necesita `resultLine` custom, mismo criterio que WhoIs en la ronda anterior. Nota: la condición original es `if (this.xpEarned > 0)`, SIN `this.allowXp` — se mantiene igual para la rama no-invitado.

- [ ] **Step 1: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 7), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 2: `isGuest` computed** — en `computed` (línea 100-101), después de `gameMetadata()`, agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 3: Ramificar el award de XP** — reemplazar (línea 284-286):
```js
      if (this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'football-wordle', totalXp: this.xpEarned, corrects: this.won ? 1 : 0 }).catch(() => {})
      }
```
por:
```js
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'football-wordle', corrects: this.won ? 1 : 0, total: 1, maxStreak: 0 })
        }
      } else if (this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'football-wordle', totalXp: this.xpEarned, corrects: this.won ? 1 : 0 }).catch(() => {})
      }
```

- [ ] **Step 4: Props `:guest` y `:resultLine`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="1"` (línea 519):
```html
          :guest="isGuest"
          :resultLine="isGuest ? (won ? '¡Adiviné el crack! ✅' : 'No lo adiviné esta vez') : ''"
```

### `Connections.vue`

- [ ] **Step 5: Imports** — después de `import { awardXpBatch } from '../../services/game-xp'` (línea 9), agregar:
```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 6: `isGuest` computed** — en `computed` (línea 131-134), después de `gameMetadata()`, agregar:
```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 7: Ramificar `finishChallenge()`** — reemplazar (línea 334-337):
```js
    async finishChallenge(result) {
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'connections', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```
por:
```js
    async finishChallenge(result) {
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'connections', corrects: this.corrects, total: 4, maxStreak: 0 })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'connections', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

- [ ] **Step 8: Prop `:guest`** — en `<GameSummaryPopup ...>`, agregar junto a `:winThreshold="4"` (línea 487):
```html
          :guest="isGuest"
```

- [ ] **Step 9: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 10: Commit**

```bash
git add src/pages/games/FootballWordle.vue src/pages/games/Connections.vue
git commit -m "feat: modo invitado en Football Wordle y Conexiones"
```

---

## Task 10: Verificación manual end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 2: Índice sin login**

`npm run dev`, sin sesión. Ir directo a `/play/points` → debe cargar (no redirigir a `/login`). Once Ideal NO debe aparecer en la grilla. Ningún juego debe verse bloqueado con candado.

- [ ] **Step 3: Jugar varios de los 9 juegos nuevos como invitado**

Desde `/play/points`, tocar al menos 4 juegos distintos de los 9 de esta tanda (ej: Nacionalidad, Orden por valor, Football Wordle, Conexiones) y completarlos. Cada uno debe mostrar el popup de resultado en su rama invitado (cards de XP/Fichas, sin barra de nivel, muro de "Reclamar mis recompensas" → registro).

- [ ] **Step 4: Acumulación cruzada**

Sin registrarse, jugar 2-3 juegos de esta tanda nueva junto con alguno de los 4 ya existentes (ej: WhoIs) → el banner de acumulado debe sumar TODOS, no solo los de una tanda. Confirmar en devtools que `localStorage['goaldemy_guest_play_pending']` tiene todas las claves jugadas.

- [ ] **Step 5: Regresión — usuario logueado**

Con una cuenta ya logueada, jugar 2-3 de los 9 juegos nuevos → comportamiento idéntico a antes (XP real, sin cambios visibles). Verificar que `/play/points` para un usuario logueado se ve igual que siempre (nivel real, racha real, sin juegos bloqueados salvo que antes tampoco lo estuvieran).

- [ ] **Step 6: Navegación**

Revisar navbar desktop, menú mobile, footer y `/about-fulvo` → un solo CTA de juego ("Jugar por puntos"/"PlayPoints"), sin "Jugá gratis" duplicado. Confirmar que ese link ahora funciona sin sesión iniciada.

- [ ] **Step 7: Home**

Ir a `/` sin sesión → la vidriera de juegos de la home no debe mostrar Once Ideal.

- [ ] **Step 8: Reporte final**

Si algún paso falla, no marcar la tarea como completa — volver al task correspondiente y corregir antes de seguir.
