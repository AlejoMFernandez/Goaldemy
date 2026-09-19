# Modo invitado en juegos reales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el "Reto del día" (motor de quiz propio, desconectado de los juegos reales) por modo invitado en 3 juegos reales piloto (WhoIs, Mayor o Menor, La Grilla), con recompensas que se acumulan entre juegos hasta que el invitado se registra.

**Architecture:** `/games/guess-player` (Adivina el jugador) **ya es** un piloto de modo invitado funcionando en producción hoy (ruta pública, sin `requiresAuth`) — replicamos exactamente su patrón (`isGuest` computed, rama en el handler de fin de partida que llama `setPendingGuestClaim` en vez de `awardXpBatch`, prop `:guest="isGuest"` en `GameSummaryPopup`) en los 3 juegos piloto nuevos. `guest-play.js` pasa de guardar un único pendiente (se pisaba si jugabas dos juegos) a un mapa por juego, para que las recompensas se acumulen. `GameSummaryPopup.vue` (ya tiene una rama `guest`, solo le falta mostrar Fichas, el acumulado y un teaser de logro/cosmético simulado) se extiende en vez de crear un componente nuevo. Se elimina `daily-reto.js`/`DailyChallenge.vue`/`duels.js` y todo lo que los referencia.

**Tech Stack:** Vue 3 (Options API, igual que el resto de `src/pages/games/`), Supabase (RPC `claim_guest_game_reward` ya existe, no se toca), sin runner de tests automatizado en este proyecto — el paso de "test" de cada tarea es build (`npm run build`) + verificación manual en el navegador, igual que el resto de los planes de este repo.

**Spec:** `docs/superpowers/specs/2026-09-18-guest-play-real-games-design.md`

## Global Constraints

- No se modifica el RPC `claim_guest_game_reward` (`supabase/guest-game-claim.sql`) ni su firma `(p_game_slug, p_corrects, p_total, p_max_streak, p_day_key)`. Ya sanea `total` a 1..20 y calcula `perfect = corrects >= total` — cualquier `corrects`/`total` que se le pase del lado cliente tiene que ser el MISMO par que ya se muestra en pantalla para ese juego (prop `corrects`/`winThreshold` de `GameSummaryPopup`), para que el preview local y el reclamo real coincidan.
- Fórmula de recompensa-preview (ya usada por el RPC, migrada literal desde `daily-reto.js`): `xp = min(corrects*10 + (perfect?50:0), 150)`, `fichas = min(corrects*4 + (perfect?20:0), 60)`.
- No tocar `src/pages/games/GuessPlayer.vue` — ya está en producción y fuera del alcance de esta spec. Sirve solo de referencia/patrón a copiar.
- `captureLevelSnapshot()`, `completeChallengeSession()`, `checkAndUnlockDailyWins()` NO necesitan rama especial para invitados — ya no-opean de forma segura sin `userId` (confirmado: es el comportamiento real y ya shippeado de `GuessPlayer.vue` hoy). Solo `awardXpBatch` necesita la rama guest/logueado.
- Copy de marca: "FULVO" siempre en mayúscula en texto visible.
- Sin runner de tests: cada tarea termina con `npm run build` (debe compilar sin errores) + una verificación manual puntual descrita en el paso.

---

## Task 1: Mover `todayKey()` a `game-common.js`

Desbloquea poder borrar `daily-reto.js` más adelante sin romper `career.js` (lo único que le queda importando de ahí es este helper de fecha).

**Files:**
- Modify: `src/services/game-common.js`
- Modify: `src/services/career.js:17`

**Interfaces:**
- Produces: `export function todayKey(): string` en `game-common.js` (formato `YYYY-MM-DD`, hora local).

- [ ] **Step 1: Agregar `todayKey()` a `game-common.js`**

Al final de `src/services/game-common.js`, agregar:

```js
/** Clave del día en horario local (YYYY-MM-DD). Usada por sistemas que necesitan
 * "un resultado por día" sin depender de una cuenta (invitados, Modo Carrera). */
export function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
```

- [ ] **Step 2: Actualizar el import en `career.js`**

En `src/services/career.js:17`, cambiar:

```js
import { todayKey } from './daily-reto'
```

por:

```js
import { todayKey } from './game-common'
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: compila sin errores. `grep -rn "todayKey" src/services/career.js` debe seguir mostrando su único uso en la línea del `localStorage.setItem`.

- [ ] **Step 4: Commit**

```bash
git add src/services/game-common.js src/services/career.js
git commit -m "refactor: mover todayKey a game-common.js (prepara borrado de daily-reto.js)"
```

---

## Task 2: Generalizar `guest-play.js` — mapa por juego + reclamo en loop

Hoy `guest-play.js` guarda UN solo pendiente (`goaldemy_guest_play_pending` como objeto). Si un invitado juega dos juegos sin registrarse, el segundo pisa al primero. Pasa a ser un mapa `{ [gameSlug]: {...} }`.

**Files:**
- Modify: `src/services/guest-play.js` (reescritura completa)

**Interfaces:**
- Consumes: nada nuevo (sigue sin dependencias externas hasta que se llama).
- Produces:
  - `setPendingGuestClaim({ game, corrects, total, maxStreak = 0 })` — MISMA firma que hoy, no rompe a `GuessPlayer.vue` que ya la usa.
  - `computeGuestRewards(corrects = 0, total = 0) → { xp, fichas, perfect, xpForLevel2, pct, levelUp, remaining }` — nueva, usada por `GameSummaryPopup.vue` (Task 4).
  - `getPendingGuestSummary() → { count, games: string[], xp, fichas }` — nueva, usada por `GameSummaryPopup.vue` (Task 4).
  - `claimPendingGuestReward() → Promise<{xp,fichas}|null>` — MISMA firma que hoy (sin args), sigue siendo lo único que llama `App.vue`.

- [ ] **Step 1: Reescribir `src/services/guest-play.js`**

```js
/**
 * MODO INVITADO EN JUEGOS REALES
 *
 * El invitado juega un desafío real sin cuenta, ve en el popup de resultado
 * la XP/Fichas que "ganó", y esa recompensa queda pendiente en localStorage
 * hasta que se registra. Si juega varios juegos sin registrarse, se acumulan
 * TODOS (un mapa por juego — rejugar el mismo juego antes de registrarse
 * actualiza esa entrada, no la duplica ni la suma). Al loguearse por primera
 * vez con email confirmado, claimPendingGuestReward() los reclama DE VERDAD
 * vía RPC (otorga XP + Fichas server-side, 1 vez por usuario+juego+día). Se
 * llama desde App.vue igual que los otros reclamos pendientes.
 */
const PENDING_KEY = 'goaldemy_guest_play_pending'

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function readMap() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '{}') } catch { return {} }
}
function writeMap(map) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(map)) } catch {}
}

/** Guarda (o actualiza) el resultado pendiente de un invitado para UN juego. */
export function setPendingGuestClaim({ game, corrects, total, maxStreak = 0 }) {
  if (!game) return
  const map = readMap()
  map[game] = { corrects, total, maxStreak, dayKey: todayKey(), at: Date.now() }
  writeMap(map)
}

/**
 * Recompensas "que ganó" el invitado con un resultado. Misma fórmula que usa
 * el RPC claim_guest_game_reward server-side (ver supabase/guest-game-claim.sql)
 * para que el preview que ve el invitado coincida con lo que realmente reclama.
 */
export function computeGuestRewards(corrects = 0, total = 0) {
  const t = Math.max(total || 0, 1)
  const c = Math.min(Math.max(corrects || 0, 0), t)
  const perfect = c >= t
  const xp = Math.min(c * 10 + (perfect ? 50 : 0), 150)
  const fichas = Math.min(c * 4 + (perfect ? 20 : 0), 60)
  const xpForLevel2 = 150
  const pct = Math.min(100, Math.round((xp / xpForLevel2) * 100))
  const levelUp = xp >= xpForLevel2
  const remaining = Math.max(0, xpForLevel2 - xp)
  return { xp, fichas, perfect, xpForLevel2, pct, levelUp, remaining }
}

/**
 * Resumen de TODO lo pendiente: cuántos juegos, y el total acumulado sumando
 * la recompensa-preview de cada uno. Para mostrar "ya llevás N juegos".
 */
export function getPendingGuestSummary() {
  const map = readMap()
  const games = Object.keys(map)
  let xp = 0, fichas = 0
  for (const slug of games) {
    const r = computeGuestRewards(map[slug].corrects, map[slug].total)
    xp += r.xp
    fichas += r.fichas
  }
  return { count: games.length, games, xp, fichas }
}

function getPendingGuestClaim(game) {
  const map = readMap()
  return game ? (map[game] || null) : map
}

function clearPendingGuestClaim(game) {
  if (!game) { writeMap({}); return }
  const map = readMap()
  delete map[game]
  writeMap(map)
}

/**
 * Si hay reclamos pendientes y el usuario ya está logueado + verificado, los
 * reclama DE VERDAD vía la RPC claim_guest_game_reward (una llamada por
 * juego pendiente, otorga XP + Fichas server-side). Se llama al arrancar la
 * app (App.vue) tras authReady.
 */
export async function claimPendingGuestReward() {
  const map = getPendingGuestClaim()
  const games = Object.keys(map)
  if (!games.length) return null
  try {
    const { getAuthUser } = await import('./auth')
    const user = getAuthUser()
    if (!user?.id || !user?.email_confirmed_at) return null

    const { supabase } = await import('./supabase')
    let totalXp = 0, totalFichas = 0
    for (const slug of games) {
      const pending = map[slug]
      const { data, error } = await supabase.rpc('claim_guest_game_reward', {
        p_game_slug: slug,
        p_corrects: pending.corrects,
        p_total: pending.total,
        p_max_streak: pending.maxStreak,
        p_day_key: pending.dayKey,
      })
      // Éxito o error de negocio (ya reclamado, etc.): la limpiamos igual para no reintentar en loop.
      clearPendingGuestClaim(slug)
      if (error) { console.warn('[guest-play] claim error:', slug, error.message); continue }
      if (data?.ok) { totalXp += data.xp || 0; totalFichas += data.fichas || 0 }
    }

    if (totalXp || totalFichas) {
      try {
        const { pushInfoToast } = await import('../stores/notifications')
        pushInfoToast(`🎁 ¡Reclamaste +${totalXp} XP y ${totalFichas} Fichas de tus partidas como invitado!`)
      } catch {}
      try {
        const { detectAndToastLevelUp } = await import('./xp')
        await detectAndToastLevelUp()
      } catch {}
    }
    return (totalXp || totalFichas) ? { xp: totalXp, fichas: totalFichas } : null
  } catch (e) {
    console.warn('[guest-play] claim exception:', e?.message || e)
    return null
  }
}
```

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: compila sin errores.

Manual (no rompe lo que ya funciona hoy):
1. `grep -n "setPendingGuestClaim\|claimPendingGuestReward" src/pages/games/GuessPlayer.vue src/App.vue` — confirmar que las llamadas existentes NO cambiaron de firma.
2. En el navegador, sin sesión, ir a `/games/guess-player?mode=challenge`, jugar y terminar. Abrir devtools → Application → Local Storage → `goaldemy_guest_play_pending` debe verse como `{"guess-player": {...}}` (objeto con la clave del juego, no el objeto plano de antes).

- [ ] **Step 3: Commit**

```bash
git add src/services/guest-play.js
git commit -m "feat: guest-play.js acumula un pendiente por juego en vez de pisar el único anterior"
```

---

## Task 3: `buildShareText` acepta un `resultLine` custom

La barra de emojis tipo Wordle asume "acertaste X de N preguntas". Para WhoIs (1 sola ronda: acertaste o no) y Mayor o Menor (racha) esa barra no representa bien el resultado. Se agrega un override opcional; el default (usado hoy por La Grilla y Adivina el jugador, donde SÍ hay una grilla real de varios ítems) no cambia.

**Files:**
- Modify: `src/services/share.js`

**Interfaces:**
- Produces: `buildShareText({ gameName, corrects, total, accuracy, maxStreak, won, refCode, resultLine = '' }) → string` — nuevo parámetro opcional `resultLine`, resto sin cambios.

- [ ] **Step 1: Editar `buildShareText` en `src/services/share.js`**

Reemplazar la función completa (líneas 37-54) por:

```js
export function buildShareText({ gameName = '', corrects = 0, total = 0, accuracy = 0, maxStreak = 0, won = false, refCode = '', resultLine = '' } = {}) {
  const name = gameName ? ` · ${gameName}` : ''
  const link = refCode ? `${shareBaseUrl()}/register?ref=${encodeURIComponent(refCode)}` : shareBaseUrl()

  let body
  if (resultLine) {
    // Resultado con texto propio del juego (ej: "Racha de 12 🔥") en vez de la
    // barra de emojis — para juegos donde "X de N preguntas" no aplica bien.
    body = [resultLine]
  } else {
    const t = Math.max(total || 0, 1)
    const got = Math.max(0, Math.min(corrects || 0, t))
    // Barra de emojis: 🟩 acierto / ⬛ fallado, en filas de a 10 para no romper el salto de línea
    const cells = []
    for (let i = 0; i < t; i++) cells.push(i < got ? '🟩' : '⬛')
    const rows = []
    for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10).join(''))
    body = [rows.join('\n'), `✅ ${got}/${t}   🎯 ${accuracy}%   🔥 x${maxStreak || 0}`]
  }

  return [
    `FULVO ⚽${name}`,
    ...body,
    won ? '¿Podés superarme? 👇' : '¿Le ganás a mi intento? 👇',
    link,
  ].join('\n')
}
```

Actualizar también el JSDoc del bloque (líneas 23-36 originales) agregando la línea `@param {string} [opts.resultLine] - Texto de resultado custom; si viene, reemplaza la barra de emojis.`

- [ ] **Step 2: Actualizar el comentario de cabecera del archivo**

En el docstring del tope del archivo (línea 8), reemplazar:
```js
 * Usado por GameSummaryPopup (juegos logueados) y la página /reto (invitados).
```
por:
```js
 * Usado por GameSummaryPopup, tanto en la rama logueada como en la de invitado.
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: compila sin errores. `GameSummaryPopup.vue` sigue llamando `buildShareText` sin pasar `resultLine` todavía (se conecta en el Task 4) — el comportamiento actual (La Grilla, Adivina el jugador) no debe cambiar.

- [ ] **Step 4: Commit**

```bash
git add src/services/share.js
git commit -m "feat: buildShareText acepta resultLine para juegos sin formato X/N preguntas"
```

---

## Task 4: `GameSummaryPopup.vue` — Fichas, acumulado y teaser simulado para invitados

Hoy la rama `guest` del popup (línea 397-406 actual) solo muestra un párrafo genérico y NO muestra Fichas ni el acumulado si el invitado jugó más de un juego. Se agrega eso, más un teaser simulado de logro/cosmético, y el paso de `resultLine` al compartir.

**Files:**
- Modify: `src/components/game/GameSummaryPopup.vue`

**Interfaces:**
- Consumes: `computeGuestRewards`, `getPendingGuestSummary` de `@/services/guest-play` (Task 2).
- Produces: nuevo prop `resultLine: { type: String, default: '' }`.

- [ ] **Step 1: Agregar el prop `resultLine` y el import**

En el bloque `props` (línea 14-36), agregar después de `guest`:

```js
    // Texto de resultado custom para compartir (ej: "Racha de 12 🔥"). Si viene
    // vacío, buildShareText usa la barra de emojis default.
    resultLine: { type: String, default: '' },
```

En el `<script>`, agregar un nuevo import (no existe todavía en este archivo) junto a los demás imports de servicios (línea 6-8, junto a `@/services/sounds`, `@/services/games`, etc.):

```js
import { computeGuestRewards, getPendingGuestSummary } from '@/services/guest-play'
```

- [ ] **Step 2: Agregar los computed `guestPreview` y el estado `guestSummary`**

Dentro de `setup(props)`, junto a los demás `ref`/`computed` (después de la línea `const claimGate = ref(false)`), agregar:

```js
    const guestPreview = computed(() => computeGuestRewards(props.corrects, props.winThreshold))
    const guestSummary = ref({ count: 0, games: [], xp: 0, fichas: 0 })
```

- [ ] **Step 3: Poblar `guestSummary` cuando se abre el popup como invitado**

Dentro de `runSequence()`, justo después de la línea `sessionAchievements.value = []`, agregar:

```js
      if (props.guest) guestSummary.value = getPendingGuestSummary()
```

- [ ] **Step 4: Pasar `resultLine` a `onShare()`**

En `onShare()`, dentro del objeto que se le pasa a `buildShareText`, agregar el campo (después de `won: won.value,`):

```js
        resultLine: props.resultLine || undefined,
```

- [ ] **Step 5: Exponer los nuevos valores en el `return` de `setup()`**

Agregar `guestPreview, guestSummary,` al objeto que retorna `setup()` (junto a `claimGate, difficultyLabel, ...`).

- [ ] **Step 6: Reemplazar el bloque `v-else` (invitado) del template**

Reemplazar el bloque actual (líneas 397-406):

```html
            <div
              v-else
              class="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3.5 text-center transition-all duration-500"
              :class="phase >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'"
            >
              <p class="text-xs text-slate-300">
                Estás jugando <strong class="text-amber-300">como invitado</strong> — esta XP todavía no está guardada.
                Registrate para empezar a subir de nivel de verdad.
              </p>
            </div>
```

por:

```html
            <div
              v-else
              class="space-y-2.5 transition-all duration-500"
              :class="phase >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'"
            >
              <div class="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-center">
                <p class="text-xs text-slate-300">
                  Estás jugando <strong class="text-amber-300">como invitado</strong> — esta XP todavía no está guardada.
                </p>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <div class="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">XP a reclamar</div>
                  <div class="font-display text-xl font-bold text-emerald-400">+{{ guestPreview.xp }}</div>
                </div>
                <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                  <div class="text-[10px] uppercase tracking-wider text-amber-400/70 mb-1">Fichas a reclamar</div>
                  <div class="font-display text-xl font-bold text-amber-400">+{{ guestPreview.fichas }}</div>
                </div>
              </div>

              <div v-if="guestSummary.count > 1" class="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-3 text-center">
                <p class="text-xs text-cyan-300">
                  🎮 Ya llevás <strong>{{ guestSummary.count }} juegos</strong> probados hoy — total acumulado:
                  <strong>{{ guestSummary.xp }} XP</strong> y <strong>{{ guestSummary.fichas }} Fichas</strong>.
                </p>
              </div>

              <div v-if="guestPreview.levelUp" class="rounded-xl border border-yellow-400/25 bg-yellow-500/10 p-3 text-center">
                <p class="text-xs text-yellow-300 font-semibold">⚡ Esa XP alcanza para pasar a Nivel 2 apenas te registrés.</p>
              </div>

              <div v-if="guestPreview.perfect" class="rounded-xl border border-yellow-400/25 bg-yellow-500/10 p-3 text-center">
                <p class="text-xs text-yellow-300 font-semibold">🏆 Un resultado perfecto como este desbloquea logros (y cosméticos exclusivos) al crear tu cuenta.</p>
              </div>
            </div>
```

- [ ] **Step 7: Actualizar el texto del muro de reclamo con el total acumulado**

En el bloque `<div v-else class="rounded-xl border border-amber-400/30 ...">` (el "muro de reclamo", actual línea 487-496), reemplazar el párrafo:

```html
                <p class="text-slate-300 text-xs mb-3">
                  Creá tu cuenta gratis y guardá <strong class="text-emerald-400">+{{ totalXp }} XP</strong> y tu racha para siempre.
                </p>
```

por:

```html
                <p class="text-slate-300 text-xs mb-3">
                  Creá tu cuenta gratis y guardá
                  <strong class="text-emerald-400">+{{ guestSummary.count > 1 ? guestSummary.xp : guestPreview.xp }} XP</strong>
                  <span v-if="guestSummary.count > 1"> de {{ guestSummary.count }} juegos</span>
                  para siempre.
                </p>
```

- [ ] **Step 8: Verificar**

Run: `npm run build`
Expected: compila sin errores.

Manual: repetir la partida como invitado en `/games/guess-player?mode=challenge` (todavía el único conectado hasta el Task 5) y confirmar que el popup ahora muestra la card de Fichas además de la de XP.

- [ ] **Step 9: Commit**

```bash
git add src/components/game/GameSummaryPopup.vue
git commit -m "feat: GameSummaryPopup muestra Fichas, acumulado y teaser simulado para invitados"
```

---

## Task 5: Modo invitado en `WhoIs.vue`

**Files:**
- Modify: `src/pages/games/WhoIs.vue`

**Interfaces:**
- Consumes: `getAuthUser` de `../../services/auth`; `setPendingGuestClaim` de `../../services/guest-play` (Task 2); prop `guest`/`resultLine` de `GameSummaryPopup` (Task 4).

- [ ] **Step 1: Agregar imports**

En la lista de imports (después de la línea `import { awardXpBatch } from '../../services/game-xp'`, línea 6), agregar:

```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 2: Agregar el computed `isGuest`**

En el bloque `computed` (después de `gameMetadata()`, línea 54-56), agregar:

```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 3: Ramificar el award de XP en `submit()`**

En `submit()` (línea 172-174), reemplazar:

```js
        if (this.allowXp && this.xpEarned > 0) {
          await awardXpBatch({ gameCode: 'who-is', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
        }
```

por:

```js
        if (this.isGuest) {
          // Sin cuenta: no hay a quién otorgarle XP server-side. Guardamos el
          // resultado para reclamarlo de verdad si se registra (guest-play.js).
          if (this.xpEarned > 0) {
            setPendingGuestClaim({ game: 'who-is', corrects: this.gameWon ? 1 : 0, total: 1, maxStreak: this.maxStreak })
          }
        } else if (this.allowXp && this.xpEarned > 0) {
          await awardXpBatch({ gameCode: 'who-is', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
        }
```

- [ ] **Step 4: `backPath()` no debe mandar a un invitado a una ruta con login obligatorio**

Reemplazar (línea 125):

```js
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
```

por:

```js
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
```

- [ ] **Step 5: Pasar `guest` y `resultLine` al popup**

En el template, en `<GameSummaryPopup ...>` (línea 343-362), agregar (junto a `:winThreshold="1"`):

```html
          :guest="isGuest"
          :resultLine="gameWon ? 'Adiviné al jugador ✅' : 'No lo adiviné esta vez'"
```

- [ ] **Step 6: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/pages/games/WhoIs.vue
git commit -m "feat: modo invitado en WhoIs (mismo patrón que GuessPlayer.vue)"
```

(La ruta sigue exigiendo `requiresAuth` hasta el Task 8 — no se puede probar en el navegador como invitado todavía, solo verificar que compila.)

---

## Task 6: Modo invitado en `HigherOrLower.vue`

**Files:**
- Modify: `src/pages/games/HigherOrLower.vue`

**Interfaces:**
- Consumes: igual que Task 5.

- [ ] **Step 1: Agregar imports**

Después de `import { awardXpBatch } from '../../services/game-xp'` (línea 5), agregar:

```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 2: Agregar el computed `isGuest`**

En el bloque `computed` (después de `target()`, línea 39), agregar:

```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 3: Ramificar el award de XP en `finishChallenge()`**

Reemplazar (líneas 281-283):

```js
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'higher-or-lower', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

por:

```js
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'higher-or-lower', corrects: this.chain, total: this.target, maxStreak: this.maxStreak })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'higher-or-lower', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

- [ ] **Step 4: `backPath()`**

Reemplazar (línea 121):

```js
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
```

por:

```js
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
```

- [ ] **Step 5: Pasar `guest` y `resultLine` al popup**

En `<GameSummaryPopup ...>` (línea 421-439), agregar (junto a `:winThreshold="target"`):

```html
          :guest="isGuest"
          :resultLine="`Racha de ${chain} 🔥`"
```

- [ ] **Step 6: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/pages/games/HigherOrLower.vue
git commit -m "feat: modo invitado en Mayor o Menor"
```

---

## Task 7: Modo invitado en `FootballGrid.vue`

**Files:**
- Modify: `src/pages/games/FootballGrid.vue`

**Interfaces:**
- Consumes: igual que Task 5.

- [ ] **Step 1: Agregar imports**

Después de `import { awardXpBatch } from '../../services/game-xp'` (línea 8), agregar:

```js
import { getAuthUser } from '../../services/auth'
import { setPendingGuestClaim } from '../../services/guest-play'
```

- [ ] **Step 2: Agregar el computed `isGuest`**

En el bloque `computed` (línea 118-119), después de `gameMetadata()`, agregar:

```js
    isGuest() { return !getAuthUser()?.id },
```

- [ ] **Step 3: Ramificar el award de XP en `endChallenge()`**

Reemplazar (líneas 283-285):

```js
      if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'football-grid', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

por:

```js
      if (this.isGuest) {
        if (this.xpEarned > 0) {
          setPendingGuestClaim({ game: 'football-grid', corrects: this.corrects, total: 9, maxStreak: 0 })
        }
      } else if (this.allowXp && this.xpEarned > 0) {
        await awardXpBatch({ gameCode: 'football-grid', totalXp: this.xpEarned, corrects: this.corrects }).catch(() => {})
      }
```

- [ ] **Step 4: `backPath()`**

Reemplazar (línea 209):

```js
    backPath() { return this.mode === 'free' ? '/play/free' : '/play/points' },
```

por:

```js
    backPath() { if (this.isGuest) return '/'; return this.mode === 'free' ? '/play/free' : '/play/points' },
```

- [ ] **Step 5: Pasar `guest` y `resultLine` al popup**

En `<GameSummaryPopup ...>` (línea 468-487), agregar (junto a `:winThreshold="9"`):

```html
      :guest="isGuest"
      :resultLine="corrects === 9 ? 'Completé la grilla ✅' : `Completé ${corrects}/9 celdas`"
```

- [ ] **Step 6: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/pages/games/FootballGrid.vue
git commit -m "feat: modo invitado en La Grilla"
```

---

## Task 8: Router — sacar `requiresAuth` de los 3 juegos piloto + eliminar ruta `/reto`

**Files:**
- Modify: `src/router/router.js`

- [ ] **Step 1: Quitar `requiresAuth: true` de las 3 rutas piloto**

Línea 74:
```js
    { path: '/games/who-is', component: WhoIs, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: '¿Quién es?', noindex: true } } },
```
→
```js
    { path: '/games/who-is', component: WhoIs, meta: { immersive: true, zone: 'play', seo: { title: '¿Quién es?', noindex: true } } },
```

Línea 81:
```js
    { path: '/games/higher-or-lower', component: HigherOrLower, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Mayor o menor', noindex: true } } },
```
→
```js
    { path: '/games/higher-or-lower', component: HigherOrLower, meta: { immersive: true, zone: 'play', seo: { title: 'Mayor o menor', noindex: true } } },
```

Línea 83:
```js
    { path: '/games/football-grid', component: FootballGrid, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'La Grilla', noindex: true } } },
```
→
```js
    { path: '/games/football-grid', component: FootballGrid, meta: { immersive: true, zone: 'play', seo: { title: 'La Grilla', noindex: true } } },
```

- [ ] **Step 2: Actualizar el comentario del piloto (línea 70)**

Reemplazar:
```js
    // Piloto de modo invitado: se puede jugar sin cuenta, el resultado se reclama al registrarse (ver services/guest-play.js)
```
por:
```js
    // Modo invitado: se puede jugar sin cuenta, el resultado se reclama al registrarse (ver services/guest-play.js)
```

- [ ] **Step 3: Eliminar la ruta `/reto` y su import**

Eliminar la línea 49:
```js
const DailyChallenge = () => import('../pages/DailyChallenge.vue');
```

Eliminar la línea 106:
```js
    { path: '/reto', component: DailyChallenge, meta: { zone: 'play', seo: { title: 'Reto del día', description: 'El desafío diario de fútbol de Fulvo: jugá gratis, sin cuenta, y competí por el mejor puntaje.' } } },
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: compila sin errores (nada más referencia `DailyChallenge` en `router.js` todavía — la limpieza de consumidores del componente en sí es el Task 12).

Manual: `npm run dev`, sin sesión iniciada, navegar directo a `/games/who-is?mode=challenge`, `/games/higher-or-lower?mode=challenge`, `/games/football-grid?mode=challenge` → las 3 deben cargar el juego (no redirigir a `/login`). Jugar una partida completa en cada una y confirmar que el popup de resultado muestra la rama invitado (Fichas, XP, sin barra de nivel).

- [ ] **Step 5: Commit**

```bash
git add src/router/router.js
git commit -m "feat: modo invitado habilitado en WhoIs, Mayor o Menor y La Grilla; elimina ruta /reto"
```

---

## Task 9: `App.vue` — sacar el reclamo del Reto del día

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Eliminar la línea del reclamo de `daily-reto`**

Eliminar (líneas 113-115):
```js
    // Reto del día: si el usuario venía de jugar como invitado y ahora está logueado,
    // otorgar de verdad la XP + Fichas que se le mostraron (cierra el loop del funnel).
    import('./services/daily-reto').then(m => m.claimPendingRetoReward?.()).catch(() => {})
```

Actualizar el comentario de la línea que queda (línea 121, la de `guest-play`):
```js
    // Modo invitado en juegos reales (piloto: Adivina el jugador): mismo cierre de loop.
```
por:
```js
    // Modo invitado en juegos reales: cierra el loop de invitado → registro → recompensa real.
```

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "chore: App.vue deja de reclamar el pendiente de daily-reto.js"
```

---

## Task 10: Nav/CTA — de "Reto del día" a "Jugá gratis"

Apunta a `/games/guess-player?mode=challenge` (ya funciona en producción hoy, cero riesgo nuevo) en vez de un juego del piloto nuevo, para no depender de que el Task 8 esté probado en producción antes de este cambio de navegación.

**Files:**
- Modify: `src/components/AppNavBar.vue` (4 lugares)
- Modify: `src/components/AppFooter.vue`
- Modify: `src/pages/info/AboutFulvo.vue`

- [ ] **Step 1: `AppNavBar.vue` — píldora de escritorio (línea 484-492)**

Reemplazar:
```html
                    <!-- Reto del día — píldora de acento (funnel público) -->
                    <li>
                        <RouterLink to="/reto" class="nav-pill nav-pill--cyan">
                            <span class="relative flex h-2 w-2">
                                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                                <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
                            </span>
                            Reto del día
                        </RouterLink>
                    </li>
```
por:
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

- [ ] **Step 2: `AppNavBar.vue` — item del dropdown "Jugar" (línea 506-509)**

Reemplazar:
```html
                            <RouterLink @click="playOpen=false" to="/reto" class="nav-menu-item">
                                <div class="nav-menu-item-title">Reto del día</div>
                                <p class="nav-menu-item-sub">El desafío diario abierto para compartir. Sin login.</p>
                            </RouterLink>
```
por:
```html
                            <RouterLink @click="playOpen=false" to="/games/guess-player?mode=challenge" class="nav-menu-item">
                                <div class="nav-menu-item-title">Jugá gratis</div>
                                <p class="nav-menu-item-sub">Probá un juego real ahora mismo. Sin login.</p>
                            </RouterLink>
```

- [ ] **Step 3: `AppNavBar.vue` — menú mobile, item destacado (línea 766-774)**

Reemplazar:
```html
                        <li>
                            <RouterLink @click="isOpen=false" to="/reto" class="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2.5 font-bold text-cyan-300 hover:bg-cyan-500/15">
                                <span class="relative flex h-2 w-2">
                                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                                    <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
                                </span>
                                Reto del día
                            </RouterLink>
                        </li>
```
por:
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

- [ ] **Step 4: `AppNavBar.vue` — menú mobile, submenú "Jugar" (línea 780)**

Reemplazar:
```html
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/reto">Reto del día</RouterLink></li>
```
por:
```html
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/games/guess-player?mode=challenge">Jugá gratis</RouterLink></li>
```

- [ ] **Step 5: `AppFooter.vue` (línea 38)**

Reemplazar:
```html
            <li><RouterLink to="/reto" class="text-slate-400 hover:text-emerald-400 transition">Reto del día</RouterLink></li>
```
por:
```html
            <li><RouterLink to="/games/guess-player?mode=challenge" class="text-slate-400 hover:text-emerald-400 transition">Jugá gratis</RouterLink></li>
```

- [ ] **Step 6: `AboutFulvo.vue` (línea 146-148)**

Reemplazar:
```html
            <RouterLink to="/reto" class="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-6 py-3 font-semibold text-cyan-400 transition hover:bg-cyan-500/10 hover:border-cyan-400/50">
              Reto del día
            </RouterLink>
```
por:
```html
            <RouterLink to="/games/guess-player?mode=challenge" class="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-6 py-3 font-semibold text-cyan-400 transition hover:bg-cyan-500/10 hover:border-cyan-400/50">
              Jugá gratis
            </RouterLink>
```

- [ ] **Step 7: Verificar**

Run: `npm run build`
Expected: compila sin errores. `grep -rn "to=\"/reto\"\|to='/reto'" src/components/AppNavBar.vue src/components/AppFooter.vue src/pages/info/AboutFulvo.vue` → sin resultados.

Manual: `npm run dev`, revisar navbar desktop, menú mobile, footer y `/about-fulvo` → todos los CTAs viejos de "Reto del día" ahora dicen "Jugá gratis" y llevan a `/games/guess-player?mode=challenge`.

- [ ] **Step 8: Commit**

```bash
git add src/components/AppNavBar.vue src/components/AppFooter.vue src/pages/info/AboutFulvo.vue
git commit -m "feat: CTAs de nav apuntan a Jugá gratis (guess-player) en vez de Reto del día"
```

---

## Task 11: Eliminar duelos (`duels.js`, tablero en `FriendsDock.vue`, notificación en `Notifications.vue`)

**Files:**
- Delete: `src/services/duels.js`
- Modify: `src/components/FriendsDock.vue`
- Modify: `src/pages/social/Notifications.vue`

- [ ] **Step 1: `FriendsDock.vue` — quitar el import**

Eliminar (línea 17):
```js
import { getRetoDuelBoard, sendDuelChallenge } from '../services/duels'
```

- [ ] **Step 2: `FriendsDock.vue` — quitar los campos de `data()`**

Eliminar (líneas 53-54):
```js
      duelBoard: {},   // friendId → { corrects, total, played } — Reto del día de hoy
      duelBusy: {},    // friendId → true mientras se envía el desafío
```

- [ ] **Step 3: `FriendsDock.vue` — quitar el mapeo de duelo en `baseRows()`**

Dentro de `baseRows()`, eliminar la línea:
```js
        const duel = this.duelBoard[f.id] || null
```
y, dentro del objeto que retorna el `.map()`, eliminar:
```js
          duelPlayed: !!duel?.played,
          duelScore: duel?.played ? `${duel.corrects}/${duel.total}` : null,
```

- [ ] **Step 4: `FriendsDock.vue` — quitar la llamada a `loadDuelBoard()`**

Eliminar (línea 193, dentro del método que carga amigos):
```js
        this.loadDuelBoard()
```

- [ ] **Step 5: `FriendsDock.vue` — quitar los métodos `loadDuelBoard` y `challengeFriend`**

Eliminar el bloque completo (líneas 212-225):
```js
    async loadDuelBoard() {
      try {
        const board = await getRetoDuelBoard()
        const map = {}
        for (const row of board) map[row.friendId] = row
        this.duelBoard = map
      } catch {}
    },
    async challengeFriend(friendId) {
      if (this.duelBusy[friendId]) return
      this.duelBusy = { ...this.duelBusy, [friendId]: true }
      try { await sendDuelChallenge(friendId) }
      finally { const b = { ...this.duelBusy }; delete b[friendId]; this.duelBusy = b }
    },
```

- [ ] **Step 6: `FriendsDock.vue` — quitar el uso en el template (2 bloques, online y offline)**

Primer bloque (rows online, líneas 445-455): reemplazar
```html
                  <div v-else-if="r.duelPlayed" class="text-[11px] text-amber-300/90 truncate">🔥 Reto de hoy: {{ r.duelScore }}</div>
                  <div v-else class="text-[11px] text-emerald-400/90">En línea</div>
                </div>
              </button>
              <button v-if="!r.duelPlayed" @click.stop="challengeFriend(r.id)" :disabled="duelBusy[r.id]" title="Desafiar al Reto de hoy"
                      class="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:text-amber-300 hover:bg-amber-400/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>
              </button>
```
por:
```html
                  <div v-else class="text-[11px] text-emerald-400/90">En línea</div>
                </div>
              </button>
```

Segundo bloque (rows offline, líneas 466-475): reemplazar
```html
                  <div v-if="r.duelPlayed" class="text-[11px] text-amber-300/80 truncate">🔥 Reto de hoy: {{ r.duelScore }}</div>
                  <div v-else class="text-[11px] text-slate-500">Desconectado</div>
                </div>
              </button>
              <button v-if="!r.duelPlayed" @click.stop="challengeFriend(r.id)" :disabled="duelBusy[r.id]" title="Desafiar al Reto de hoy"
                      class="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:text-amber-300 hover:bg-amber-400/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>
              </button>
```
por:
```html
                  <div v-else class="text-[11px] text-slate-500">Desconectado</div>
                </div>
              </button>
```

- [ ] **Step 7: `Notifications.vue` — quitar el branch de texto (líneas 125-127)**

Eliminar:
```html
                <template v-else-if="n.type==='duel_challenge'">
                  <router-link :to="`/u/${n.from_user}`" class="hover:underline">{{ who(n.from_user) }}</router-link>&nbsp;te desafió al Reto del día ⚔️
                </template>
```

- [ ] **Step 8: `Notifications.vue` — quitar el botón de acción (línea 132)**

Eliminar:
```html
            <router-link v-if="n.type==='duel_challenge'" to="/reto" class="shrink-0 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition">Jugar</router-link>
```

- [ ] **Step 9: Eliminar `duels.js`**

```bash
git rm src/services/duels.js
```

- [ ] **Step 10: Verificar**

Run: `npm run build`
Expected: compila sin errores. `grep -rn "duels\.js\|getRetoDuelBoard\|sendDuelChallenge\|duel_challenge\|duelBoard\|duelBusy\|challengeFriend" src/` → sin resultados.

Manual: `npm run dev`, logueado con al menos un amigo agregado, abrir el `FriendsDock` → la lista de amigos se ve bien, sin el botón de "desafiar" ni el texto "Reto de hoy".

- [ ] **Step 11: Commit**

```bash
git add src/components/FriendsDock.vue src/pages/social/Notifications.vue
git commit -m "chore: eliminar duelos del Reto del día (duels.js, tablero en FriendsDock, notificación)"
```

---

## Task 12: Eliminar `daily-reto.js` y `DailyChallenge.vue`

Último paso de la limpieza — para este punto ya no queda ningún import activo hacia estos dos archivos (Task 1 migró `todayKey`, Task 8 sacó la ruta/import de `router.js`, Task 9 sacó el reclamo de `App.vue`, Task 11 borró `duels.js` que era el otro consumidor).

**Files:**
- Delete: `src/services/daily-reto.js`
- Delete: `src/pages/DailyChallenge.vue`

- [ ] **Step 1: Confirmar que no quedan referencias activas**

Run: `grep -rn "daily-reto\|DailyChallenge" src --include="*.vue" --include="*.js"`
Expected: sin resultados (o únicamente dentro de los dos archivos que se están por borrar).

- [ ] **Step 2: Borrar los archivos**

```bash
git rm src/services/daily-reto.js src/pages/DailyChallenge.vue
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: eliminar daily-reto.js y DailyChallenge.vue (reemplazados por modo invitado en juegos reales)"
```

---

## Task 13: Verificación manual end-to-end

Sin runner de tests en este proyecto — este es el checklist final contra la app real, cubriendo los flujos descriptos en la spec.

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: sin errores ni warnings nuevos.

- [ ] **Step 2: Invitado, un solo juego**

`npm run dev`, sin sesión. Ir a `/games/who-is?mode=challenge`, jugar y terminar. El popup debe mostrar la rama invitado: card de XP, card de Fichas, botón "Reclamar mis recompensas" → "Crear cuenta gratis y reclamar" → `/register`. NO debe aparecer la barra de nivel ni el botón "Volver a juegos"/"Cerrar" de la rama logueada.

- [ ] **Step 3: Invitado, varios juegos acumulados**

Mismo invitado (sin registrarse todavía), jugar también `/games/higher-or-lower?mode=challenge` y `/games/football-grid?mode=challenge`. En el popup del 2do y 3er juego debe aparecer el banner "🎮 Ya llevás N juegos probados hoy — total acumulado...".

Abrir devtools → Local Storage → `goaldemy_guest_play_pending` debe tener las 3 claves (`who-is`, `higher-or-lower`, `football-grid`).

- [ ] **Step 4: Rejugar el mismo juego sin registrarse**

Jugar `/games/who-is?mode=challenge` de nuevo (sin registrarse) → la entrada `who-is` en el localStorage se actualiza (mismo valor único), no se duplica ni se acumulan 2 entradas para el mismo juego.

- [ ] **Step 5: Registrarse y reclamar**

Desde el popup, click en "Crear cuenta gratis y reclamar" → completar registro → confirmar email (o usar un flujo de test que ya tenga esto resuelto en este proyecto). Al volver a la app logueado, debe aparecer el toast "🎁 ¡Reclamaste +X XP y Y Fichas de tus partidas como invitado!" con el total sumado de los 3 juegos. Si la suma cruza el umbral de nivel, debe dispararse el overlay de level-up.

- [ ] **Step 6: Regresión — usuario ya logueado**

Con una cuenta YA logueada (no invitado), jugar los 3 juegos piloto → comportamiento idéntico a antes de este cambio: sesión persistida, XP real vía `awardXpBatch`, barra de nivel, logros reales si corresponde. Nada de la rama invitado debe aparecer.

- [ ] **Step 7: Navegación**

Recorrer navbar desktop, menú mobile, footer y `/about-fulvo` → ningún link roto a `/reto` (la ruta ya no existe, debe dar 404 si se visita directo). Todos los CTAs viejos ahora dicen "Jugá gratis" y llevan a `/games/guess-player?mode=challenge`.

- [ ] **Step 8: `FriendsDock` y `Notifications`**

Con una cuenta logueada que tenga amigos, abrir el `FriendsDock` → sin errores en consola, sin restos visuales de "Reto de hoy"/desafiar. Abrir `/notifications` → sin errores aunque existan notificaciones viejas de tipo `duel_challenge` en la base (deben caer al fallback `<template v-else>Notificación</template>` sin romper la página).

- [ ] **Step 9: Reporte final**

Si algún paso falla, no marcar la tarea como completa — volver al task correspondiente y corregir antes de seguir.

---

## Notas / fuera de alcance (no tocar en este plan)

- `src/pages/games/GuessPlayer.vue` tiene el mismo `backPath()` con el paper cut de mandar a un invitado a `/play/points` (requiere auth) al tocar "Volver" DURANTE la partida (antes de terminarla) — no se corrige acá porque el archivo no está en el alcance de la spec. Queda anotado para una pasada futura.
- Los RPCs `claim_reto_reward`, `get_reto_duel_board`, `send_duel_challenge` (y sus tablas asociadas) quedan sin uso en Supabase — no se borran en este plan (decisión explícita de la spec).
- Rollout a los otros 10 juegos — explícitamente fuera de alcance, próximo paso después de validar este piloto.
