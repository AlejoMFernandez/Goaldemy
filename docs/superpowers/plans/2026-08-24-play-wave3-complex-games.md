# Play Wave 3 — Complex Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Play zone's design system (monochrome gold, `.surface-solid` where sanctioned, Space Grotesk weight ceiling) to the 6 "complex" games: `OnceIdeal.vue`, `FootballWordle.vue`, `HigherOrLower.vue`, `Connections.vue`, `FootballGrid.vue`, `StatChallenge.vue` — continuing the rollout Play Waves 1-2 started on the shared infra and the 8 simple games.

**Architecture:** No new shared component. Pure recolor + font-weight fixes across 6 files, each read fresh and reasoned about individually — these games are structurally less uniform than Play Wave 2's 8 simple games (only 3 of the 6 share the identical loading-spinner/score-badge boilerplate pattern; the rest is bespoke per-game UI). One file (`StatChallenge.vue`) gets a literal `.card`→`.surface-solid` surface migration. Two files (`FootballWordle.vue`, `HigherOrLower.vue`) have raw scoped-CSS font-weight fixes, continuing the mechanism Play Wave 1 discovered in `GameShell.vue`. `OnceIdeal.vue` is the only game in the whole Zona Juego rollout that does NOT render inside `GameShell.vue` — it's a fully standalone page with its own `AppH1`-less custom header; this is confirmed by reading the file, not an oversight.

**Tech Stack:** Vue 3 (Options API in 5 of 6 files, `<script setup>` in `OnceIdeal.vue`), Tailwind CSS v4. Foundation + all 3 Hub waves + Play Waves 1-2 already merged to `main`. No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- **Color mapping — the monochrome-gold rung ladder** (established Play Wave 1, reused here): `emerald-400`→`amber-300`, `emerald-500`→`amber-500`, `emerald-600`(if found)→`amber-600`. **New this wave** (no cyan instance existed in Play Waves 1-2, so this rung wasn't needed until now): `cyan-300`/`cyan-400`→`amber-300` (same rung as `emerald-400` — both were the "lighter" hue in a two-hue pairing), `cyan-500`→`amber-500`. **Never use `amber-400`** anywhere — it's the rung reserved for `--mb-prestige`/`--accent-gold` (a semantic reservation, not a hex-identity claim — see the corrected wording in Play Wave 1/2's plans and `visual-redesign-progress` memory). This rule bit Play Wave 1 once already on a `cyan-400`→`amber-400` mechanical slip; watch for the same trap here on every `cyan-400`/`emerald-400` instance — the correct rung is always `amber-300`.
- **Multi-stop mixed gradients**: where an old gradient combined two DIFFERENT hues (e.g. `from-indigo-300 to-cyan-300`), do not collapse it to one flat repeated rung (that produces a dead, non-gradient fill) — spread it across two different amber rungs preserving the original light→dark order (e.g. `from-amber-300 to-amber-500`), matching Play Wave 1's precedent 3-stop pattern (`from-amber-300 via-amber-500 to-amber-600`).
- **Filled/solid gold CTAs need `text-slate-900` for WCAG AA**, not `text-white` — established Play Wave 1 fix, required on every filled `bg-amber-500`/`bg-gradient-to-r from-amber-500 to-amber-600`-style button this wave introduces.
- **Font weight**: every `.font-display` element combined with `font-extrabold`/`font-black` → `font-bold`, AND the raw-CSS equivalent (`font-weight: 800` inside a `<style scoped>` block) → `font-weight: 700`. Swept across the WHOLE of each file touched, not just named instances — this exact gap caused a real blocking bug in Hub Wave 2. `font-extrabold` NOT paired with `.font-display` (e.g. a plain neutral-colored badge using the app's default Inter font) stays untouched — confirmed one such instance in `HigherOrLower.vue`'s "VS" badge, explicitly left alone below.
- **Surface migration**: only the 2 sanctioned patterns (literal `class="card ..."` → `class="surface-solid ..."`; the exact `bg-slate-900/60-70 + backdrop-blur-md` pattern). This wave has exactly ONE instance, in `StatChallenge.vue`. No other file in this wave's scope has either pattern — confirmed by reading all 6 files fully (several use `bg-slate-800/50`, `bg-gradient-to-b from-slate-800/70 to-slate-900/85`, `bg-slate-900/95`, `bg-slate-900/97` — none match the sanctioned pattern's exact shade/blur combination, correctly excluded per Play Wave 1's controller ruling against inventing a 3rd pattern).

- **What must NOT be recolored, left exactly as-is (longer and more consequential than the mapping in this wave — several NEW semantic categories appear for the first time):**
  1. **Correct/incorrect answer-feedback colors** — the same cross-zone `--mb-success`/`--mb-danger` constant established since Hub Wave 1's `GameCard.vue` and reused in every game since. Applies here to: `FootballGrid.vue`'s `cellClass()` (filled-correctly / failed / flash-wrong), `StatChallenge.vue`'s `optionClass()` (note: uses plain `green-500`/`red-500`, NOT `emerald`/`red` — same "different color name" pattern as Play Wave 2's `ShirtNumber.vue`, doubly out of scope), `Connections.vue`'s game-over win/loss message and mistakes-remaining dots (rose, never emerald to begin with), `HigherOrLower.vue`'s game-over "cadena completada"/"cadena rota" banner, `FootballGrid.vue`'s finished-banner completion color.
  2. **`FootballWordle.vue`'s Wordle-style 3-way attribute-match feedback** — a NEW variant of the correct/incorrect category, first seen this wave: `cellColor()` returns green(exact)/yellow(close)/gray(far) for each guessed attribute, and the matching legend (`Exacto`=emerald, `Cerca`=yellow, `Lejos`=slate) — this is the core game-feedback mechanic, stays exactly as-is. The `.reveal-chip.on` raw-CSS state (an attribute "unlocks" visually once guessed exactly right) is the same semantic family — an attribute is only marked "revealed" when its `cellColor` hit green, so the chip's emerald border/background is celebrating the SAME correct-match event, not decorative chrome. Stays untouched.
  3. **`StatChallenge.vue`'s 3 stat-category boxes** (Goles=emerald, Asistencias=sky, Apariciones=amber) — a NEW category discovered this wave: a **coordinated multi-color categorical differentiation system**, the same kind of thing as `Connections.vue`'s `GROUP_COLORS` array or Hub Wave 2's `TIER_TINT` map — three colors chosen specifically to look visually distinct from each other so a player can tell the three stats apart at a glance. Recoloring only the "Goles" box (the one that happens to be literally `emerald`) to gold would make it nearly indistinguishable from the already-amber "Apariciones" box, destroying the 3-way visual distinction the UI depends on — worse than leaving it alone. Ruling: leave all 3 boxes exactly as they are, as a set, the same way Hub Wave 2 left `TIER_TINT`'s `emerald`/`cyan`-named keys untouched regardless of their literal color.
  4. **`Connections.vue`'s `GROUP_COLORS` array** (`yellow`/`emerald`/`sky`/`violet`, assigned in order to each of the 4 solved groups) — same categorical-differentiation reasoning as #3. It's also a plain JS array in the `<script>` block, doubly out of scope (this wave is templates/styles only). Stays untouched.
  5. **`HigherOrLower.vue`'s "Mayor"/"Menor" (Higher/Lower) buttons** (`border-emerald-500/30 bg-emerald-500/10 text-emerald-300` / `border-red-500/30 bg-red-500/10 text-red-300`) — a NEW semantic category discovered this wave: a **directional-comparison convention** (green=higher/more, red=lower/less), the same universal convention as a stock-ticker up/down indicator, independent of app branding. These are the two ACTION buttons themselves (not a correctness result — the player hasn't guessed yet when they're shown), colored to visually communicate "this button means more" vs "this button means less." Recoloring only "Mayor" to gold would leave a mismatched gold/red pair that no longer reads as a coherent binary choice. Ruling: leave both exactly as-is.
  6. **Reward/XP-earned number text** — mixed ruling this wave, read carefully: `GameSummaryPopup.vue`-driven games (all 5 games that use `GameShell.vue`) already show XP via the shared popup, already fixed in Play Wave 1, not touched again here. `OnceIdeal.vue` is the one exception — it doesn't use `GameSummaryPopup` at all (it's a standalone page with its own inline "+XP ganados" text), and that inline text has ALWAYS been `text-cyan-400`, never `text-emerald-400` — it never participated in the app-wide `.xp-float`/`GameSummaryPopup` emerald convention this rule normally protects. Since it's genuinely decorative cyan chrome local to this one file, not a shared reward-color convention, it follows the normal cyan→gold mapping in `OnceIdeal.vue`'s task below. This is flagged explicitly because it looks similar to the protected pattern at a glance — verify the reasoning holds (search for any other `xp-float`/`GameSummaryPopup` usage in `OnceIdeal.vue` — there is none) before assuming it should stay.
  7. **`OnceIdeal.vue`'s football-pitch field background** (`linear-gradient(180deg, #064e3b 0%, #065f46 40%, #064e3b 100%)` plus a repeating-linear-gradient grass-texture overlay) — a NEW semantic category: this green represents a real football field/grass, not brand chrome. Stays untouched regardless of zone.
  8. **`HigherOrLower.vue`'s right-card stat color** (`revealed ? 'text-amber-400' : 'text-slate-600'`) — pre-existing amber, not introduced by this wave, stays untouched per the established "pre-existing amber gets zero shade-normalization" rule.
  9. **Any pre-existing amber/yellow not named in a task below** (hint text, "Tiempo agotado" banners, "Casi!" almost-toast in `Connections.vue`, StreakBadge's own internal styling) — same established rule, zero shade-normalization.
  10. **Excluded shared components** — `GamePreviewModal.vue`, `CircularTimer.vue`, `StreakBadge.vue`, `GameShell.vue`, `GameSummaryPopup.vue` are all either already migrated (the last two, Play Wave 1) or explicitly deferred cross-cutting primitives (the first three, per Play Wave 2's Scope note — still shared with other not-yet-migrated surfaces like `/rewards`). None are touched by this wave, even though they're imported/rendered by every file here.
  11. **`HigherOrLower.vue`'s "VS" badge** (`font-extrabold text-slate-400`, no `.font-display` class) — not paired with `.font-display`, out of the font-weight rule's scope, stays exactly as-is.

- Do not touch `<script>`-block logic (RNG, XP/scoring calculations, session/challenge state machines, grid/board generation algorithms) anywhere in this wave — templates/styles only, same constraint as every prior wave.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse `--play-400/500/600` via the `amber-300`/`amber-500`/`amber-600` Tailwind classes — do not invent new Play-zone tokens or introduce a second hue.

---

## Task 1: Migrate `OnceIdeal.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/OnceIdeal.vue`

**Interfaces:** none (standalone routed page, no props/emits change). This is the only game in this wave (and in the whole Zona Juego rollout so far) that does not render inside `GameShell.vue` — it has its own custom header layout.

- [ ] **Step 1: Filled-count text**

Find:
```html
        <div class="text-2xl font-bold text-cyan-400">{{ filledCount }}<span class="text-slate-500 text-base">/11</span></div>
```
Replace with:
```html
        <div class="text-2xl font-bold text-amber-300">{{ filledCount }}<span class="text-slate-500 text-base">/11</span></div>
```

- [ ] **Step 2: Filled-slot avatar ring**

Find:
```html
          <div class="w-10 h-10 rounded-full overflow-hidden ring-2 ring-cyan-400/70 shadow-lg shadow-black/60">
```
Replace with:
```html
          <div class="w-10 h-10 rounded-full overflow-hidden ring-2 ring-amber-300/70 shadow-lg shadow-black/60">
```

- [ ] **Step 3: Active empty-slot state**

Find:
```html
        <div v-else class="flex items-center justify-center rounded-lg border font-bold text-[11px] tracking-wide select-none transition-all"
             :class="activeSlot === slot.id
               ? 'w-14 h-9 bg-cyan-500/30 border-cyan-400 text-cyan-200 scale-110 shadow-lg shadow-cyan-500/30'
               : 'w-12 h-8 bg-slate-900/55 border-white/20 text-slate-300 hover:border-white/50 hover:bg-slate-800/60 hover:scale-105'">
```
Replace with:
```html
        <div v-else class="flex items-center justify-center rounded-lg border font-bold text-[11px] tracking-wide select-none transition-all"
             :class="activeSlot === slot.id
               ? 'w-14 h-9 bg-amber-500/30 border-amber-300 text-amber-200 scale-110 shadow-lg shadow-amber-500/30'
               : 'w-12 h-8 bg-slate-900/55 border-white/20 text-slate-300 hover:border-white/50 hover:bg-slate-800/60 hover:scale-105'">
```
Note: `border-cyan-400` maps to `border-amber-300` here, NOT `border-amber-400` — the correct rung, matching the `cyan-400`→`amber-300` mapping (never introduce `amber-400`, it collides with the reserved prestige rung).

- [ ] **Step 4: Guess-input focus ring**

Find:
```html
            class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
```
Replace with:
```html
            class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
```

- [ ] **Step 5: Active-slot label accent**

Find:
```html
          <span class="text-cyan-400 font-bold">{{ slots[activeSlot]?.label }}</span>
```
Replace with:
```html
          <span class="text-amber-300 font-bold">{{ slots[activeSlot]?.label }}</span>
```

- [ ] **Step 6: Time-over block — XP text + "Intentar de nuevo" button**

Find:
```html
      <p v-if="xpEarned > 0" class="text-slate-400 text-sm mb-4">+<span class="text-cyan-400 font-bold">{{ xpEarned }} XP</span> ganados</p>
      <button @click="resetGame" class="rounded-xl bg-emerald-500 hover:brightness-110 px-5 py-2.5 font-semibold text-white transition">
        Intentar de nuevo
      </button>
```
Replace with:
```html
      <p v-if="xpEarned > 0" class="text-slate-400 text-sm mb-4">+<span class="text-amber-300 font-bold">{{ xpEarned }} XP</span> ganados</p>
      <button @click="resetGame" class="rounded-xl bg-amber-500 hover:brightness-110 px-5 py-2.5 font-semibold text-slate-900 transition">
        Intentar de nuevo
      </button>
```
`text-white`→`text-slate-900` is the WCAG AA fix for the now-filled gold background. Leave the "Tiempo agotado" heading/icon and their amber styling above this block completely untouched (pre-existing amber).

- [ ] **Step 7: Finished block — border/bg, title, XP text, "Nuevo desafío" button**

Find:
```html
    <div v-if="finished" class="mt-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-6 text-center">
      <div class="text-5xl mb-3">🏆</div>
      <h2 class="text-2xl font-bold text-emerald-400 mb-1">¡Once Ideal Completo!</h2>
      <p class="text-slate-300 mb-2">
        Armaste el once de
        <span class="font-bold text-white">{{ constraint?.label }}</span>
      </p>
      <p class="text-slate-400 text-sm mb-5">
        +<span class="text-cyan-400 font-bold">{{ xpEarned }} XP</span> ganados
      </p>
      <div class="flex gap-3 justify-center flex-wrap">
        <button @click="resetGame"
                class="rounded-xl bg-emerald-500 hover:brightness-110 px-5 py-2.5 font-semibold text-white transition">
          Nuevo desafío
        </button>
```
Replace with:
```html
    <div v-if="finished" class="mt-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/10 p-6 text-center">
      <div class="text-5xl mb-3">🏆</div>
      <h2 class="text-2xl font-bold text-amber-300 mb-1">¡Once Ideal Completo!</h2>
      <p class="text-slate-300 mb-2">
        Armaste el once de
        <span class="font-bold text-white">{{ constraint?.label }}</span>
      </p>
      <p class="text-slate-400 text-sm mb-5">
        +<span class="text-amber-300 font-bold">{{ xpEarned }} XP</span> ganados
      </p>
      <div class="flex gap-3 justify-center flex-wrap">
        <button @click="resetGame"
                class="rounded-xl bg-amber-500 hover:brightness-110 px-5 py-2.5 font-semibold text-slate-900 transition">
          Nuevo desafío
        </button>
```
This block renders unconditionally whenever `finished` is true, regardless of the win/loss `result` passed to `finishGame()` — there is no separate loss-styled variant anywhere in this template (unlike `GameSummaryPopup.vue`'s explicit `won ? emerald : red`). Since there's no red counterpart to preserve a semantic binary against, this reads as decorative "round over" celebration chrome rather than a true conditional win indicator — treat it as decorative and recolor, consistent with the CTA button in the same block.

Leave completely untouched: the football-pitch field background (`linear-gradient(180deg, #064e3b...)` + repeating-linear-gradient texture — represents real grass, not brand chrome), the "Tiempo agotado" banner and its amber icon/text, the `router-link` "Volver" (neutral border), the `router-link` "Volver a juegos" inside the finished block (neutral border), "Cambiar desafío" text button (slate, neutral). This file has no `.font-display`/`font-extrabold` usage anywhere — no font-weight changes needed.

- [ ] **Step 8: Verify no leftover brand-color references**

```bash
rg 'cyan-|emerald-' src/pages/games/OnceIdeal.vue
```
Expected: zero matches. (Everything in this file that was cyan or emerald was either changed above or doesn't exist — the field background uses literal hex, not Tailwind classes.)

- [ ] **Step 9: Live verification**

With the dev server running, navigate to `/games/once-ideal`. Confirm: the field background is still the green football pitch (unchanged), the "X/11" filled counter and slot-selection highlight are gold, the guess input's focus ring is gold. Fill all 11 slots (or force `finished=true` via Vue devtools if faster) — confirm the "¡Once Ideal Completo!" card is now gold-themed with dark text on the button. If reachable, trigger the time-over state and confirm it's still amber, unchanged. No console errors. Paste actual observations. If Playwright MCP is unavailable, fall back to `curl`/HTTP-200 + the grep verification above as primary evidence.

- [ ] **Step 10: Commit**

```bash
git add src/pages/games/OnceIdeal.vue
git commit -m "feat(play-zone): migrate OnceIdeal.vue to Play accent"
```

---

## Task 2: Migrate `FootballWordle.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/FootballWordle.vue`

**Interfaces:** none.

- [ ] **Step 1: Loading spinner**

Find:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>
```
Replace with:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando...</p>
      </div>
```

- [ ] **Step 2: `#stat` slot — attempts badge font-weight**

Find:
```html
        <span class="font-display text-white font-extrabold text-base leading-none">{{ guesses.length }}/{{ maxGuesses }}</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none">{{ guesses.length }}/{{ maxGuesses }}</span>
```

- [ ] **Step 3: Radial background glow**

Find:
```html
          <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%);"></div>
```
Replace with:
```html
          <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(245,158,11,0.4), transparent 70%);"></div>
```

- [ ] **Step 4: "Intentos restantes" pip indicators**

Find:
```html
              <span v-for="n in maxGuesses" :key="n" class="w-1.5 h-1.5 rounded-full transition-colors" :class="n <= remainingGuesses ? 'bg-emerald-400' : 'bg-white/15'"></span>
```
Replace with:
```html
              <span v-for="n in maxGuesses" :key="n" class="w-1.5 h-1.5 rounded-full transition-colors" :class="n <= remainingGuesses ? 'bg-amber-300' : 'bg-white/15'"></span>
```
This is a "guesses remaining" capacity meter, not part of the Wordle-style attribute-match feedback system (that's `cellColor()`, a separate function — see Global Constraints, left untouched). Decorative, recolors.

- [ ] **Step 5: Correct-guess name reveal — font-weight only**

Find:
```html
            <div v-if="gameOver" class="text-center">
              <p :class="won ? 'text-emerald-400' : 'text-white'" class="font-display font-extrabold text-lg leading-tight">{{ target.name }}</p>
```
Replace with:
```html
            <div v-if="gameOver" class="text-center">
              <p :class="won ? 'text-emerald-400' : 'text-white'" class="font-display font-bold text-lg leading-tight">{{ target.name }}</p>
```
Only the weight changes — the `won ? 'text-emerald-400' : 'text-white'` conditional color is a protected win-state semantic, leave it exactly as-is.

- [ ] **Step 6: Guess-input focus ring**

Find:
```html
                class="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
```
Replace with:
```html
                class="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300/30"
```

- [ ] **Step 7: "Adivinar" submit button**

Find:
```html
              <button type="submit" :disabled="(guess?.length || 0) < 3"
                      class="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white px-6 py-2 text-sm font-bold disabled:opacity-40 transition shadow-lg shadow-emerald-500/20">
                Adivinar
              </button>
```
Replace with:
```html
              <button type="submit" :disabled="(guess?.length || 0) < 3"
                      class="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-900 px-6 py-2 text-sm font-bold disabled:opacity-40 transition shadow-lg shadow-amber-500/25">
                Adivinar
              </button>
```
`text-white`→`text-slate-900` is the WCAG AA fix for the filled gold background.

- [ ] **Step 8: Raw scoped CSS — `.chip-pos` font-weight**

Find:
```css
.chip-pos {
  font-family: var(--font-display, inherit);
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}
```
Replace with:
```css
.chip-pos {
  font-family: var(--font-display, inherit);
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
```

Leave completely untouched: `cellColor()`'s green/yellow/gray attribute-match feedback, the "Exacto/Cerca/Lejos" legend, `.reveal-chip.on`'s `rgba(16, 185, 129, ...)` raw CSS (attribute-revealed-correctly state, tied 1:1 to the same green-match event as the feedback grid), `.reveal-img`/`revealPop`/`chipPop`/`cellReveal` keyframe animations (no color, transforms only).

- [ ] **Step 9: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400|rgba\(16,185,129|from-emerald-500 to-cyan-500|focus:ring-emerald-400|font-weight: 800' src/pages/games/FootballWordle.vue
```
Expected: zero matches for all five patterns.

```bash
rg -n 'emerald' src/pages/games/FootballWordle.vue
```
Expected: exactly 4 matching lines remaining — the name-reveal ternary (`won ? 'text-emerald-400'`), the "Exacto" legend swatch, `cellColor()`'s green-match return value, and `.reveal-chip.on`'s rgba border/background — all protected feedback semantics.

- [ ] **Step 10: Live verification**

With the dev server running, navigate to `/games/football-wordle`. Confirm: loading spinner, attempts badge weight, background glow, and the remaining-guesses pips are gold. Confirm the input focus ring and "Adivinar" button are gold (dark text on the button). Make a guess and confirm the attribute-match grid still shows green/yellow/gray feedback (unchanged), and any revealed chip still shows a green "on" state. No console errors. Paste actual observations.

- [ ] **Step 11: Commit**

```bash
git add src/pages/games/FootballWordle.vue
git commit -m "feat(play-zone): migrate FootballWordle.vue to Play accent"
```

---

## Task 3: Migrate `HigherOrLower.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/HigherOrLower.vue`

**Interfaces:** none.

- [ ] **Step 1: Loading spinner**

Find:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>
```
Replace with:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando...</p>
      </div>
```

- [ ] **Step 2: `#stat` slot — chain badge font-weight**

Find:
```html
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ chain }}/{{ target }}</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none whitespace-nowrap">{{ chain }}/{{ target }}</span>
```
(This span is followed by `<StreakBadge :streak="chain" />` on the next line — do not touch that, it's an excluded shared component.)

- [ ] **Step 3: Category label — gradient + font-weight**

Find:
```html
          <h2 v-if="currentCategory" class="font-display text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
```
Replace with:
```html
          <h2 v-if="currentCategory" class="font-display text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
```
The old gradient mixed two different hues (indigo+cyan) — the replacement uses two different amber rungs (light→medium) to preserve a visible gradient rather than collapsing to one flat color, per the Global Constraints' multi-stop rule.

- [ ] **Step 4: Left-card stat color**

Find:
```html
              <div class="hl-stat text-emerald-400">{{ leftStatDisplay() }}</div>
```
Replace with:
```html
              <div class="hl-stat text-amber-300">{{ leftStatDisplay() }}</div>
```
Leave the right-card stat (`revealed ? 'text-amber-400' : 'text-slate-600'`, a few lines below) completely untouched — pre-existing amber, not introduced by this wave.

- [ ] **Step 5: Raw scoped CSS — `.hl-stat` font-weight**

Find:
```css
.hl-stat {
  font-family: var(--font-display, inherit);
  font-weight: 800;
  font-size: 1.9rem;
  line-height: 1;
  margin-top: 2px;
}
```
Replace with:
```css
.hl-stat {
  font-family: var(--font-display, inherit);
  font-weight: 700;
  font-size: 1.9rem;
  line-height: 1;
  margin-top: 2px;
}
```

Leave completely untouched: the "Mayor"/"Menor" buttons (`border-emerald-500/30 bg-emerald-500/10 text-emerald-300` / `border-red-500/30 bg-red-500/10 text-red-300` — directional-comparison convention, see Global Constraints rule 5), the game-over banner (`chain >= target ? emerald : red` — win/loss semantic), the "VS" badge (`font-extrabold text-slate-400`, not `.font-display`-paired), `StreakBadge` usage.

- [ ] **Step 6: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400|from-indigo-300 to-cyan-300|hl-stat text-emerald-400|font-weight: 800' src/pages/games/HigherOrLower.vue
```
Expected: zero matches for all four patterns.

```bash
rg -n 'emerald' src/pages/games/HigherOrLower.vue
```
Expected: exactly 2 matching lines remaining — the "Mayor" button's `border-emerald-500/30 bg-emerald-500/10` line and the game-over banner's `chain >= target ? 'border-emerald-500/20 bg-emerald-500/10'...` line — both protected semantics.

- [ ] **Step 7: Live verification**

With the dev server running, navigate to `/games/higher-or-lower`. Confirm: loading spinner, chain badge weight, category label (now a gold gradient, not indigo/cyan), and left-card stat are gold. Confirm the "Mayor"/"Menor" buttons are still green/red (unchanged), and the right-card stat still shows amber once revealed. Answer a round and confirm the game-over banner (if reached) is still emerald/red depending on outcome. No console errors. Paste actual observations.

- [ ] **Step 8: Commit**

```bash
git add src/pages/games/HigherOrLower.vue
git commit -m "feat(play-zone): migrate HigherOrLower.vue to Play accent"
```

---

## Task 4: Migrate `Connections.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/Connections.vue`

**Interfaces:** none.

- [ ] **Step 1: Loading spinner**

Find:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando jugadores...</p>
      </div>
```
Replace with:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando jugadores...</p>
      </div>
```

- [ ] **Step 2: `#stat` slot — groups badge font-weight**

Find:
```html
          <span class="font-display text-white font-extrabold text-base leading-none">{{ solvedGroups.length }}/4</span>
```
Replace with:
```html
          <span class="font-display text-white font-bold text-base leading-none">{{ solvedGroups.length }}/4</span>
```

- [ ] **Step 3: Grid-tile selection state**

Find:
```html
          <button v-for="p in remainingPlayers" :key="p.id"
                  :class="[
                    'group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150',
                    isSelected(p)
                      ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-[1.04] z-10'
                      : 'border-white/10 hover:border-white/25',
                    shaking && isSelected(p) ? 'shake' : '',
                    gameOver ? 'pointer-events-none opacity-60' : 'cursor-pointer active:scale-95'
                  ]"
                  @click="toggleSelect(p)">
```
Replace with:
```html
          <button v-for="p in remainingPlayers" :key="p.id"
                  :class="[
                    'group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150',
                    isSelected(p)
                      ? 'border-amber-300 ring-2 ring-amber-300/50 scale-[1.04] z-10'
                      : 'border-white/10 hover:border-white/25',
                    shaking && isSelected(p) ? 'shake' : '',
                    gameOver ? 'pointer-events-none opacity-60' : 'cursor-pointer active:scale-95'
                  ]"
                  @click="toggleSelect(p)">
```
This is a "currently picked for verification" selection state (pre-outcome), not correct/incorrect feedback — decorative, recolors. `emerald-400` maps to `amber-300` (not `amber-400`).

- [ ] **Step 4: Selected checkmark badge**

Find:
```html
            <div v-if="isSelected(p)"
                 class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
              <svg class="w-3 h-3 text-emerald-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
```
Replace with:
```html
            <div v-if="isSelected(p)"
                 class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-300 flex items-center justify-center">
              <svg class="w-3 h-3 text-amber-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
```

- [ ] **Step 5: "Verificar" button**

Find:
```html
            <button @click="verify" :disabled="!canVerify"
                    class="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white px-6 py-2 text-sm font-bold transition disabled:opacity-40 shadow-lg shadow-emerald-500/20">
              Verificar
            </button>
```
Replace with:
```html
            <button @click="verify" :disabled="!canVerify"
                    class="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-900 px-6 py-2 text-sm font-bold transition disabled:opacity-40 shadow-lg shadow-amber-500/25">
              Verificar
            </button>
```
`text-white`→`text-slate-900` is the WCAG AA fix for the filled gold background.

Leave completely untouched: `GROUP_COLORS` (the `<script>`-block array driving solved-group colors — categorical differentiation system, see Global Constraints rule 4), the "almost" toast (amber, pre-existing), mistakes-remaining dots (rose, never emerald), the game-over message (`won ? emerald : red`, win/loss semantic), "Jugar de nuevo" button (neutral white/10, never emerald).

- [ ] **Step 6: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400 ring-2 ring-emerald-400|bg-emerald-400 flex|from-emerald-500 to-cyan-500' src/pages/games/Connections.vue
```
Expected: zero matches for all three patterns.

```bash
rg -n 'emerald' src/pages/games/Connections.vue
```
Expected: exactly 2 matching lines remaining — `GROUP_COLORS`' `{ bg: 'bg-emerald-500/90', text: 'text-emerald-950', border: 'border-emerald-400' }` entry (one line) and the game-over `won` message's `text-emerald-300` (one line) — both protected/out-of-scope.

- [ ] **Step 7: Live verification**

With the dev server running, navigate to `/games/connections`. Confirm: loading spinner, groups badge weight, and grid-tile selection ring/checkmark are gold when a tile is tapped. Confirm the "Verificar" button is gold with dark text. Solve a group (if feasible) and confirm the solved-group row still uses one of the 4 `GROUP_COLORS` (unchanged, including any that happen to be emerald). No console errors. Paste actual observations.

- [ ] **Step 8: Commit**

```bash
git add src/pages/games/Connections.vue
git commit -m "feat(play-zone): migrate Connections.vue to Play accent"
```

---

## Task 5: Migrate `FootballGrid.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/FootballGrid.vue`

**Interfaces:** none. Smallest task this wave — this file's only brand-chrome is the loading spinner and the score badge; everything else is either correct/incorrect cell feedback (semantic) or already-neutral.

- [ ] **Step 1: Loading spinner**

Find:
```html
    <div v-if="loading" class="text-center text-slate-300 py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      <p class="mt-3">Cargando grilla...</p>
    </div>
```
Replace with:
```html
    <div v-if="loading" class="text-center text-slate-300 py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
      <p class="mt-3">Cargando grilla...</p>
    </div>
```

- [ ] **Step 2: `#stat` slot — cells badge font-weight**

Find:
```html
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ corrects }}/9</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none whitespace-nowrap">{{ corrects }}/9</span>
```

Leave completely untouched: `cellClass()`'s filled-correctly (`bg-emerald-500/15 border-emerald-400/30`) / failed (`bg-red-500/10 border-red-400/20`) / flash-wrong (`bg-red-500/20 border-red-400/40`) states — all correct/incorrect cell feedback, the core mechanic of this game. The failed-cell "✕" icon (`text-red-400/40`). The finished banner (`corrects === 9 ? 'text-emerald-300' : 'text-slate-300'` — a completion-state indicator, semantic, matching the cross-zone win pattern). The autocomplete search input's focus ring (`focus:ring-white/20`, already neutral, never emerald). The "Reintentar" retry button (`bg-white/10 border-white/15`, neutral).

- [ ] **Step 3: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400\"' src/pages/games/FootballGrid.vue
```
Expected: zero matches (the spinner's `border-emerald-400` is now `border-amber-300`; confirm no other bare `border-emerald-400` string remains — note the cell-feedback `border-emerald-400/30` has a trailing `/30` and won't match this exact pattern, which is intentional).

```bash
rg -n 'emerald' src/pages/games/FootballGrid.vue
```
Expected: exactly 2 matching lines — `cellClass()`'s `bg-emerald-500/15 border-emerald-400/30` line and the finished banner's `text-emerald-300` line — both protected feedback/completion semantics.

- [ ] **Step 4: Live verification**

With the dev server running, navigate to `/games/football-grid`. Confirm: loading spinner and the "X/9" cells badge are gold. Fill a cell correctly (if feasible) and confirm it still shows the emerald "filled" cell style (unchanged); trigger an incorrect guess and confirm the red flash/failed states are unchanged. No console errors. Paste actual observations.

- [ ] **Step 5: Commit**

```bash
git add src/pages/games/FootballGrid.vue
git commit -m "feat(play-zone): migrate FootballGrid.vue to Play accent"
```

---

## Task 6: Migrate `StatChallenge.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/StatChallenge.vue`

**Interfaces:** none. This is the only task in this wave with a surface-class migration.

- [ ] **Step 1: Loading spinner**

Find:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>
```
Replace with:
```html
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        <p class="mt-3">Cargando...</p>
      </div>
```

- [ ] **Step 2: Score badge font-weight**

Find:
```html
            <span class="font-display text-white font-extrabold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 15 }}</span>
```
Replace with:
```html
            <span class="font-display text-white font-bold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 15 }}</span>
```
(Followed on the next line by `<StreakBadge :streak="streak" />` — do not touch, excluded shared component.)

- [ ] **Step 3: Surface migration — literal `.card`**

Find:
```html
      <div v-else class="relative card p-6 ring-1 ring-white/5">
```
Replace with:
```html
      <div v-else class="relative surface-solid p-6 ring-1 ring-white/5">
```

Leave completely untouched: `optionClass()`'s `border-green-500 bg-green-500/10 text-green-300` (correct) / `border-red-500 bg-red-500/10 text-red-300` (incorrect) — plain `green`, not `emerald` (same "different color name" pattern as Play Wave 2's `ShirtNumber.vue`), and semantic feedback either way. The 3 stat-category boxes (Goles=`bg-emerald-500/10 border-emerald-500/15 text-emerald-400`, Asistencias=sky, Apariciones=amber) — a coordinated 3-way categorical color system, see Global Constraints rule 3; do NOT recolor only the Goles box, leave all 3 exactly as they are. The time-over banner (amber, pre-existing). `AppH1` (already migrated in Hub Wave 3). `CircularTimer`/`StreakBadge`/`GamePreviewModal`/`GameSummaryPopup` (excluded shared components).

- [ ] **Step 4: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400\"|class="relative card' src/pages/games/StatChallenge.vue
```
Expected: zero matches for both patterns.

```bash
rg -n 'emerald' src/pages/games/StatChallenge.vue
```
Expected: exactly 1 matching line — the Goles stat box (`bg-emerald-500/10 border-emerald-500/15`) plus its label/value classes on adjacent lines are a separate concern; confirm by eye that ALL THREE stat boxes (Goles/Asistencias/Apariciones) are present and none of the three was touched, not just that grep found emerald somewhere.

- [ ] **Step 5: Live verification**

With the dev server running, navigate to `/games/stat-challenge`. Confirm: loading spinner and score badge are gold. Confirm the card container now sits on a `.surface-solid` flat-navy background (compare against an already-migrated Hub page for the look). Confirm the 3 stat boxes (Goles/Asistencias/Apariciones) are still emerald/sky/amber respectively — unchanged, all three. Answer a round and confirm correct/incorrect option feedback is still green/red. No console errors. Paste actual observations.

- [ ] **Step 6: Commit**

```bash
git add src/pages/games/StatChallenge.vue
git commit -m "feat(play-zone): migrate StatChallenge.vue to Play accent"
```

---

## Self-Review Notes

- **Spec coverage:** all 6 named games covered, one task each (no batching — reading each file confirmed they're structurally distinct enough that batching would have hidden per-game judgment calls, unlike Play Wave 2's 3 near-identical ordering games).
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code, including 2 raw scoped-CSS blocks (`FootballWordle.vue`'s `.chip-pos`, `HigherOrLower.vue`'s `.hl-stat`) matching Play Wave 1's established mechanism for this construct.
- **Type/signature consistency:** no props, emits, or component interfaces change anywhere in this plan — template/style-only, like every prior wave. All 6 tasks touch fully disjoint files.
- **New semantic categories this wave found and reasoned through explicitly** (more than any prior wave — these games are genuinely more varied than the simple 8): Wordle-style 3-way attribute feedback (`FootballWordle.vue`), coordinated multi-color categorical systems (`StatChallenge.vue`'s stat boxes, `Connections.vue`'s `GROUP_COLORS`), directional-comparison convention (`HigherOrLower.vue`'s Mayor/Menor buttons), real-world representational color (`OnceIdeal.vue`'s pitch green). Each is stated once in Global Constraints with its reasoning rather than repeated per task.
- **One judgment call flagged for extra scrutiny**: `OnceIdeal.vue`'s "+XP ganados" text is recolored (cyan→gold) rather than protected as reward-number semantic, because it was never actually using the app's shared emerald XP convention (`OnceIdeal.vue` doesn't render `GameSummaryPopup` at all) — this is the one ruling in this plan most likely to look wrong at a glance without reading the reasoning, flagged explicitly in Global Constraints rule 6 and in Task 1.
- **Rung-mapping discipline**: every replacement was checked against the "never `amber-400`" rule by hand, including one place (`OnceIdeal.vue` Step 3) where a naive `cyan-400`→`amber-400` slip would have been easy to make and was caught before finalizing this plan.
