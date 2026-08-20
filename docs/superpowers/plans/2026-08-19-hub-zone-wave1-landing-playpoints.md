# Hub Zone — Wave 1 (Landing + PlayPoints) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Hub zone's design system (violet-indigo accent, `.surface-solid` surfaces, Space Grotesk weight ceiling) to Goaldemy's two entry-point pages — `Landing.vue` and `PlayPoints.vue` — and resolve the redesign's original diagnosed problem by unifying their two divergent game-card treatments ("Poster" vs "Limpia") into one shared component.

**Architecture:** Extract a new shared `GameCard.vue` component (locked + unlocked states) consumed by both pages, replacing ~150 lines of duplicated card markup with a handful of prop bindings each. Apply a fixed emerald→hub color-mapping table to every decorative brand-color usage in both files (win/loss feedback and live-match-score UI are explicitly excluded — those are semantic/real-world states, not brand decoration). Normalize `.font-display` + `font-extrabold` to `font-bold` per the Foundation phase's Space Grotesk weight-ceiling decision.

**Tech Stack:** Vue 3 `<script setup>`, Vue Router 4, Tailwind CSS v4. Foundation phase tokens already merged to `main` (`--hub-300/400/500`, `.surface-solid`, `--mb-radius-*`, Space Grotesk). No test framework — verification is `npm run dev` + Playwright MCP live checks, same method as the Foundation plan.

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- **Color mapping (apply everywhere in this plan except semantic/live-match states):**
  | Old (brand) | New (Hub accent) | Old (brand) | New (Hub accent) |
  |---|---|---|---|
  | `emerald-300` | `violet-300` | `cyan-300` | `purple-300` |
  | `emerald-400` | `violet-400` | `cyan-400` | `purple-400` |
  | `emerald-500` | `indigo-500` | `cyan-500` | `purple-500` |
  | rgb `16,185,129` (emerald-500) | rgb `99,102,241` (indigo-500) | rgb `34,211,238` (cyan-400) | rgb `168,85,247` (purple-500) |
- **Explicitly DO NOT recolor:** win/loss result badges and feedback (`emerald-500`/`red-500` rings, checkmarks, glows on already-played game states) — these are semantic per the spec ("verde/rojo... feedback semántico"), not brand decoration. **DO NOT recolor** the live-match row/score-pill/"VIVO" badge on Landing.vue's World Cup panel (lines 365-394) — that green signals a real match is live right now, a real-world state independent of app branding, not a brand color to migrate.
- **Font weight:** every `.font-display` element combined with `font-extrabold` or `font-black` drops to `font-bold` (Space Grotesk tops out at weight 700 — decided during Foundation phase). Do not touch `.font-display` + `font-bold` (already 700, no change) or `font-extrabold` NOT combined with `.font-display` (e.g. plain body-font glyphs like win/loss ✓/✕ symbols — Inter still supports 800).
- Do not touch backend/RPC code or any `services/*.js` business logic beyond the one specified cleanup in Task 4.
- Every task must leave `npm run dev` building with no new console errors.
- Reuse existing tokens/classes (`--hub-300/400/500`, `.surface-solid`, `--mb-radius-*`) — do not invent new design-system primitives in this wave.

---

## Task 1: Create the shared `GameCard.vue` component

**Files:**
- Create: `src/components/game/GameCard.vue`

**Interfaces:**
- Produces: a Vue component with props `game` (Object, required — needs `.slug`, `.name`, `.cover_url`), `unlocked` (Boolean, default `true`), `unlockLevel` (Number/String, default `null`), `availability` (Object, default `null` — shape `{ available: Boolean, result: 'win'|'loss'|null }`), `streak` (Number, default `0`), `showAyudas` (Boolean, default `false`), `to` (String, default `''`). Consumed by Task 2 (Landing.vue) and Task 3 (PlayPoints.vue).

- [ ] **Step 1: Create the component**

Create `src/components/game/GameCard.vue` with this exact content:

```vue
<script setup>
import { RouterLink } from 'vue-router'
import { getGameTypeLabel } from '../../services/games'

defineProps({
  game: { type: Object, required: true },
  unlocked: { type: Boolean, default: true },
  unlockLevel: { type: [Number, String], default: null },
  availability: { type: Object, default: null },
  streak: { type: Number, default: 0 },
  showAyudas: { type: Boolean, default: false },
  to: { type: String, default: '' },
})
</script>

<template>
  <!-- Bloqueado -->
  <div
    v-if="!unlocked"
    class="relative flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-slate-800/40 to-slate-900/60 opacity-60 cursor-not-allowed select-none"
  >
    <div class="relative flex items-center justify-center h-36 bg-slate-800/40">
      <img
        v-if="game.cover_url"
        :src="game.cover_url"
        :alt="game.name"
        class="w-24 h-24 object-contain opacity-20 grayscale"
      />
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
        <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span class="text-[10px] text-slate-400 font-semibold text-center px-2 leading-tight">
          Nivel {{ unlockLevel }}
        </span>
      </div>
    </div>
    <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
      <div class="font-display font-bold text-slate-500 text-xs tracking-widest uppercase">BLOQUEADO</div>
      <div class="text-slate-500 text-xs mt-0.5 truncate">{{ game.name }}</div>
    </div>
  </div>

  <!-- Desbloqueado — tratamiento único de card de juego para toda la Zona Hub -->
  <RouterLink
    v-else
    :to="to"
    class="game-card group relative flex flex-col surface-solid overflow-hidden transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
    :class="[
      availability?.result === 'win'
        ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
        : availability?.result === 'loss'
        ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
        : ''
    ]"
  >
    <div class="relative flex items-center justify-center h-36 bg-black/20 overflow-hidden">
      <div class="card-tint pointer-events-none absolute inset-0"></div>

      <span v-if="getGameTypeLabel(game.slug)" class="absolute top-2 left-2 z-20 rounded-md bg-slate-950/70 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-200 ring-1 ring-white/10">
        {{ getGameTypeLabel(game.slug) }}
      </span>

      <span
        v-if="showAyudas"
        class="absolute bottom-2 left-2 z-20 inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 ring-1 ring-amber-400/30 px-1.5 py-0.5 text-amber-300"
        title="Podés usar ayudas en este juego"
      >
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        <span class="text-[9px] font-bold uppercase tracking-wide">Ayudas</span>
      </span>

      <div
        v-if="availability?.available === false"
        class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"
      >
        <div
          v-if="availability?.result === 'win'"
          class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-emerald-400/40 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
        </div>
        <div
          v-else
          class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
        >
          <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
        </div>
      </div>
      <img
        v-if="game.cover_url"
        :src="game.cover_url"
        :alt="game.name"
        class="relative w-[104px] h-[104px] object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
        :class="availability?.available === false ? 'opacity-30' : 'opacity-95'"
      />
      <div v-if="streak > 0" class="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-full bg-slate-900/90 ring-1 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.25)] px-2 py-0.5">
        <svg class="w-3 h-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
        <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ streak }}</span>
      </div>
    </div>
    <div class="px-3 py-2.5 border-t border-white/5 flex items-center gap-2">
      <span class="min-w-0 flex-1 font-display font-bold text-white text-[13px] leading-tight truncate">{{ game.name }}</span>
      <span class="card-cta shrink-0 text-[11px] font-extrabold whitespace-nowrap">
        {{ availability?.available === false ? 'Ver →' : 'Jugar →' }}
      </span>
    </div>
  </RouterLink>
</template>

<style scoped>
/* Tinte de acento Hub (violeta-índigo) — reemplaza el sistema anterior de color
   por tipo de juego (--c / getGameTypeColor), que dependía de un fallback
   esmeralda hardcodeado. Un solo acento para toda la Zona Hub. */
.card-tint {
  background: radial-gradient(78% 78% at 50% 42%, color-mix(in srgb, var(--hub-500) 20%, transparent), transparent 72%);
  opacity: .68;
  transition: opacity .3s ease;
}
.game-card:hover .card-tint { opacity: 1; }
.game-card:hover { border-color: color-mix(in srgb, var(--hub-500) 42%, transparent); box-shadow: 0 14px 34px rgba(0,0,0,.42); }

.card-cta {
  color: var(--hub-400);
  opacity: 0;
  transform: translateX(-5px);
  transition: opacity .2s ease, transform .2s ease;
}
.game-card:hover .card-cta { opacity: 1; transform: none; }
@media (hover: none) {
  .card-cta { opacity: .9; transform: none; }
}
</style>
```

- [ ] **Step 2: Verify it's syntactically valid and importable**

Start the dev server (`npm run dev`) and confirm no Vite/Vue compile errors reference `GameCard.vue`. It won't be used by any page yet — this step only confirms the file parses.

- [ ] **Step 3: Commit**

```bash
git add src/components/game/GameCard.vue
git commit -m "feat(hub-zone): add shared GameCard component (unifies Poster + Limpia card directions)"
```

---

## Task 2: Migrate `Landing.vue` to the Hub design system

**Files:**
- Modify: `src/pages/Landing.vue`

**Interfaces:**
- Consumes: `GameCard.vue` (Task 1)

- [ ] **Step 1: Update imports**

Find:
```js
import { fetchGames, gameRouteForSlug, getGameTypeLabel, getGameTypeColor } from '../services/games'
```
Replace with:
```js
import { fetchGames, gameRouteForSlug } from '../services/games'
```

Find:
```js
import UserAvatar from '../components/common/UserAvatar.vue'
```
Replace with:
```js
import UserAvatar from '../components/common/UserAvatar.vue'
import GameCard from '../components/game/GameCard.vue'
```

- [ ] **Step 2: Guest hero — recolor live pulse dot and headline gradient**

Find:
```html
        <div class="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300 font-medium slide-up">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Copa del Mundo 2026 — EN VIVO
        </div>
        <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
          Jugá. Aprendé. <span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Dominá.</span>
        </h1>
```
Replace with:
```html
        <div class="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300 font-medium slide-up">
          <span class="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
          Copa del Mundo 2026 — EN VIVO
        </div>
        <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
          Jugá. Aprendé. <span class="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Dominá.</span>
        </h1>
```

- [ ] **Step 3: Guest hero — recolor "Crear cuenta gratis" CTA gradient**

Find:
```html
          <RouterLink to="/register" class="group rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3 font-semibold text-white text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-105 active:scale-95">
```
Replace with:
```html
          <RouterLink to="/register" class="group rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-7 py-3 font-semibold text-white text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-105 active:scale-95">
```

- [ ] **Step 4: Logged-in hero — recolor decorative blobs, level badge, and greeting weight**

Find:
```html
      <div v-else class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 shadow-xl shadow-black/30">
        <div class="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(16,185,129,0.55), transparent 70%);"></div>
        <div class="pointer-events-none absolute -bottom-28 -left-16 w-72 h-72 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(34,211,238,0.5), transparent 70%);"></div>
```
Replace with:
```html
      <div v-else class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800/40 p-6 sm:p-8 shadow-xl shadow-black/30">
        <div class="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(99,102,241,0.55), transparent 70%);"></div>
        <div class="pointer-events-none absolute -bottom-28 -left-16 w-72 h-72 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(168,85,247,0.5), transparent 70%);"></div>
```

Find:
```html
            <div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 border border-emerald-400/60 px-3 py-1 text-xs font-extrabold text-emerald-400 shadow-lg shadow-emerald-500/20">
```
Replace with:
```html
            <div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 border border-violet-400/60 px-3 py-1 text-xs font-extrabold text-violet-400 shadow-lg shadow-indigo-500/20">
```

Find:
```html
            <h1 class="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight truncate">Hola{{ home.name ? ', ' + home.name : '' }}</h1>
```
Replace with:
```html
            <h1 class="font-display text-2xl sm:text-4xl font-bold text-white leading-tight truncate">Hola{{ home.name ? ', ' + home.name : '' }}</h1>
```

- [ ] **Step 5: Logged-in hero — recolor "Jugar ahora" CTA gradient**

Find:
```html
              <RouterLink to="/play/points" class="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-3.5 font-bold text-white text-base shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-emerald-500/50 active:scale-95">
```
Replace with:
```html
              <RouterLink to="/play/points" class="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-3.5 font-bold text-white text-base shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-indigo-500/50 active:scale-95">
```

- [ ] **Step 6: "Tu día" strip — recolor hover state and drop stat-number weight**

Find:
```html
          <RouterLink to="/play/points" class="group flex flex-col items-center px-2 transition">
            <span class="text-[10px] uppercase tracking-wider text-slate-500 group-hover:text-emerald-400 transition-colors">Jugados hoy</span>
            <span class="font-display text-xl font-extrabold text-white mt-0.5">{{ home.playedToday }}<span class="text-slate-600 text-sm">/{{ state.totalGames || '—' }}</span></span>
          </RouterLink>
          <div class="flex flex-col items-center px-2">
            <span class="text-[10px] uppercase tracking-wider text-slate-500">Racha</span>
            <span class="font-display text-xl font-extrabold text-white mt-0.5">{{ home.dailyStreak }} <span class="text-slate-500 text-sm font-semibold">días</span></span>
          </div>
          <RouterLink to="/rewards" class="group relative flex flex-col items-center px-2 transition">
            <span class="text-[10px] uppercase tracking-wider transition-colors" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-slate-500 group-hover:text-amber-300'">Recompensas</span>
            <span class="font-display text-xl font-extrabold mt-0.5" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-white'">{{ home.rewardsToClaim }}</span>
```
Replace with:
```html
          <RouterLink to="/play/points" class="group flex flex-col items-center px-2 transition">
            <span class="text-[10px] uppercase tracking-wider text-slate-500 group-hover:text-violet-400 transition-colors">Jugados hoy</span>
            <span class="font-display text-xl font-bold text-white mt-0.5">{{ home.playedToday }}<span class="text-slate-600 text-sm">/{{ state.totalGames || '—' }}</span></span>
          </RouterLink>
          <div class="flex flex-col items-center px-2">
            <span class="text-[10px] uppercase tracking-wider text-slate-500">Racha</span>
            <span class="font-display text-xl font-bold text-white mt-0.5">{{ home.dailyStreak }} <span class="text-slate-500 text-sm font-semibold">días</span></span>
          </div>
          <RouterLink to="/rewards" class="group relative flex flex-col items-center px-2 transition">
            <span class="text-[10px] uppercase tracking-wider transition-colors" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-slate-500 group-hover:text-amber-300'">Recompensas</span>
            <span class="font-display text-xl font-bold mt-0.5" :class="home.rewardsToClaim > 0 ? 'text-amber-300' : 'text-white'">{{ home.rewardsToClaim }}</span>
```

- [ ] **Step 7: "Ver calendario completo" link — recolor (NOT part of the live-match block, this is a plain nav link)**

Find:
```html
        <RouterLink to="/leagues/world-cup" class="inline-block mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
```
Replace with:
```html
        <RouterLink to="/leagues/world-cup" class="inline-block mt-3 text-sm text-purple-400 hover:text-purple-300 transition-colors">
```

- [ ] **Step 8: "¿Cómo funciona?" step cards — recolor step 1 and step 2 icon tiles**

Find:
```html
        <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center">
            <svg class="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <h3 class="text-white font-semibold mb-1.5">Creá tu cuenta</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Registrate gratis y personalizá tu perfil con tu equipo y jugador favorito.</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-cyan-500/15 border border-cyan-500/30 grid place-items-center">
            <svg class="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
          </div>
          <h3 class="text-white font-semibold mb-1.5">Jugá desafíos diarios</h3>
```
Replace with:
```html
        <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-indigo-500/15 border border-indigo-500/30 grid place-items-center">
            <svg class="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <h3 class="text-white font-semibold mb-1.5">Creá tu cuenta</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Registrate gratis y personalizá tu perfil con tu equipo y jugador favorito.</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center">
            <svg class="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
          </div>
          <h3 class="text-white font-semibold mb-1.5">Jugá desafíos diarios</h3>
```

- [ ] **Step 9: "Jugá hoy" section header — recolor icon tile and hover links**

Find:
```html
        <span class="grid place-items-center size-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-400/25 shrink-0">
          <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
        </span>
        <div class="flex-1 min-w-0">
          <h2 class="font-display font-bold text-white text-lg leading-tight">Jugá hoy</h2>
          <p class="text-xs text-slate-500">Tus desafíos diarios</p>
        </div>
        <RouterLink to="/play/points" class="group inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors">
```
Replace with:
```html
        <span class="grid place-items-center size-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-violet-400/25 shrink-0">
          <svg class="w-5 h-5 text-violet-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
        </span>
        <div class="flex-1 min-w-0">
          <h2 class="font-display font-bold text-white text-lg leading-tight">Jugá hoy</h2>
          <p class="text-xs text-slate-500">Tus desafíos diarios</p>
        </div>
        <RouterLink to="/play/points" class="group inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-violet-400 transition-colors">
```

- [ ] **Step 10: Replace the entire locked/unlocked game-card block with `<GameCard>`**

Find (the full `<template v-for="g in state.featuredGames">` block, including its comments):
```html
        <template v-for="g in state.featuredGames" :key="g.slug">
          <!-- Bloqueado por nivel -->
          <div
            v-if="!isGameUnlocked(g.slug, home.level)"
            class="relative flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-slate-800/40 to-slate-900/60 opacity-60 cursor-not-allowed select-none"
          >
            <div class="relative flex items-center justify-center h-36 bg-slate-800/40">
              <img v-if="g.cover_url" :src="g.cover_url" :alt="g.name" width="96" height="96" loading="lazy" decoding="async" class="w-24 h-24 object-contain opacity-20 grayscale" />
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
                <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span class="text-[10px] text-slate-400 font-semibold text-center px-2 leading-tight">Nivel {{ getGameUnlockLevel(g.slug) }}</span>
              </div>
            </div>
            <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
              <div class="font-display font-bold text-slate-500 text-xs tracking-widest uppercase">BLOQUEADO</div>
              <div class="text-slate-500 text-xs mt-0.5 truncate">{{ g.name }}</div>
            </div>
          </div>

          <!-- Desbloqueado — dirección "Poster": superficie única full-bleed con
               color por tipo de juego, imagen protagonista y nombre sobreimpreso -->
          <RouterLink
            v-else
            :to="toChallenge(g.slug)"
            class="poster-card group relative block rounded-2xl overflow-hidden border border-white/10 aspect-[3/3.5]"
            :style="{ '--c': getGameTypeColor(g.slug) }"
            :class="[
              state.availability[g.slug]?.result === 'win'
                ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : state.availability[g.slug]?.result === 'loss'
                ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                : ''
            ]"
          >
            <!-- Fondo full-bleed por tipo -->
            <div class="poster-bg pointer-events-none absolute inset-0"></div>

            <!-- Imagen protagonista -->
            <img
              v-if="g.cover_url"
              :src="g.cover_url"
              :alt="g.name"
              width="120" height="120" loading="lazy" decoding="async"
              class="absolute left-1/2 top-[41%] -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105"
              :class="state.availability[g.slug]?.available === false ? 'opacity-40' : ''"
            />

            <!-- Chips arriba -->
            <div class="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-start justify-between gap-2">
              <span v-if="getGameTypeLabel(g.slug)" class="rounded-md bg-slate-950/60 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-100 ring-1 ring-white/15">{{ getGameTypeLabel(g.slug) }}</span>
              <span v-if="(state.streaks[g.slug] || 0) > 0" class="flex items-center gap-1 rounded-full bg-slate-950/70 ring-1 ring-amber-400/30 px-2 py-0.5">
                <svg class="w-3 h-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ state.streaks[g.slug] }}</span>
              </span>
            </div>

            <!-- Scrim inferior -->
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[64%] z-10 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent"></div>

            <!-- Nombre + CTA -->
            <div class="absolute inset-x-0 bottom-0 z-20 p-3">
              <div class="font-display font-extrabold text-white text-sm leading-tight drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">{{ g.name }}</div>
              <div class="poster-sub text-[11px] font-bold mt-0.5">{{ state.availability[g.slug]?.available === false ? 'Ver resultado →' : 'Jugar →' }}</div>
            </div>

            <!-- Estado (ya jugado hoy) -->
            <div v-if="state.availability[g.slug]?.available === false" class="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/35">
              <div v-if="state.availability[g.slug]?.result === 'win'" class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-emerald-400/40 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
              </div>
              <div v-else class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
              </div>
            </div>
          </RouterLink>
        </template>
```
Replace with:
```html
        <template v-for="g in state.featuredGames" :key="g.slug">
          <GameCard
            :game="g"
            :unlocked="isGameUnlocked(g.slug, home.level)"
            :unlock-level="getGameUnlockLevel(g.slug)"
            :availability="state.availability[g.slug]"
            :streak="state.streaks[g.slug] || 0"
            :to="toChallenge(g.slug)"
          />
        </template>
```

Note: this also removes the `aspect-[3/3.5]` sizing the old poster cards had — `GameCard.vue` sizes to its own content (h-36 image area + footer), matching the now-unified treatment. The loading-skeleton grid above this block (`v-if="state.loading"`) still uses `aspect-[3/3.5]` placeholders — leave that skeleton as-is in this task, it's a reasonable approximate placeholder size and not part of this task's scope.

- [ ] **Step 11: Guest locked-games panel — recolor pill header icon**

Find:
```html
            <h2 class="text-lg font-bold text-white whitespace-nowrap flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
              Jugá
            </h2>
```
Replace with:
```html
            <h2 class="text-lg font-bold text-white whitespace-nowrap flex items-center gap-2">
              <svg class="w-5 h-5 text-violet-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
              Jugá
            </h2>
```

- [ ] **Step 12: Guest locked-games panel — recolor fallback icon**

Find:
```html
                <svg v-else class="relative z-10 w-16 h-16 text-emerald-400/80" fill="currentColor" viewBox="0 0 24 24">
```
Replace with:
```html
                <svg v-else class="relative z-10 w-16 h-16 text-violet-400/80" fill="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 13: Remove the now-unused `.poster-card`/`.poster-bg`/`.poster-sub` scoped styles**

Find (the entire `<style scoped>` block):
```html
<style scoped>
/* Dirección "Poster" para el bloque "Jugá hoy": superficie única con color por
   tipo de juego (var --c la setea cada card según getGameTypeColor). */
.poster-card {
  transition: transform .3s ease, box-shadow .3s ease, border-color .3s ease;
}
.poster-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, .5);
  border-color: color-mix(in srgb, var(--c, #34d399) 45%, transparent);
}
.poster-bg {
  background: linear-gradient(150deg, color-mix(in srgb, var(--c, #34d399) 40%, #0a1120), #0a1120 72%);
}
.poster-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(72% 55% at 68% 26%, color-mix(in srgb, var(--c, #34d399) 42%, transparent), transparent 70%);
}
.poster-sub {
  color: color-mix(in srgb, var(--c, #34d399) 68%, #ffffff);
}
@media (prefers-reduced-motion: reduce) {
  .poster-card { transition: none; }
}
</style>
```
Replace with: (delete the entire block — remove it, leaving nothing in its place; the file should end after the closing `</template>` tag with no trailing `<style>` block)

- [ ] **Step 14: Verify no leftover references**

```bash
rg 'getGameTypeColor|poster-card|poster-bg|poster-sub' src/pages/Landing.vue
```
Expected: no output.

- [ ] **Step 15: Live verification**

With the dev server running, log in and navigate to `/`. Take a screenshot. Confirm:
- The "Dominá." headline reads in a violet→purple gradient (not green→cyan).
- The hero decorative background blobs are violet/purple-toned, not green/cyan.
- "Jugar ahora" button is a violet→purple gradient.
- The "Jugá hoy" game grid renders using the new `GameCard` layout (photo top + name/CTA footer strip, NOT the old full-bleed poster style) — this should now look visually identical in structure to `/play/points`'s grid.
- No console errors.

Then log out and check the guest (unauthenticated) view of `/` — confirm the "Dominá." gradient, "Crear cuenta gratis" button, and the "¿Cómo funciona?" step icons all render in violet/purple, and the locked-games teaser panel's header icon is violet.

Paste actual observations, not a paraphrase.

- [ ] **Step 16: Commit**

```bash
git add src/pages/Landing.vue
git commit -m "feat(hub-zone): migrate Landing.vue to Hub accent + unified GameCard"
```

---

## Task 3: Migrate `PlayPoints.vue` to the Hub design system

**Files:**
- Modify: `src/pages/PlayPoints.vue`

**Interfaces:**
- Consumes: `GameCard.vue` (Task 1)

- [ ] **Step 1: Update imports**

Find:
```js
import { fetchGames, gameRouteForSlug, getGameTypeLabel, getGameTypeColor } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { getUserLevel } from '../services/xp'
import { POWERUP_GAME_SLUGS } from '../services/powerups'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import DailyResetCountdown from '../components/DailyResetCountdown.vue'
import AyudasPanel from '../components/game/AyudasPanel.vue'
```
Replace with:
```js
import { fetchGames, gameRouteForSlug } from '../services/games'
import { isChallengeAvailable, fetchDailyWinStreak } from '../services/game-modes'
import { getGameUnlockLevel, isGameUnlocked } from '../services/level-rewards'
import { getUserLevel } from '../services/xp'
import { POWERUP_GAME_SLUGS } from '../services/powerups'
import DailyStreakCalendar from '../components/rewards/DailyStreakCalendar.vue'
import DailyResetCountdown from '../components/DailyResetCountdown.vue'
import AyudasPanel from '../components/game/AyudasPanel.vue'
import GameCard from '../components/game/GameCard.vue'
```

- [ ] **Step 2: Hero bar — recolor decorative blob, mode badge, and headline gradient; drop headline weight**

Find:
```html
    <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 px-4 py-3.5 md:px-5 md:py-4 mb-3">
      <div class="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full opacity-25 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%);"></div>

      <div class="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="min-w-0">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Modo Puntos · 1 partida por día
          </span>
          <h1 class="font-display text-xl md:text-2xl font-extrabold text-white leading-tight">
            Elegí tu <span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">desafío</span>
          </h1>
        </div>
```
Replace with:
```html
    <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 px-4 py-3.5 md:px-5 md:py-4 mb-3">
      <div class="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full opacity-25 blur-3xl" style="background: radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%);"></div>

      <div class="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="min-w-0">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 ring-1 ring-violet-400/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 mb-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
            Modo Puntos · 1 partida por día
          </span>
          <h1 class="font-display text-xl md:text-2xl font-bold text-white leading-tight">
            Elegí tu <span class="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">desafío</span>
          </h1>
        </div>
```

- [ ] **Step 3: Stat tiles — drop number weights, recolor "Ganados hoy" tile**

Find:
```html
      <!-- Jugados hoy -->
      <div class="rounded-2xl border border-white/10 bg-slate-900/50 px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-slate-500">Jugados hoy</div>
        <div class="mt-0.5 font-display text-2xl font-extrabold text-white tabular-nums leading-none">
          {{ playedCount }}<span class="text-slate-600 text-base font-bold">/{{ state.loading ? '—' : state.games.length }}</span>
        </div>
      </div>
      <!-- Ganados -->
      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-emerald-400/80">Ganados hoy</div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <span class="text-emerald-400 text-lg font-extrabold">✓</span>
          <span class="font-display text-2xl font-extrabold text-white tabular-nums">{{ totals.win }}</span>
        </div>
      </div>
```
Replace with:
```html
      <!-- Jugados hoy -->
      <div class="rounded-2xl border border-white/10 bg-slate-900/50 px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-slate-500">Jugados hoy</div>
        <div class="mt-0.5 font-display text-2xl font-bold text-white tabular-nums leading-none">
          {{ playedCount }}<span class="text-slate-600 text-base font-bold">/{{ state.loading ? '—' : state.games.length }}</span>
        </div>
      </div>
      <!-- Ganados -->
      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <div class="text-[10px] uppercase tracking-wider text-emerald-400/80">Ganados hoy</div>
        <div class="mt-0.5 flex items-center gap-1.5 leading-none">
          <span class="text-emerald-400 text-lg font-extrabold">✓</span>
          <span class="font-display text-2xl font-bold text-white tabular-nums">{{ totals.win }}</span>
        </div>
      </div>
```

Note: the "Ganados hoy" tile's border/bg/label/checkmark stay `emerald` — this tile is reporting a WIN outcome (semantic), not decorative brand color, consistent with the Global Constraints exclusion.

- [ ] **Step 4: Remaining stat-number weight drops ("Perdidos hoy" and "Racha diaria")**

Find:
```html
          <span class="text-red-400 text-lg font-extrabold">✕</span>
          <span class="font-display text-2xl font-extrabold text-white tabular-nums">{{ totals.loss }}</span>
```
Replace with:
```html
          <span class="text-red-400 text-lg font-extrabold">✕</span>
          <span class="font-display text-2xl font-bold text-white tabular-nums">{{ totals.loss }}</span>
```

Find:
```html
          <span class="font-display text-2xl font-extrabold text-white tabular-nums">{{ state.dailyStreak.current }}</span>
```
Replace with:
```html
          <span class="font-display text-2xl font-bold text-white tabular-nums">{{ state.dailyStreak.current }}</span>
```

- [ ] **Step 5: Loading spinner — recolor**

Find:
```html
      <div class="h-10 w-10 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 animate-spin"></div>
```
Replace with:
```html
      <div class="h-10 w-10 rounded-full border-4 border-violet-400/30 border-t-violet-400 animate-spin"></div>
```

- [ ] **Step 6: Replace the entire locked/unlocked game-card block with `<GameCard>`**

Find (the full `<template v-for="g in state.games">` block, including its comments):
```html
        <template v-for="g in state.games" :key="g.slug">
          <!-- Locked game -->
          <div
            v-if="!isGameUnlocked(g.slug, state.userLevel)"
            class="relative flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-b from-slate-800/40 to-slate-900/60 opacity-60 cursor-not-allowed select-none"
          >
            <div class="relative flex items-center justify-center h-36 bg-slate-800/40">
              <img
                v-if="g.cover_url"
                :src="g.cover_url"
                :alt="g.name"
                class="w-24 h-24 object-contain opacity-20 grayscale"
              />
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
                <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span class="text-[10px] text-slate-400 font-semibold text-center px-2 leading-tight">
                  Nivel {{ getGameUnlockLevel(g.slug) }}
                </span>
              </div>
            </div>
            <div class="bg-slate-900/90 px-3 py-3 border-t border-white/5 text-center">
              <div class="font-display font-bold text-slate-500 text-xs tracking-widest uppercase">BLOQUEADO</div>
              <div class="text-slate-500 text-xs mt-0.5 truncate">{{ g.name }}</div>
            </div>
          </div>

          <!-- Unlocked game — dirección "Limpia": sin barra de degradé, tinte por
               tipo de juego, imagen protagonista y nombre al frente (CTA en hover) -->
          <RouterLink
            v-else
            :to="toChallenge(g.slug)"
            class="game-card group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-800/70 to-slate-900 transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
            :style="{ '--c': getGameTypeColor(g.slug) }"
            :class="[
              state.availability[g.slug]?.result === 'win'
                ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : state.availability[g.slug]?.result === 'loss'
                ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                : ''
            ]"
          >
            <div class="relative flex items-center justify-center h-36 bg-slate-800/40 overflow-hidden">
              <!-- Tinte por tipo de juego (más presente en hover) -->
              <div class="card-tint pointer-events-none absolute inset-0"></div>

              <!-- Chip tipo de juego -->
              <span v-if="getGameTypeLabel(g.slug)" class="absolute top-2 left-2 z-20 rounded-md bg-slate-950/70 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-200 ring-1 ring-white/10">
                {{ getGameTypeLabel(g.slug) }}
              </span>

              <!-- Indicador: este juego admite ayudas -->
              <span
                v-if="AYUDA_SLUGS.has(g.slug)"
                class="absolute bottom-2 left-2 z-20 inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 ring-1 ring-amber-400/30 px-1.5 py-0.5 text-amber-300"
                title="Podés usar ayudas en este juego"
              >
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span class="text-[9px] font-bold uppercase tracking-wide">Ayudas</span>
              </span>

              <div
                v-if="state.availability[g.slug]?.available === false"
                class="absolute inset-0 flex items-center justify-center bg-black/50 z-10"
              >
                <div
                  v-if="state.availability[g.slug]?.result === 'win'"
                  class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-emerald-400/40 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <span class="text-emerald-400 text-3xl font-extrabold leading-none">✓</span>
                </div>
                <div
                  v-else
                  class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-red-400/40 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  <span class="text-red-400 text-3xl font-extrabold leading-none">✕</span>
                </div>
              </div>
              <img
                v-if="g.cover_url"
                :src="g.cover_url"
                :alt="g.name"
                class="relative w-[104px] h-[104px] object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
                :class="state.availability[g.slug]?.available === false ? 'opacity-30' : 'opacity-95'"
              />
              <div v-if="(state.streaks[g.slug] || 0) > 0" class="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-full bg-slate-900/90 ring-1 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.25)] px-2 py-0.5">
                <svg class="w-3 h-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9 8 4 11.5 1c.2-.1.4-.1.5 0 .2.1.2.3.1.5C11 4 14 6 14 6s1-1.5 1.5-4c0-.2.2-.3.4-.3s.3.1.4.3C18 5 20 9 20 14.5 20 19.9 15.6 23 12 23z"/></svg>
                <span class="text-amber-300 font-bold text-[11px] leading-none tabular-nums">{{ state.streaks[g.slug] }}</span>
              </div>
            </div>
            <div class="px-3 py-2.5 border-t border-white/5 flex items-center gap-2">
              <span class="min-w-0 flex-1 font-display font-bold text-white text-[13px] leading-tight truncate">{{ g.name }}</span>
              <span class="card-cta shrink-0 text-[11px] font-extrabold whitespace-nowrap">
                {{ state.availability[g.slug]?.available === false ? 'Ver →' : 'Jugar →' }}
              </span>
            </div>
          </RouterLink>
        </template>
```
Replace with:
```html
        <template v-for="g in state.games" :key="g.slug">
          <GameCard
            :game="g"
            :unlocked="isGameUnlocked(g.slug, state.userLevel)"
            :unlock-level="getGameUnlockLevel(g.slug)"
            :availability="state.availability[g.slug]"
            :streak="state.streaks[g.slug] || 0"
            :show-ayudas="AYUDA_SLUGS.has(g.slug)"
            :to="toChallenge(g.slug)"
          />
        </template>
```

- [ ] **Step 7: Remove the now-unused `.card-tint`/`.card-cta`/`.game-card` styles, and the already-dead `.backdrop-grayscale` rule**

Find:
```css
.backdrop-grayscale {
  -webkit-backdrop-filter: saturate(0) brightness(0.75);
  backdrop-filter: saturate(0) brightness(0.75);
}

/* Dirección "Limpia": tinte de acento por tipo de juego detrás de la imagen */
.card-tint {
  background: radial-gradient(78% 78% at 50% 42%, color-mix(in srgb, var(--c, #34d399) 24%, transparent), transparent 72%);
  opacity: .68;
  transition: opacity .3s ease;
}
.game-card:hover .card-tint { opacity: 1; }
.game-card:hover { border-color: color-mix(in srgb, var(--c, #34d399) 42%, transparent); box-shadow: 0 14px 34px rgba(0,0,0,.42); }

/* CTA "Jugar →" aparece en hover (en móvil no hay hover: manda el nombre) */
.card-cta {
  color: var(--c, #34d399);
  opacity: 0;
  transform: translateX(-5px);
  transition: opacity .2s ease, transform .2s ease;
}
.game-card:hover .card-cta { opacity: 1; transform: none; }
@media (hover: none) {
  .card-cta { opacity: .9; transform: none; }
}
</style>
```
Replace with:
```css
</style>
```

`.backdrop-grayscale` has zero usages anywhere in this file's template (confirmed during research for this plan) — it's pre-existing dead CSS, unrelated to the card migration, but sits right next to what this step is already touching so it's cleaned up here rather than left behind.

- [ ] **Step 8: Verify no leftover references**

```bash
rg 'getGameTypeColor|card-tint|card-cta|backdrop-grayscale' src/pages/PlayPoints.vue
```
Expected: no output.

```bash
rg -n '\.streak-panel' src/pages/PlayPoints.vue
```
Expected: `.streak-panel` and `.streak-panel.open` rules still present (these are untouched by this task, just confirming Step 7's edit didn't accidentally remove them too).

- [ ] **Step 9: Live verification**

With the dev server running, log in and navigate to `/play/points`. Take a screenshot. Confirm:
- Hero badge "Modo Puntos" and the "desafío" headline gradient are violet/purple, not green/cyan.
- The "Jugados hoy" / "Perdidos hoy" / "Racha diaria" numbers still render (weight change is subtle — confirm via `getComputedStyle` that they compute to `font-weight: 700` not `800`).
- "Ganados hoy" tile is still emerald (unchanged — semantic).
- The game grid renders using `GameCard` — visually the SAME card structure as `/` now (confirm by comparing screenshots of both pages side by side, or navigating between them).
- The "Ayudas" indicator chip still appears on games that support power-ups.
- No console errors.

Paste actual observations, not a paraphrase.

- [ ] **Step 10: Commit**

```bash
git add src/pages/PlayPoints.vue
git commit -m "feat(hub-zone): migrate PlayPoints.vue to Hub accent + unified GameCard"
```

---

## Task 4: Clean up now-unused `getGameTypeColor` in `games.js`

**Files:**
- Modify: `src/services/games.js` (only if verification confirms zero remaining consumers)

**Interfaces:** none (pure dead-code removal, conditional on verification)

- [ ] **Step 1: Verify no other file still calls `getGameTypeColor`**

```bash
rg -n 'getGameTypeColor' src --glob '*.vue' --glob '*.js'
```

Expected: only the definition itself in `src/services/games.js` remains (no call sites in any `.vue` or `.js` file, since Tasks 2 and 3 removed the only two consumers).

- [ ] **Step 2: If confirmed unused, remove the function and its backing constant**

Find:
```js
// Color de acento por tipo de juego, para el tinte de cada card en el índice
// (dirección "Limpia"). Da variedad visual sin salirse de una paleta cohesiva.
const GAME_TYPE_COLORS = {
  [GAME_TYPES.TIMED]: '#22d3ee',    // cyan — contrarreloj
  [GAME_TYPES.ORDERING]: '#f472b6', // pink — ordenar
  [GAME_TYPES.LIVES]: '#fb923c',    // orange — vidas
  [GAME_TYPES.WORDLE]: '#a78bfa',   // violet — adivinar
  [GAME_TYPES.CHAIN]: '#fb7185',    // rose — cadena
  [GAME_TYPES.PUZZLE]: '#38bdf8',   // sky — grupos
  [GAME_TYPES.GRID]: '#34d399',     // emerald — grilla
}

export function getGameTypeColor(slug) {
  const t = getGameMetadata(slug)?.type
  return GAME_TYPE_COLORS[t] || '#34d399'
}

```
Replace with: (delete the entire block — remove it, leaving nothing in its place)

If Step 1 found any remaining consumer, STOP and report DONE_WITH_CONCERNS instead of deleting — do not remove code something else still depends on.

- [ ] **Step 3: Verify the app still builds**

```bash
npm run build
```
Expected: succeeds, no errors about a missing `getGameTypeColor` export (confirms Step 1's grep was accurate).

- [ ] **Step 4: Commit**

```bash
git add src/services/games.js
git commit -m "chore(hub-zone): remove unused per-game-type color system"
```

---

## Self-Review Notes

- **Spec coverage:** Landing.vue and PlayPoints.vue both migrated to the Hub accent (Task 2, 3) ✓, unified game-card treatment resolving the spec's original diagnosed inconsistency (Task 1-3) ✓, Space Grotesk weight ceiling applied (Tasks 2-3) ✓, dead per-game-color system removed (Task 4) ✓.
- **Explicitly deferred to later waves, not this one:** `.surface-solid` migration for elements other than the game cards (the hero cards, stat tiles, and step cards in these two files still use raw `bg-slate-900/*` Tailwind stacks rather than `.surface-solid`) — the spec's surface system applies per-zone incrementally, and fully re-skinning every card in these two files' surface treatment (not just color) is a larger scope than this wave's stated goal (accent color + card unification + font weight). Flag this as a candidate for a future pass once all 3 Hub-zone waves are visually validated together, so surface-level changes aren't made in isolation from the sibling files (FriendsDock, Profile, Pricing, etc.) that will need the same treatment.
- **Live-match row exception:** documented explicitly in Global Constraints and Task 2 comments — this is a deliberate design judgment (green = live sports convention, not brand identity), not an oversight. Flag for the owner to confirm they agree during Step 15's live verification.
