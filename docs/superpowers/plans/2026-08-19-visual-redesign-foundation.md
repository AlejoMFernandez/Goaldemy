# Visual Redesign — Fase Fundación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the shared design-system foundation (tokens, surfaces, zone metadata, icon/motion cleanup) for Goaldemy's visual redesign, without yet applying it to any page — this phase should be invisible in the running app except for two safe, immediately-correct exceptions (the global wordmark color and TeamPage's icon set).

**Architecture:** Pure additive CSS custom properties in `src/style.css` (same pattern already used for `--brand-*`/`--ease-*`), route metadata in `src/router/router.js` (same pattern as the existing `meta.immersive`), and two isolated, low-risk cleanups (dead keyframe removal, Bootstrap Icons → inline SVG in the one file that uses them). No new build tooling, no Tailwind config changes, no new dependencies.

**Tech Stack:** Vue 3 (Options API + `<script setup>` mixed in this codebase), Vue Router 4, Tailwind CSS v4 (`@import "tailwindcss"` in `style.css`), Vite 7. No unit test framework is configured in this project (`package.json` has no `vitest`/`jest`) — verification in this plan is done via `npm run dev` + grep + live Playwright checks against the running app, matching the method already used successfully in this project's prior responsive-fix pass.

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- Do not remove or rename any existing `--brand-*`, `--surface-*`, `--radius-card`, or `--ease-*` token in this phase — pages still consume them until their zone's phase migrates them. Only add new tokens alongside.
- Do not touch backend/RPC code, Supabase schema, or any `services/*.js` business logic.
- The app stays dark-only (`color-scheme: dark` in `body`) — no light-mode work.
- New icons follow the Heroicons v2 **outline** convention already dominant in this codebase: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
- Reuse the existing easing tokens (`--ease-bounce`, `--ease-spring`, `--ease-snappy`, `--ease-out-expo`) — do not invent new ones in this phase.
- Every task must leave `npm run dev` building with no new console errors.

---

## Task 1: Midnight Broadcast tokens + radius scale

**Files:**
- Modify: `src/style.css:11-18` (insert new token block after the existing brand palette, before `/* Surface elevation system */`)

**Interfaces:**
- Produces: CSS custom properties `--mb-950`, `--mb-900`, `--mb-800`, `--mb-border`, `--hub-300`, `--hub-400`, `--hub-500`, `--play-400`, `--play-500`, `--play-600`, `--data-500`, `--data-600`, `--data-700`, `--mb-success`, `--mb-danger`, `--mb-prestige`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` — all consumed by Task 3 (surfaces) and by later zone-phase plans (not this one).

- [ ] **Step 1: Insert the new token block**

In `src/style.css`, find:
```css
    --accent-gold: #fbbf24;              /* victorias / estrellas / rachas */
    --radius-card: 1.1rem;

    /* Surface elevation system */
```

Replace with:
```css
    --accent-gold: #fbbf24;              /* victorias / estrellas / rachas */
    --radius-card: 1.1rem;

    /* ─── Rediseño 2026: "Midnight Broadcast" ───
       docs/superpowers/specs/2026-08-19-visual-redesign-design.md
       Convive con --brand-* mientras dura el rollout por zonas: nada se borra
       todavía, solo se agrega. Los --brand-* se retiran cuando la Zona Hub migre. */

    /* Base compartida entre las 3 zonas */
    --mb-950: #070a1a;
    --mb-900: #0b1024;
    --mb-800: #141a38;
    --mb-border: rgba(255,255,255,.06);

    /* Acento Zona Hub/Social — violeta-índigo */
    --hub-300: #c084fc;
    --hub-400: #a78bfa;
    --hub-500: #818cf8;

    /* Acento Zona Juego — dorado, único acento en reposo */
    --play-400: #fcd34d;
    --play-500: #f59e0b;
    --play-600: #d97706;

    /* Acento Zona Data — azul puro, sin decoración */
    --data-500: #60a5fa;
    --data-600: #2563eb;
    --data-700: #3b82f6;

    /* Semántico — cruza las 3 zonas, solo como feedback transitorio (~600ms) */
    --mb-success: #4ade80;
    --mb-danger: #ef4444;
    --mb-prestige: #fbbf24;

    /* Escala de radios (reemplaza el mix actual de rounded-lg/xl/2xl/3xl sin criterio) */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;

    /* Surface elevation system */
```

- [ ] **Step 2: Verify the tokens resolve**

Start the dev server if it isn't already running:
```bash
npm run dev
```

Using the Playwright MCP tools (or the browser devtools console), navigate to `http://localhost:5173/` and run:
```js
() => ['--mb-900','--hub-500','--play-500','--data-500','--radius-lg']
  .map(t => [t, getComputedStyle(document.documentElement).getPropertyValue(t).trim()])
```
Expected: `[['--mb-900','#0b1024'], ['--hub-500','#818cf8'], ['--play-500','#f59e0b'], ['--data-500','#60a5fa'], ['--radius-lg','16px']]` — no empty strings.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat(design-system): add Midnight Broadcast palette + radius scale tokens"
```

---

## Task 2: Space Grotesk display typeface

**Files:**
- Modify: `src/style.css:2` (Google Fonts import)
- Modify: `src/style.css:9` (`--font-display`)

**Interfaces:**
- Produces: `--font-display` now resolves to `"Space Grotesk", var(--font-sans)`. Consumed automatically by the existing `.font-display` utility class (`src/style.css:280`), already used in 49 files across the codebase — no per-component changes needed.

- [ ] **Step 1: Swap the Google Fonts import**

Find:
```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=optional");
```

Replace with:
```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Space+Grotesk:wght@600;700&display=optional");
```

- [ ] **Step 2: Point `--font-display` at Space Grotesk**

Find:
```css
    --font-display: "Plus Jakarta Sans", var(--font-sans);
```

Replace with:
```css
    --font-display: "Space Grotesk", var(--font-sans);
```

- [ ] **Step 3: Verify the font loads and applies**

With the dev server running, navigate to `http://localhost:5173/` and run:
```js
() => {
  const h1 = document.querySelector('h1, .font-display');
  return { family: getComputedStyle(h1).fontFamily, loaded: document.fonts.check('700 24px "Space Grotesk"') };
}
```
Expected: `family` starts with `"Space Grotesk"`, `loaded: true`.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "feat(design-system): swap display typeface to Space Grotesk"
```

---

## Task 3: `.surface-solid` / `.surface-flat` utility classes

**Files:**
- Modify: `src/style.css` (insert after the existing `.card` block, `src/style.css:93-98`)

**Interfaces:**
- Consumes: `--mb-800`, `--mb-900`, `--mb-border`, `--radius-lg`, `--radius-md`, `--data-500` (from Task 1)
- Produces: CSS classes `.surface-solid`, `.surface-flat` — not consumed by any component yet in this phase (zone phases migrate `.card` usages to these).

- [ ] **Step 1: Add the two surface classes**

Find:
```css
.card {
    border-radius: var(--radius-card);
    border: 1px solid rgba(255,255,255,0.10);
    background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05) inset;
}
```

Replace with:
```css
.card {
    border-radius: var(--radius-card);
    border: 1px solid rgba(255,255,255,0.10);
    background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05) inset;
}
/* Superficies del rediseño 2026 (ver spec). Conviven con .card durante el
   rollout — cada zona migra sus componentes de .card a una de estas dos según
   su fase: Hub y Juego usan .surface-solid, Data usa .surface-flat. */
.surface-solid {
    border-radius: var(--radius-lg);
    background: var(--mb-800);
    border: 1px solid var(--mb-border);
    box-shadow: 0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
}
.surface-flat {
    border-radius: var(--radius-md);
    background: var(--mb-900);
    border: 1px solid rgba(96,165,250,.22);
}
```

- [ ] **Step 2: Verify both classes render with correct computed styles**

With the dev server running, run in the browser console (any page):
```js
() => {
  const el = document.createElement('div');
  el.className = 'surface-solid';
  document.body.appendChild(el);
  const solid = { bg: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderRadius };
  el.className = 'surface-flat';
  const flat = { bg: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderRadius };
  el.remove();
  return { solid, flat };
}
```
Expected: `solid.bg` is `rgb(20, 26, 56)` (`#141a38`), `solid.radius` is `16px`; `flat.bg` is `rgb(11, 16, 36)` (`#0b1024`), `flat.radius` is `12px`.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat(design-system): add .surface-solid and .surface-flat utility classes"
```

---

## Task 4: Zone metadata on every route

**Files:**
- Modify: `src/router/router.js:50-98` (the full `routes` array)

**Interfaces:**
- Produces: `meta.zone` (`'hub' | 'play' | 'data'`) on every route object, following the exact mapping in the spec's zone table. Consumed by `src/App.vue` in zone-phase plans (not this one) via `this.$route.meta.zone`, mirroring the existing `this.$route.meta.immersive` pattern already in `App.vue`.

- [ ] **Step 1: Replace the routes array with the zone-annotated version**

Find (the exact current array, unmodified):
```js
const routes = [
    { path: '/', component: Landing },
    { path: '/competiciones', component: CompetitionsHub },
    { path: '/leagues', redirect: '/competiciones' },
    { path: '/leagues/:slug', component: CompetitionPage },
    { path: '/team/:teamId', component: TeamPage },
    { path: '/login', component: Login, meta: { layout: 'auth' } },
    { path: '/register', component: Register, meta: { layout: 'auth' } },
    { path: '/verify-email', component: VerifyEmail, meta: { layout: 'auth' } },
    { path: '/reset-password', component: ResetPassword, meta: { layout: 'auth' } },
    { path: '/profile', component: Profile, meta: { requiresAuth: true } },
    { path: '/profile-edit', component: ProfileEdit, meta: { requiresAuth: true } },
    { path: '/teams', component: Teams },
    { path: '/games/guess-player', component: GuessPlayer, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/who-is', component: WhoIs, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/value-order', component: ValueOrder, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/age-order', component: AgeOrder, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/height-order', component: HeightOrder, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/once-ideal', component: OnceIdeal, meta: { requiresAuth: true } },
    { path: '/games/football-wordle', component: FootballWordle, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/higher-or-lower', component: HigherOrLower, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/connections', component: Connections, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/football-grid', component: FootballGrid, meta: { requiresAuth: true, immersive: true } },
    { path: '/games/stat-challenge', component: StatChallenge, meta: { requiresAuth: true } },
    { path: '/leaderboards', component: Leaderboards },
    { path: '/u/:id', component: Profile, meta: { requiresAuth: true } },
    { path: '/notifications', component: Notifications, meta: { requiresAuth: true } },
    { path: '/messages', component: DirectMessages, meta: { requiresAuth: true } },
    { path: '/messages/:peerId', component: DirectChat, meta: { requiresAuth: true } },
    // Admin Panel
    { path: '/admin', component: AdminPanel, meta: { requiresAuth: true, requiresAdmin: true } },
    // About / Info
    { path: '/about/me', component: AboutMe },
    { path: '/about/goaldemy', component: AboutGoaldemy },
    { path: '/about/objetivo', component: AboutObjective },
    // Play landing pages
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true } },
    // /play/free (Juego Libre) retirado en MEJORAS12: redirige al índice por puntos
    { path: '/play/free', redirect: '/play/points' },
    { path: '/rewards', component: RewardCenter, meta: { requiresAuth: true } },
    { path: '/tienda', component: Tienda, meta: { requiresAuth: true } },
    { path: '/pricing', component: Pricing },
    // Reto del día — funnel público sin login (entrada de marketing / streamers)
    { path: '/reto', component: DailyChallenge },
    // 404 fallback
    { path: '/:pathMatch(.*)*', component: NotFound },
]
```

Replace with:
```js
const routes = [
    { path: '/', component: Landing, meta: { zone: 'hub' } },
    { path: '/competiciones', component: CompetitionsHub, meta: { zone: 'data' } },
    { path: '/leagues', redirect: '/competiciones' },
    { path: '/leagues/:slug', component: CompetitionPage, meta: { zone: 'data' } },
    { path: '/team/:teamId', component: TeamPage, meta: { zone: 'data' } },
    { path: '/login', component: Login, meta: { layout: 'auth', zone: 'hub' } },
    { path: '/register', component: Register, meta: { layout: 'auth', zone: 'hub' } },
    { path: '/verify-email', component: VerifyEmail, meta: { layout: 'auth', zone: 'hub' } },
    { path: '/reset-password', component: ResetPassword, meta: { layout: 'auth', zone: 'hub' } },
    { path: '/profile', component: Profile, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/profile-edit', component: ProfileEdit, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/teams', component: Teams, meta: { zone: 'data' } },
    { path: '/games/guess-player', component: GuessPlayer, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/who-is', component: WhoIs, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/value-order', component: ValueOrder, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/age-order', component: AgeOrder, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/height-order', component: HeightOrder, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/once-ideal', component: OnceIdeal, meta: { requiresAuth: true, zone: 'play' } },
    { path: '/games/football-wordle', component: FootballWordle, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/higher-or-lower', component: HigherOrLower, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/connections', component: Connections, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/football-grid', component: FootballGrid, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/stat-challenge', component: StatChallenge, meta: { requiresAuth: true, zone: 'play' } },
    { path: '/leaderboards', component: Leaderboards, meta: { zone: 'data' } },
    { path: '/u/:id', component: Profile, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/notifications', component: Notifications, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/messages', component: DirectMessages, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/messages/:peerId', component: DirectChat, meta: { requiresAuth: true, zone: 'hub' } },
    // Admin Panel
    { path: '/admin', component: AdminPanel, meta: { requiresAuth: true, requiresAdmin: true, zone: 'data' } },
    // About / Info
    { path: '/about/me', component: AboutMe, meta: { zone: 'hub' } },
    { path: '/about/goaldemy', component: AboutGoaldemy, meta: { zone: 'hub' } },
    { path: '/about/objetivo', component: AboutObjective, meta: { zone: 'hub' } },
    // Play landing pages
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true, zone: 'hub' } },
    // /play/free (Juego Libre) retirado en MEJORAS12: redirige al índice por puntos
    { path: '/play/free', redirect: '/play/points' },
    { path: '/rewards', component: RewardCenter, meta: { requiresAuth: true, zone: 'play' } },
    { path: '/tienda', component: Tienda, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/pricing', component: Pricing, meta: { zone: 'hub' } },
    // Reto del día — funnel público sin login (entrada de marketing / streamers)
    { path: '/reto', component: DailyChallenge, meta: { zone: 'play' } },
    // 404 fallback
    { path: '/:pathMatch(.*)*', component: NotFound, meta: { zone: 'hub' } },
]
```

- [ ] **Step 2: Verify every route resolves a zone**

With the dev server running, run in the browser console:
```js
async () => {
  const mod = await import('/src/router/router.js');
  const missing = mod.default.options.routes.filter(r => !r.redirect && !r.meta?.zone).map(r => r.path);
  return { total: mod.default.options.routes.length, missing };
}
```
Expected: `missing: []` (every non-redirect route has a zone; the two `redirect` entries — `/leagues` and `/play/free` — legitimately have no `meta` at all, matching the current code, so they're excluded from the check).

- [ ] **Step 3: Smoke-test navigation still works**

Navigate to `/`, then to `/leagues/world-cup`, then to `/games/nationality` (log in first if needed) and confirm each loads without a router error in the console. This is a pure metadata addition — no route resolution behavior should change.

- [ ] **Step 4: Commit**

```bash
git add src/router/router.js
git commit -m "feat(design-system): tag every route with its redesign zone (hub/play/data)"
```

---

## Task 5: Recolor the global wordmark to the Hub accent

**Files:**
- Modify: `src/components/GoaldemyLogo.vue:56`

**Interfaces:**
- Consumes: none (uses Tailwind stock utility colors that match the Task 1 hub tokens: `indigo-400` = `#818cf8` = `--hub-500`, `purple-400` = `#c084fc` = `--hub-300`).

This component renders the "GOALDEMY" wordmark used in `AppNavBar.vue`, `AppFooter.vue`, `AppLoader.vue`, and the 3 `/about/*` pages — it's global chrome present on every page regardless of zone, so it takes the Hub accent (the "home base" identity), matching the same convention already used for the always-visible `FriendsDock`.

- [ ] **Step 1: Swap the gradient**

Find:
```html
      <span class="text-white">GOAL</span><span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">DEMY</span>
```

Replace with:
```html
      <span class="text-white">GOAL</span><span class="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">DEMY</span>
```

- [ ] **Step 2: Verify visually**

With the dev server running, navigate to `http://localhost:5173/` and take a screenshot of the header. Confirm "DEMY" renders as an indigo→purple gradient (not the old green→cyan).

- [ ] **Step 3: Commit**

```bash
git add src/components/GoaldemyLogo.vue
git commit -m "feat(design-system): recolor GOALDEMY wordmark to Hub accent (indigo→purple)"
```

---

## Task 6: Replace Bootstrap Icons in `TeamPage.vue` with inline SVG

**Files:**
- Modify: `src/pages/TeamPage.vue` (16 `<i class="bi bi-*">` occurrences, listed below)

**Interfaces:**
- Consumes: none (self-contained markup change)
- Produces: no more `bi bi-` usage anywhere in the codebase — this was the only file using Bootstrap Icons (verified via `rg 'class="bi bi-' src --glob '*.vue'` returning only this file).

Icon paths below are copied verbatim from Heroicons v2 outline (`https://unpkg.com/heroicons@2.1.5/24/outline/<name>.svg`) — do not hand-draw replacements.

- [ ] **Step 1: Replace `bi-exclamation-triangle` (line 14)**

Find:
```html
      <i class="bi bi-exclamation-triangle text-5xl text-red-500 mb-4"></i>
```
Replace with:
```html
      <svg class="w-12 h-12 text-red-500 mb-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
```

- [ ] **Step 2: Replace `bi-shield` (line 34)**

Find:
```html
              <i class="bi bi-shield text-4xl text-slate-400"></i>
```
Replace with:
```html
              <svg class="w-9 h-9 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
```

- [ ] **Step 3: Replace `bi-geo-alt` (line 43, no extra classes)**

Find:
```html
                <i class="bi bi-geo-alt"></i>
```
Replace with:
```html
                <svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>
```

- [ ] **Step 4: Replace `bi-building` (line 47, no extra classes)**

Find:
```html
              <i class="bi bi-building"></i>
```
Replace with:
```html
              <svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
```

- [ ] **Step 5: Replace `bi-flag` (line 51)**

Find:
```html
              <i class="bi bi-flag"></i>
```
Replace with:
```html
              <svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"/></svg>
```

- [ ] **Step 6: Replace both `bi-calendar-event text-blue-500` occurrences (lines 100 and 447 — identical text, use `replace_all`)**

Find (both occurrences):
```html
              <i class="bi bi-calendar-event text-blue-500"></i>
```
Replace with:
```html
              <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/></svg>
```
Use the Edit tool's `replace_all: true` for this step since both occurrences are identical and get the identical replacement.

- [ ] **Step 7: Replace `bi-graph-up` (line 129)**

Find:
```html
              <i class="bi bi-graph-up text-green-500"></i>
```
Replace with:
```html
              <svg class="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg>
```

- [ ] **Step 8: Replace `bi-trophy` (line 176)**

Find:
```html
                <i class="bi bi-trophy text-yellow-500"></i>
```
Replace with:
```html
                <svg class="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0"/></svg>
```

- [ ] **Step 9: Replace `bi-building text-cyan-400` (line 205)**

Find:
```html
              <i class="bi bi-building text-cyan-400"></i>
```
Replace with:
```html
              <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
```

- [ ] **Step 10: Replace `bi-geo-alt text-slate-500 mr-1` (line 212)**

Find:
```html
                    <i class="bi bi-geo-alt text-slate-500 mr-1"></i>
```
Replace with:
```html
                    <svg class="w-3.5 h-3.5 inline text-slate-500 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>
```

- [ ] **Step 11: Replace `bi-people text-slate-500 mr-1` (line 216)**

Find:
```html
                    <i class="bi bi-people text-slate-500 mr-1"></i>
```
Replace with:
```html
                    <svg class="w-3.5 h-3.5 inline text-slate-500 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>
```

- [ ] **Step 12: Replace `bi-calendar text-slate-500 mr-1` (line 220)**

Find:
```html
                    <i class="bi bi-calendar text-slate-500 mr-1"></i>
```
Replace with:
```html
                    <svg class="w-3.5 h-3.5 inline text-slate-500 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
```

- [ ] **Step 13: Replace `bi-diagram-3` (line 289)**

Find:
```html
            <i class="bi bi-diagram-3 text-5xl mb-4 block"></i>
```
Replace with:
```html
            <svg class="w-12 h-12 mb-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122"/></svg>
```

- [ ] **Step 14: Replace `bi-people text-5xl mb-4 block` (line 343)**

Find:
```html
              <i class="bi bi-people text-5xl mb-4 block"></i>
```
Replace with:
```html
              <svg class="w-12 h-12 mb-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>
```

- [ ] **Step 15: Replace `bi-check-circle` (line 485)**

Find:
```html
              <i class="bi bi-check-circle text-green-500"></i>
```
Replace with:
```html
              <svg class="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
```

- [ ] **Step 16: Verify no Bootstrap Icons remain anywhere in the project**

```bash
rg 'class="bi bi-' src --glob '*.vue'
```
Expected: no output.

- [ ] **Step 17: Visual check**

With the dev server running, navigate to a real team page (e.g. `http://localhost:5173/team/9825`) and confirm every icon that used to render as a Bootstrap glyph now renders as a matching outline SVG at a reasonable size (no giant/missing icons). Check both the error state (`/team/999999999`) and the empty "no matches" state if reachable.

- [ ] **Step 18: Commit**

```bash
git add src/pages/TeamPage.vue
git commit -m "feat(design-system): replace Bootstrap Icons with Heroicons-style SVG in TeamPage"
```

---

## Task 7: Remove dead animation keyframes

**Files:**
- Modify: `src/style.css`

**Interfaces:** none (pure deletion of unreferenced code)

Confirmed via `rg` across every `.vue` and `.js` file in `src/` (checked both static `class="..."` bindings and dynamic/inline `style="animation: ..."` bindings) that these 9 keyframes have **zero** consumers anywhere in the codebase. Every other keyframe in `style.css` has at least one real, verified usage and stays untouched in this phase — do not remove anything not listed below.

- [ ] **Step 1: Remove `fade-in`, `float`, `shimmer` (all three are back-to-back and orphaned)**

Find:
```css
/* Keyframes for subtle motion */
@keyframes fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-4px); }
}

@keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

/* App base */
```
Replace with:
```css
/* App base */
```

Note: `DailyStreakBanner.vue` has its own component-scoped `@keyframes float` — that one is untouched, it's a separate declaration and already properly encapsulated.

- [ ] **Step 2: Remove `pulse-glow`**

Find:
```css
/* Pulse glow for live elements */
@keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); }
    50% { box-shadow: 0 0 12px 4px rgba(52, 211, 153, 0.2); }
}
.pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }

/* Score pop animation */
@keyframes score-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.25); }
    100% { transform: scale(1); }
}
.score-pop { animation: score-pop 0.3s ease; }

/* Shake for wrong answers — snappy with decay */
```
Replace with:
```css
/* Shake for wrong answers — snappy with decay */
```

- [ ] **Step 3: Remove `bar-shimmer`**

Find:
```css
/* XP bar fill shimmer */
@keyframes bar-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

/* Ripple effect for correct answer */
@keyframes option-ripple {
    0% { transform: scale(0); opacity: 0.5; }
    100% { transform: scale(4); opacity: 0; }
}

/* Level number morph */
```
Replace with:
```css
/* Level number morph */
```

- [ ] **Step 4: Remove `chest-bounce` and `counter-pop`**

Find:
```css
/* Chest bounce for daily streak */
@keyframes chest-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
}

/* Claim button glow pulse */
@keyframes claim-pulse {
    0%, 100% { box-shadow: 0 0 12px 2px rgba(16,185,129,0.4); }
    50% { box-shadow: 0 0 24px 6px rgba(16,185,129,0.6); }
}

/* Counter spin-up for animated numbers */
@keyframes counter-pop {
    0% { transform: scale(0.8); opacity: 0.5; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
}

/* ─── Cosméticos PRO (animaciones tipo Steam) ─── */
```
Replace with:
```css
/* Claim button glow pulse */
@keyframes claim-pulse {
    0%, 100% { box-shadow: 0 0 12px 2px rgba(16,185,129,0.4); }
    50% { box-shadow: 0 0 24px 6px rgba(16,185,129,0.6); }
}

/* ─── Cosméticos PRO (animaciones tipo Steam) ─── */
```

- [ ] **Step 5: Verify nothing references the removed keyframes**

```bash
rg -w '(fade-in|pulse-glow|score-pop|bar-shimmer|option-ripple|chest-bounce|counter-pop)' src/style.css
```
Expected: no output (all 7 named keyframes gone from the CSS; `float` and `shimmer` are checked separately below since `float` legitimately still exists as `DailyStreakBanner.vue`'s own scoped keyframe).

```bash
rg -w 'shimmer' src/style.css
```
Expected: only `title-shimmer` remains (used by `.title-premium-anim`).

- [ ] **Step 6: Confirm the app still boots clean**

```bash
npm run dev
```
Navigate to `/`, `/play/points`, `/rewards`, and one game page. Confirm no console errors about missing animations and that existing motion (streak badge bump, claim button glow, achievement overlay) still plays normally — none of the removed keyframes back any live feature.

- [ ] **Step 7: Commit**

```bash
git add src/style.css
git commit -m "chore(design-system): remove 7 unused animation keyframes"
```

---

## Self-Review Notes

- **Spec coverage:** tokens (Task 1) ✓, typography (Task 2) ✓, surfaces (Task 3) ✓, zone metadata (Task 4) ✓, icon audit+replacement (Task 6) ✓, motion audit+prune (Task 7) ✓. Wordmark recolor (Task 5) was not explicitly itemized in the spec's Foundation bullet list but is required by the spec's "el gradiente del texto GOALDEMY pasa a la nueva paleta" line and is global chrome (not zone content) — included here since deferring it would leave the header visibly on the old brand colors through the entire Hub-zone phase.
- **Not in this plan (by design):** migrating any page's `.card` usages to `.surface-solid`/`.surface-flat`, applying zone accents to any component, retiring `--brand-*`. Those belong to the Hub/Play/Data zone plans, written after this phase is validated live with the owner.
