# Data Wave 1 — Competitions + Brackets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Data zone's design system (pure-blue single accent, `.surface-flat`, Space Grotesk weight ceiling) to the Competitions + brackets cluster — `src/pages/leagues/CompetitionsHub.vue`, `src/pages/leagues/CompetitionPage.vue`, `src/components/league/KnockoutBracket.vue`, `src/components/league/TournamentBracket.vue` — the FIRST wave of Zona Data (the final zone of the whole redesign; Zona Hub and Zona Juego are both fully merged to main). This wave establishes the Data-zone vocabulary that Data Waves 2 (Leaderboards) and 3 (Teams) will reuse.

**Architecture:** No new shared component. Pure recolor + font-weight fixes + this zone's headline surface decision: `.surface-flat` has never been used anywhere in the app across all 9 prior waves (Hub/Play only ever used `.surface-solid`) — this wave is its first real application, scoped narrowly to genuine table/bracket display surfaces per the spec's own literal wording, not broadened to every card in the cluster. `KnockoutBracket.vue` carries its card styling in raw scoped CSS (no Tailwind classes at all for its card chrome), the same mechanism Play Wave 1 discovered in `GameShell.vue` — but here it interacts with `.surface-flat` differently than any prior wave's raw-CSS case: because `.kb-card`'s scoped rule carries a Vue-generated `[data-v-xxx]` attribute selector, its specificity (0,2,0) is HIGHER than the plain global `.surface-flat` class (0,1,0), so simply adding the `surface-flat` class to the template would NOT be enough — the scoped rule's own `border`/`background`/`box-shadow` declarations must be deleted from the `<style scoped>` block itself, or `.surface-flat` will be silently inert despite being unlayered (a NEW variant of the cascade-collision bug class that has bitten this initiative before, caused by specificity this time rather than layer order).

**Tech Stack:** Vue 3 (Options API), Tailwind CSS v4. Foundation + all 3 Hub waves + all 6 Play waves already merged to `main`. No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- **Data-zone color vocabulary (NEW this wave — read carefully, this precedent governs Data Waves 2-3):** `src/style.css` defines `--data-500: #60a5fa`, `--data-600: #2563eb`, `--data-700: #3b82f6`. Cross-checked against Tailwind v4's actual blue-family hexes: `#60a5fa` = `blue-400`, `#2563eb` = `blue-600`, `#3b82f6` = `blue-500` — the SAME kind of token-name-vs-Tailwind-rung drift already documented for `--hub-500` (=`indigo-400`) and `--play-400` (=`amber-300`); additionally note the token scale itself is non-monotonic (`--data-700`'s hex is LIGHTER than `--data-600`'s — almost certainly a copy-paste slip in the original spec/token authoring, not addressed by this wave, out of scope to "fix" a design token). **Checked the full token list in `style.css` for a reserved-rung collision the way `amber-400` collided with `--mb-prestige`: none exists** — no cross-zone semantic token (`--mb-success`, `--mb-danger`, `--mb-prestige`, Hub's or Play's tokens) uses any shade of blue, so there is no rung to avoid the way Play zone had to avoid `amber-400`. Established mapping, monochrome (spec: "azul puro, sin decoración" — one hue, matching Play's "único acento" precedent, NOT Hub's two-hue violet+purple): `emerald-300`/`cyan-300`→`blue-300`, `emerald-400`/`cyan-400`→`blue-400`, `emerald-500`/`cyan-500`→`blue-500`. Both hues collapse to the same rung (monochrome), matching Play Wave 1's `cyan-400`→`amber-300` precedent (same target as `emerald-400`).

- **Filled/solid CTA idiom (established this wave, first Data-zone filled CTA)**: unlike Play's `amber-500`→`amber-600` gradient + `text-slate-900` (which works because amber stays light even at its darkest CTA rung), a naive `blue-500`→`blue-600` gradient with either white OR dark text FAILS WCAG AA at one end or the other — computed: `text-white` on `blue-500` (#3b82f6) = 3.68:1 (fails, needs 4.5:1); `text-slate-900` on `blue-600` (#2563eb) = 3.45:1 (also fails). The established idiom for this wave's one filled CTA (Task 2, Step 5) is a LIGHTER-range monochrome gradient instead: `from-blue-400 to-blue-500` + `text-slate-900` — computed contrast is 7.03:1 at the `blue-400` end and 4.855:1 at the `blue-500` end, both clearing AA. **Use `from-blue-400 to-blue-500` + `text-slate-900` for every filled Data-zone CTA this wave and going forward** — do not default to the `-500`→`-600` range Play zone used, blue's darker rungs are too saturated for reliable dark-text contrast.

- **`.surface-flat` — this wave's headline decision, ALREADY RULED, do not re-litigate:** per spec, `.surface-flat` = "Fondo `--mb-900`, borde 1px con tinte `--data-*` al 20-25% opacidad, sin sombra ni blur — prioriza densidad/legibilidad de tablas y brackets" (`src/style.css:132-136` — `background: var(--mb-900); border: 1px solid color-mix(in srgb, var(--data-500) 22%, transparent);`, no shadow/blur property, confirming "sin sombra ni blur" is enforced by the class itself). **Ruling: Zona Data's table and bracket containers are the deliberate, spec-sanctioned exception to the narrow surface-migration discipline every prior wave held** — the spec names "tablas y brackets" as this class's literal purpose, and this wave's whole reason for existing is a standings table and two bracket renderers. This is NOT a blanket broadening to every card in the cluster — only containers that are genuinely a table or bracket display surface get it (4 specific containers, named per-task below); every other card (tournament-selector grid cards, the Partidos/Goleadores/Asistidores sidebar list cards) stays out of scope, holding the same narrow-pattern discipline as every prior wave. **Collision-avoidance rule** (same principle as every `.surface-solid` migration since Wave 1): drop any coexisting `shadow-*`/`backdrop-blur*` utility or raw-CSS shadow declaration when adding `.surface-flat` — "sin sombra ni blur" is the class's whole point, stacking a shadow defeats it visually even where it wouldn't cause a hard bug.

- **What must NOT be recolored, left exactly as-is (this wave has more exclusion reasoning than actual recolor instructions — expected, per the Play Wave 5 final reviewer's explicit warning that this zone would be "worse" than gamified pages):**
  1. **The "live match/competition" indicator system — a single cohesive cross-app semantic, not decorative chrome.** Appears in 3 places this wave: `CompetitionsHub.vue`'s featured-tournament "En vivo" badge (border/bg/ping-dot, 4 classes) AND its per-card "Vivo" badge + conditional hover accent + "Ver →" link (all gated behind `c.status === 'live'`, rendered/styled together as one visual system for a live card — do not recolor some of these and leave others, that would fragment one semantic into a broken-looking mix); `CompetitionPage.vue`'s header pulse-dot (`bg-emerald-400 animate-pulse`) and its "VIVO" match-status badge; `TournamentBracket.vue`'s "En vivo" match badge. All emerald, all the SAME already-functioning cross-app "this is happening right now" convention — recoloring it to blue here would create a NEW inconsistency with identical live-indicators elsewhere in the app, not fix one. This is DIFFERENT from the already-known, still-open Hub Wave 1 finding ("dos colores 'en vivo' distintos" — a guest-hero pulse dot vs. this same real-match convention) — that finding is about a SEPARATE decorative element elsewhere disagreeing with THIS convention, not about this convention being wrong; not re-litigated or touched by this wave either way.
  2. **Goal-difference (DG) sign indicator** (`CompetitionPage.vue`, standings table, 2 occurrences): `team.goalConDiff > 0 ? 'text-green-400' : team.goalConDiff < 0 ? 'text-red-400' : 'text-slate-400'`. Plain `green`/`red` (NOT `emerald`/the mapping's target), a real sports-data semantic (positive/negative goal differential) — doubly out of scope (different color name AND semantic), same "double-protected" pattern as `ShirtNumber.vue`'s/`StatChallenge.vue`'s `optionClass()` from Play waves.
  3. **Qualification-zone color bar** (`CompetitionPage.vue`, standings table, 2 occurrences): `:style="{ backgroundColor: team.qualColor || 'transparent' }"`. A data-bound inline style, not a Tailwind class at all — there is no static string for a Find/Replace to target, automatically out of scope. The actual color values live in whatever backend/service computes `team.qualColor` (likely FotMob data or a service layer), outside this wave's templates/styles-only mandate entirely.
  4. **Win/match-outcome highlight colors** — `KnockoutBracket.vue`'s raw-CSS `.kb-win .kb-score { color: #34d399; }` (emerald-400's hex) and `TournamentBracket.vue`'s `winnerSide(m) === 'home'/'away' ? 'text-emerald-300' : 'text-slate-400'` on both team-score spans. The cross-zone win/loss-adjacent semantic (same category `GameCard.vue` established in Hub Wave 1) — a bracket match's winner stays visually marked regardless of zone. `KnockoutBracket.vue`'s `.kb-lose { opacity: 0.45; }` and `.kb-win .kb-name { color: #fff; font-weight: 800; }` (the latter's `font-weight: 800` is NOT paired with `.font-display` anywhere in this file's CSS — confirmed, no `--font-display`/`.font-display` reference exists in `KnockoutBracket.vue` at all — so the established font-weight-ceiling rule does not apply here, leave `800` exactly as-is) are part of the same untouched system.
  5. **Pre-existing amber/gold "prestige moment" chrome** — never emerald/cyan to begin with, out of scope by definition, same rule every prior wave applied: `CompetitionsHub.vue`'s featured-Mundial banner (glow, icon tile, "Ver torneo" CTA — all amber); `KnockoutBracket.vue`'s trophy emoji glow, `.kb-final-label`, `.kb-final`'s border/glow, `.kb-bronze`/`.kb-bronze-label`/`.kb-bronze-score` (all raw-CSS `rgba(251,191,36,...)`/`#fbbf24` = `--mb-prestige`'s exact hex — literally the reserved rung, confirming this is intentional prestige styling, not a mapping target); `TournamentBracket.vue`'s third-place block (amber border/bg/text).
  6. **Error-state styling** (`CompetitionPage.vue`): `bg-red-900/20 border-red-500/30 text-red-300` — danger semantic, never emerald/cyan.
  7. **Neutral chrome that was never emerald/cyan**: bracket connector lines (`--kb-line: rgba(255,255,255,.16)`, structural, not brand chrome), "Pronto"/TBD/disabled states (slate), non-live tournament-card borders/backgrounds, pagination arrow buttons, table header labels (`text-slate-400`/`text-slate-500`).

- **Font weight**: every `.font-display` element combined with `font-extrabold`/`font-black` → `font-bold` (Space Grotesk ships only weights 600/700). This wave has exactly 4 instances, all in `CompetitionsHub.vue`/`CompetitionPage.vue` (Tasks 1 and 2 below) — `TournamentBracket.vue` and `KnockoutBracket.vue` use zero `.font-display` anywhere (confirmed by reading both files fully), so neither needs a font-weight task. Do not assume the rule applies file-wide by default; confirmed absent is confirmed absent.
- Do not touch `<script>`-block logic (data loading/polling, round navigation, bracket-classification algorithms, win/loss computation) anywhere in this wave — templates/styles only, same constraint as every prior wave.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse `blue-300/400/500` Tailwind classes for the established Data-zone mapping above — do not invent new tokens or introduce a second hue.

---

## Task 1: Migrate `CompetitionsHub.vue` to the Data design system

**Files:**
- Modify: `src/pages/leagues/CompetitionsHub.vue`

**Interfaces:** none (standalone routed page, no props/emits change). This is a genuinely light task — most of this file's emerald usage turned out to be the protected live-status system (Global Constraints rule 1), not decorative chrome; only 2 real changes.

- [ ] **Step 1: Header eyebrow label — font-weight-neutral recolor**

Find:
```html
        <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Explorá</span>
```
Replace with:
```html
        <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300/80">Explorá</span>
```

- [ ] **Step 2: Page headline — font-weight only**

Find:
```html
        <h1 class="mt-1 text-3xl sm:text-4xl font-display font-extrabold text-white">Competiciones</h1>
```
Replace with:
```html
        <h1 class="mt-1 text-3xl sm:text-4xl font-display font-bold text-white">Competiciones</h1>
```

Leave completely untouched, per Global Constraints: the entire featured-Mundial banner (amber, rule 5) including its "En vivo" badge (rule 1); every tournament-grid card's live/non-live styling (badge, ping-dot, hover border/bg, "Ver →" link — all rule 1, gated behind `c.status === 'live'`); the "Bracket"/"Pronto" chips (neutral); the footnote (neutral).

- [ ] **Step 3: Verify no leftover brand-color references**

```bash
rg -n 'emerald|cyan' src/pages/leagues/CompetitionsHub.vue
```
Expected: matches only inside the live-status system (featured banner's "En vivo" badge, the grid cards' live badge/hover/Ver→ classes gated by `c.status === 'live'`) — count and spot-check each one against Global Constraints rule 1 before treating any match as "expected"; none should be the header eyebrow (now `blue-300/80`).

```bash
rg 'font-extrabold' src/pages/leagues/CompetitionsHub.vue
```
Expected: zero matches (only one existed, on the headline, now fixed).

- [ ] **Step 4: Live verification**

With the dev server running, navigate to `/competiciones`. Confirm: the "Explorá" eyebrow label above the headline is now blue, not emerald. Confirm the featured Mundial banner is still amber/gold (unchanged), its "En vivo" badge still emerald with a pulsing dot (unchanged). Confirm tournament-grid cards for live competitions still show an emerald "Vivo" badge and emerald hover accent on interaction (unchanged); non-live cards show the neutral "Pronto" chip (unchanged). No console errors. Paste actual observations. If Playwright MCP is unavailable, fall back to `curl`/HTTP-200 on the route + the grep verification above as primary evidence.

- [ ] **Step 5: Commit**

```bash
git add src/pages/leagues/CompetitionsHub.vue
git commit -m "feat(data-zone): migrate CompetitionsHub.vue to Data accent"
```

---

## Task 2: Migrate `CompetitionPage.vue` to the Data design system

**Files:**
- Modify: `src/pages/leagues/CompetitionPage.vue`

**Interfaces:** none. This is the heaviest, most consequential file in the wave — it hosts the standings table, both new semantic categories (goal-difference, qualification bar), the live-match badge, the filled-CTA WCAG case, and 2 of this wave's 4 `.surface-flat` migrations.

- [ ] **Step 1: Header tagline color**

Find:
```html
              <p class="text-cyan-400 text-sm font-medium mb-0">{{ comp?.tagline || comp?.country || '' }}</p>
```
Replace with:
```html
              <p class="text-blue-400 text-sm font-medium mb-0">{{ comp?.tagline || comp?.country || '' }}</p>
```
Leave the pulse-dot immediately above (`bg-emerald-400 animate-pulse`) untouched — the live-status system, Global Constraints rule 1.

- [ ] **Step 2: Loading spinner**

Find:
```html
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
```
Replace with:
```html
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
```

- [ ] **Step 3: "Llaves"/"Tabla" tab buttons — active-state filled CTA + WCAG fix**

Find:
```html
        <button @click="view='bracket'" class="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
          :class="view==='bracket' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow' : 'text-slate-300 hover:text-white'">
          Llaves
        </button>
        <button @click="view='grupos'" class="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
          :class="view==='grupos' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow' : 'text-slate-300 hover:text-white'">
          Tabla
        </button>
```
Replace with:
```html
        <button @click="view='bracket'" class="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
          :class="view==='bracket' ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900 shadow' : 'text-slate-300 hover:text-white'">
          Llaves
        </button>
        <button @click="view='grupos'" class="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
          :class="view==='grupos' ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900 shadow' : 'text-slate-300 hover:text-white'">
          Tabla
        </button>
```
`text-white`→`text-slate-900` and the `blue-400`→`blue-500` (not `500`→`600`) range is this wave's established filled-CTA idiom (Global Constraints) — computed 7.03:1/4.855:1 contrast, both clear AA. Do not use `-500`→`-600`, it fails at both ends for this hue.

- [ ] **Step 4: Bracket-view wrapper — `.surface-flat` migration**

Find:
```html
      <div v-if="view==='bracket' && hasKnockout" class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800/40 to-slate-900 backdrop-blur shadow-2xl p-5">
```
Replace with:
```html
      <div v-if="view==='bracket' && hasKnockout" class="surface-flat p-5">
```
Per Global Constraints, this is one of the wave's 2 spec-sanctioned `.surface-flat` targets in this file (the bracket display surface). `backdrop-blur`/`shadow-2xl` are dropped entirely (`.surface-flat` is "sin sombra ni blur" by design) along with the redundant `rounded-2xl border border-white/10 bg-gradient-to-br ...` — `.surface-flat` supplies its own radius/border/background.

- [ ] **Step 5: Standings-table container — `.surface-flat` migration**

Find:
```html
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800/40 to-slate-900 backdrop-blur shadow-2xl overflow-hidden">
            <div class="flex items-center gap-3 border-b border-white/10 px-6 py-4">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
```
Replace with:
```html
          <div class="surface-flat overflow-hidden">
            <div class="flex items-center gap-3 border-b border-white/10 px-6 py-4">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-blue-300">
```
This is the wave's second `.surface-flat` target — the literal standings-table container, the spec's most-named use case ("tablas"). The icon-tile inside it (`border-emerald-400/25 bg-emerald-500/10 text-emerald-300`) is ordinary decorative chrome, recolors in the same step since it's part of this exact Find block.

Leave the 3 sidebar cards (Partidos/Fixture, Goleadores, Asistidores — each using the identical `rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800/40 to-slate-900 backdrop-blur shadow-2xl overflow-hidden` wrapper) completely untouched — they are match-list/leaderboard-style cards, not literally a table or bracket per the spec's named purpose, held to the same narrow-pattern discipline as every prior wave. This means `/leagues/:slug` will show 2 different card surface looks side by side (the standings table and bracket in `.surface-flat`, the 3 sidebar cards keeping the old hand-rolled gradient) — the same accepted trade-off every prior wave's surface-migration scope produced (Hub's `/profile`, Play zone's ordering-vs-MCQ games), not a defect.

- [ ] **Step 6: "PTS" column header accent (2 occurrences — multi-table and single-table variants)**

Find:
```html
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-emerald-300 uppercase w-12 font-bold">PTS</th>
```
Replace with:
```html
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-blue-300 uppercase w-12 font-bold">PTS</th>
```

Find:
```html
                      <th class="text-center py-3 px-2 text-xs font-semibold text-emerald-300 uppercase w-16 font-bold">PTS</th>
```
Replace with:
```html
                      <th class="text-center py-3 px-2 text-xs font-semibold text-blue-300 uppercase w-16 font-bold">PTS</th>
```
These are two separately-indented, near-identical lines (the multi-group-tables variant and the single-table variant) — apply to both independently, do not skip one thinking it's a duplicate of the other.

- [ ] **Step 7: Group-name label (multi-table variant only)**

Find:
```html
                  <span class="text-sm font-bold text-cyan-300">{{ group.name }}</span>
```
Replace with:
```html
                  <span class="text-sm font-bold text-blue-300">{{ group.name }}</span>
```

- [ ] **Step 8: Team-name hover accent (4 occurrences — standings×2, Goleadores×1, Asistidores×1)**

Find (appears twice, once in the multi-table `<tbody>` and once in the single-table `<tbody>` — apply to both independently):
```html
                            <span class="font-medium text-white text-sm truncate group-hover:text-cyan-300 transition-colors">{{ team.name }}</span>
```
Replace with:
```html
                            <span class="font-medium text-white text-sm truncate group-hover:text-blue-300 transition-colors">{{ team.name }}</span>
```

Find (single-table variant has a `max-w-[180px]` this second instance doesn't — these are two genuinely different lines, not duplicates):
```html
                          <span class="font-medium text-white text-sm truncate max-w-[180px] group-hover:text-cyan-300 transition-colors">{{ team.name }}</span>
```
Replace with:
```html
                          <span class="font-medium text-white text-sm truncate max-w-[180px] group-hover:text-blue-300 transition-colors">{{ team.name }}</span>
```

Find (Goleadores player-name row):
```html
                  <div class="font-semibold text-white text-sm truncate group-hover:text-cyan-300 transition-colors">{{ player.name }}</div>
```
Replace with:
```html
                  <div class="font-semibold text-white text-sm truncate group-hover:text-blue-300 transition-colors">{{ player.name }}</div>
```
This exact string appears twice (Goleadores and Asistidores) — apply to both independently.

Leave completely untouched on the same table rows: the goal-difference `text-green-400`/`text-red-400` ternary (Global Constraints rule 2) and the `qualColor` inline `:style` (rule 3).

- [ ] **Step 9: Fixture/Partidos icon-tile**

Find:
```html
                <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
```
Replace with:
```html
                <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-blue-300">
```

Leave the "VIVO" match-status badge below this (`text-emerald-400 bg-emerald-500/10 ... animate-pulse`) completely untouched — Global Constraints rule 1.

- [ ] **Step 10: Goleadores icon-tile**

Find:
```html
              <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
```
Replace with:
```html
              <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-blue-300">
```
This is a different icon-tile instance than Step 5's (different section, different icon SVG inside it) — do not conflate with Step 5's standings-table icon-tile, which is a separate line already handled.

- [ ] **Step 11: Goleadores goal-count number — font-weight + recolor**

Find:
```html
                <div class="font-display text-xl font-extrabold text-emerald-300 tabular-nums">{{ player.goals }}</div>
```
Replace with:
```html
                <div class="font-display text-xl font-bold text-blue-300 tabular-nums">{{ player.goals }}</div>
```
This is a decorative stat-emphasis number (the featured value in a leaderboard-style list), not a reward/XP number and not tied to any `.xp-float` convention — recolors along with its font-weight fix.

- [ ] **Step 12: Asistidores icon-tile**

Find:
```html
                <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
```
Replace with:
```html
                <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-blue-300">
```

- [ ] **Step 13: Asistidores assist-count number — font-weight + recolor**

Find:
```html
                <div class="font-display text-xl font-extrabold text-cyan-300 tabular-nums">{{ player.assists }}</div>
```
Replace with:
```html
                <div class="font-display text-xl font-bold text-blue-300 tabular-nums">{{ player.assists }}</div>
```

- [ ] **Step 14: Verify no leftover brand-color references, and confirm protected instances survived**

```bash
rg -n 'emerald|cyan' src/pages/leagues/CompetitionPage.vue
```
Expected: matches only at the protected live-status pulse-dot and "VIVO" badge (rule 1) — every other prior emerald/cyan instance in this file should be gone. Count them and confirm each is inside the live-status system before treating it as expected.

```bash
rg 'class="relative card|rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800/40 to-slate-900 backdrop-blur shadow-2xl overflow-hidden"' src/pages/leagues/CompetitionPage.vue
```
Expected: exactly 3 matches remaining (the 3 sidebar cards deliberately left out of `.surface-flat` scope — Partidos, Goleadores, Asistidores) — the bracket wrapper and standings-table container should NOT appear in this list anymore.

```bash
rg 'font-extrabold' src/pages/leagues/CompetitionPage.vue
```
Expected: zero matches (both prior instances — Goleadores/Asistidores stat numbers — now `font-bold`).

- [ ] **Step 15: Live verification**

With the dev server running, navigate to `/leagues/:slug` for any active competition. Confirm: header tagline and loading spinner (if visible) are blue. If the competition has a knockout phase, confirm the "Llaves"/"Tabla" tab buttons show a light-blue gradient with dark text when active (not white text), and the bracket area now sits on a flat, borderless-shadow `.surface-flat` background (compare visually against the still-gradient Partidos/Goleadores/Asistidores sidebar cards — they should now look visibly different, which is expected). Confirm the standings table (switch to "Tabla" view) also sits on `.surface-flat`, its "PTS" header and group-name labels are blue, team names show a blue hover accent, and the goal-difference (DG) column is still green/red depending on sign (unchanged). Confirm Goleadores/Asistidores icon tiles and stat numbers are blue. Confirm the live pulse-dot in the header and any "VIVO" match badges are still emerald (unchanged). No console errors. Paste actual observations.

- [ ] **Step 16: Commit**

```bash
git add src/pages/leagues/CompetitionPage.vue
git commit -m "feat(data-zone): migrate CompetitionPage.vue to Data accent + surface-flat"
```

---

## Task 3: Migrate `KnockoutBracket.vue` + `TournamentBracket.vue` to the Data design system

**Files:**
- Modify: `src/components/league/KnockoutBracket.vue`
- Modify: `src/components/league/TournamentBracket.vue`

**Interfaces:** none. Both are `CompetitionPage.vue`'s bracket renderers (one renders depending on which data shape the API returns — `leagueData?.playoff` vs. `leagueData?.allMatches`) — batched into one task since they're conceptually the same UI concern (bracket match cards) even though their color mechanisms differ (raw scoped CSS vs. Tailwind classes), matching the "batch small same-shape work" guidance for closely-related sibling components.

- [ ] **Step 1: `KnockoutBracket.vue` — `.kb-card` scoped CSS → `.surface-flat`, remove competing declarations**

Find (in the `<style scoped>` block):
```css
.kb-card {
  position: relative;
  width: 100%;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.75);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}
```
Replace with:
```css
.kb-card {
  position: relative;
  width: 100%;
  border-radius: 9px;
  overflow: hidden;
}
```
The `border`/`background`/`box-shadow` declarations are DELETED, not just left alone — because `.kb-card[data-v-xxx]`'s scoped-attribute selector has higher specificity (0,2,0) than the plain global `.surface-flat` class (0,1,0), simply adding `surface-flat` to the template's class list would NOT be enough to make it visually apply; these competing declarations must be removed from the source so `.surface-flat`'s own border/background win with nothing to fight. `border-radius: 9px` is intentionally KEPT (not part of the collision, and deliberately tighter than `.surface-flat`'s default `--mb-radius-md` for this small card context — this is a deliberate choice, not an oversight).

- [ ] **Step 2: `KnockoutBracket.vue` — add `surface-flat` to `.kb-card`'s class list (3 occurrences: left-column cards, final card, right-column cards)**

Find:
```html
            <div class="kb-card" :class="{ 'kb-tbd': m.tbd }">
```
Replace with (apply to BOTH occurrences of this exact line — left-column at one location, right-column at another; they are separate template blocks with identical markup, not one shared element):
```html
            <div class="kb-card surface-flat" :class="{ 'kb-tbd': m.tbd }">
```

Find (the final-match card, a separate, differently-indented instance):
```html
        <div v-if="final" class="kb-card kb-final" :class="{ 'kb-tbd': final.tbd }">
```
Replace with:
```html
        <div v-if="final" class="kb-card kb-final surface-flat" :class="{ 'kb-tbd': final.tbd }">
```
Leave the fallback "Por definir" card (`class="kb-card kb-final kb-tbd"`, no `:class` binding) — it's a separate, always-`kb-tbd` variant of the final slot — also apply `surface-flat` to it for visual consistency with its sibling:

Find:
```html
        <div v-else class="kb-card kb-final kb-tbd">
```
Replace with:
```html
        <div v-else class="kb-card kb-final kb-tbd surface-flat">
```

- [ ] **Step 3: `KnockoutBracket.vue` — verify `.kb-final`'s own border/shadow don't reintroduce the collision**

The `.kb-final` scoped rule (separate from `.kb-card`, applies IN ADDITION to it) sets `border-color: rgba(251, 191, 36, 0.4); box-shadow: 0 0 24px rgba(251, 191, 36, 0.18);` — this is the pre-existing amber "this is the final" prestige treatment (Global Constraints rule 5), and it legitimately needs to keep drawing a border/glow on top of `.surface-flat`. Because `.kb-final[data-v-xxx]` is a DIFFERENT class from `.kb-card`/`.surface-flat` with its own specificity, and Vue applies scoped rules in source order with the later one winning on ties, this amber border/glow already correctly overrides `.surface-flat`'s plain border for the final card specifically (which is the desired outcome — the final SHOULD look distinct/prestigious) — **do not modify `.kb-final`'s rule, it already composes correctly with the Step 1/2 changes above.** This step is verification-only, no code change: after Steps 1-2, visually confirm the final-match card still shows its amber glow/border (not a plain blue-tinted one) — if it doesn't, that's a real regression to report, not something to "fix" by touching `.kb-final`.

- [ ] **Step 4: `TournamentBracket.vue` — round-header accent bar (2-hue → monochrome)**

Find:
```html
            <span class="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-400"></span>
```
Replace with:
```html
            <span class="h-4 w-1 rounded-full bg-gradient-to-b from-blue-400 to-blue-500"></span>
```

- [ ] **Step 5: `TournamentBracket.vue` — match-card container → `.surface-flat`, hover accent**

Find:
```html
              class="tb-match relative rounded-xl border border-white/10 bg-slate-900/70 p-2.5 shadow-lg transition hover:border-emerald-400/30"
```
Replace with:
```html
              class="tb-match relative surface-flat p-2.5 transition hover:border-blue-400/30"
```
`shadow-lg` is dropped (`.surface-flat` collision-avoidance) along with the redundant `rounded-xl border border-white/10 bg-slate-900/70`. The `hover:border-emerald-400/30` interactive accent recolors to `hover:border-blue-400/30` — this is a Tailwind utility class stacked on top of `.surface-flat`; confirm during live verification that the hover state is actually visible and not silently beaten by `.surface-flat`'s own unlayered border declaration (this file's card is a plain Tailwind-class element, not a scoped-CSS one like `KnockoutBracket.vue`, so the mechanism is closer to the original `.surface-solid` cascade-layer collision class of bug from Hub Wave 1 than to this task's Step 1 specificity issue — both produce the same "silently inert" symptom via different mechanisms, verify empirically rather than assuming either is fine).

Leave completely untouched, same file: the winner-highlight ternaries (`text-emerald-300`, both team-score spans, rule 4), the "En vivo" match badge (rule 1), the third-place block (amber, rule 5).

- [ ] **Step 6: Verify no leftover brand-color references, and confirm hover accent actually renders**

```bash
rg -n 'emerald|cyan' src/components/league/KnockoutBracket.vue
```
Expected: zero Tailwind-class matches (this file never used any — confirmed at plan-writing time) — any hit here is a NEW regression, not expected. The pre-existing raw-CSS `#34d399` (win-score color) and `rgba(251,191,36,...)`/`#fbbf24` (prestige/final/bronze) hex values are NOT matched by this `emerald|cyan` word-pattern grep (they're numeric), so their absence from this grep's output does not mean they were removed — separately confirm by reading the file that `.kb-win .kb-score { color: #34d399; }`, `.kb-final-label`, `.kb-final`'s border/shadow, and `.kb-bronze*` rules are all still present, byte-identical to before this task.

```bash
rg -n 'emerald|cyan' src/components/league/TournamentBracket.vue
```
Expected: exactly 4 matching lines remaining — the "En vivo" badge (3 classes on one line) and the 2 `text-emerald-300` winner-highlight spans — all protected per rules 1 and 4.

```bash
rg 'class="kb-card"' src/components/league/KnockoutBracket.vue
```
Expected: zero matches — both left/right-column instances should now read `class="kb-card surface-flat"`.

- [ ] **Step 7: Live verification**

With the dev server running, navigate to `/leagues/:slug` for a competition with an active knockout phase (or force `view.value = 'bracket'` via Vue devtools if none is currently in a knockout stage) — this may render either `KnockoutBracket` or `TournamentBracket` depending on the data shape, try to find a competition that exercises each if possible; if only one is reachable live, say so honestly and rely on diff/grep/read verification for the other. For `KnockoutBracket`: confirm match-slot cards now sit on a flat, blue-tinted-border `.surface-flat` background (compare against a plain `border-white/10` neutral element to spot the blue tint at 22% opacity — subtle by design), the win-score color is still emerald on winning rows (unchanged), and the Final card + bronze-medal block still show their amber prestige treatment (unchanged, not overridden by the new `.surface-flat` on `.kb-card`). For `TournamentBracket`: confirm the round-header accent bar is a blue gradient (not green→cyan), match cards sit on `.surface-flat`, hovering a match card shows a visible blue border highlight (not silently inert), and winner-highlighted scores/live-match badges are still emerald (unchanged). No console errors. Paste actual observations, or an honest account of what you verified via diff/read instead if live reach was limited.

- [ ] **Step 8: Run build**

```bash
npm run build
```
Expected: clean build, no new errors — this is the plan's last task, so it doubles as the whole-branch build check.

- [ ] **Step 9: Commit**

```bash
git add src/components/league/KnockoutBracket.vue src/components/league/TournamentBracket.vue
git commit -m "feat(data-zone): migrate KnockoutBracket.vue + TournamentBracket.vue to Data accent + surface-flat"
```

---

## Self-Review Notes

- **Spec coverage:** all 4 named files covered — Task 1 (`CompetitionsHub.vue`, light — 2 changes), Task 2 (`CompetitionPage.vue`, heaviest — 16 changes including both semantic categories, the filled-CTA WCAG case, and 2 of 4 `.surface-flat` targets), Task 3 (`KnockoutBracket.vue` + `TournamentBracket.vue`, batched — the remaining 2 `.surface-flat` targets plus `TournamentBracket.vue`'s own recolor work). This wave establishes the Data-zone color vocabulary, the filled-CTA idiom, and the `.surface-flat` scope ruling for the FIRST time — all three are stated once here with full reasoning for Data Waves 2-3 to reuse without re-deriving.
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code, including the raw scoped-CSS deletion in Task 3 Step 1 (not just Tailwind class strings) and the explicit near-duplicate-line warnings in Task 2 Steps 6/8 (two genuinely different lines that look alike, both need their own edit).
- **Type/signature consistency:** no props, emits, or component interfaces change anywhere in this plan — template/style-only. Tasks 1-2 touch fully disjoint files from Task 3; within Task 3, both files are independently rendered siblings (`CompetitionPage.vue` renders one or the other based on data shape) with no shared interface.
- **The wave's foundational decisions, stated once here rather than re-derived per task:** (1) the Data-zone hex→Tailwind mapping (`blue-300/400/500`, no reserved-rung collision, unlike Play's `amber-400`); (2) the `from-blue-400 to-blue-500` + `text-slate-900` filled-CTA idiom, chosen specifically because the more saturated `-500`→`-600` range fails WCAG AA at one end regardless of text color (computed, not assumed); (3) the `.surface-flat` scope ruling — table/bracket containers only, 4 named targets across the whole wave, holding the same narrow-pattern discipline as every prior wave's surface work while still giving the spec's "tablas y brackets" wording a real, first application.
- **A genuinely new collision mechanism found this wave**: `KnockoutBracket.vue`'s scoped-CSS specificity beating `.surface-flat` is NOT the same bug class as Hub Wave 1's original `.surface-solid`-vs-Tailwind-utility collision (that was about unlayered CSS beating `@layer utilities` regardless of specificity) — this one is about a scoped selector's OWN higher specificity beating an unscoped global class, a distinct mechanism producing the same "silently inert" symptom. Task 3 Step 1 documents this distinction explicitly so a reviewer doesn't conflate the two "reasons" and check for the wrong root cause.
- **Semantic-color judgment calls, stated once here rather than repeated per task:** the live-match/competition indicator system (rule 1) is this wave's most consequential exclusion — spanning 3 files, deliberately treated as ONE system even where individual pieces (e.g. a hover-accent) would look decorative in isolation, because fragmenting it would produce a visually broken half-recolored state on a single semantic concept. The goal-difference sign indicator (rule 2) and qualification-color bar (rule 3) are both genuinely NEW categories for this initiative (real sports-data semantics, not gamified-UI ones) but resolve via the SAME reasoning patterns already established (different-color-name double-protection; data-bound-inline-style-is-automatically-out-of-scope).
