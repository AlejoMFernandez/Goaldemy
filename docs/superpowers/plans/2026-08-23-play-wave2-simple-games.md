# Play Wave 2 — Simple Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Play zone's design system (gold single-accent, `.surface-solid` where sanctioned, Space Grotesk weight ceiling) to the 8 "simple" games: `GuessPlayer.vue`, `NationalityGame.vue`, `PlayerPosition.vue`, `WhoIs.vue`, `ShirtNumber.vue`, `ValueOrder.vue`, `AgeOrder.vue`, `HeightOrder.vue` — continuing the rollout Play Wave 1 started on the shared `GameShell.vue`/`GameSummaryPopup.vue` infra.

**Architecture:** No new shared component. Pure recolor + font-weight fixes across 8 files, with one small surface-class migration (3 files share a literal `class="card"` usage). All 8 games already render inside the already-migrated `GameShell.vue` (gold accent, dropdown/back-button chrome) and `GameSummaryPopup.vue` (gold accent, win/loss semantics) — this wave only touches each game's OWN template/inline styles, not those shared components again.

**Tech Stack:** Vue 3 (Options API, all 8 files), Tailwind CSS v4. Foundation + all 3 Hub waves + Play Wave 1 already merged to `main` (`--play-400/500/600` tokens defined and in active use since Play Wave 1). No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Scope note: shared subcomponents excluded, and why

These 8 games also import `GamePreviewModal.vue`, `CircularTimer.vue`, `StreakBadge.vue`, `PowerupBar.vue` — none are touched by this plan. They're rendered by ALL 14 games (this wave's 8 plus Play Wave 3's 6 complex games, not yet migrated), so recoloring them now would make them look gold on this wave's games and inconsistent/mismatched on the still-emerald complex games until Play Wave 3 lands — the same cross-cutting-shared-primitive deferral Hub Wave 2 applied to `AppButton.vue` and the global `.input` class. A quick grep found `GamePreviewModal.vue` (7 emerald/cyan hits), `StreakBadge.vue` (3), `PowerupBar.vue` (1) — real work, but it belongs to a dedicated "shared secondary game UI" pass once all 14 games are otherwise migrated, not scattered across two different waves. Not investigated further here.

Each of the 8 games also imports game-logic services (e.g. `services/guess-player-mcq.js`, `services/nationality.js`, `services/player-position.js`, `services/guess-player-typing.js`) that define an `optionClass()`/`pickAnswer()` helper controlling each option button's correct/incorrect feedback color. These service `.js` files are NOT in this plan's file list (only the 8 `.vue` page files are) — any emerald/red feedback classes living in those services are out of scope for this wave's tasks. This is intentional, not an oversight: those colors are semantic (correct/incorrect answer feedback), so leaving them untouched is the correct outcome regardless, and touching `.js` service files was never part of this plan's scope.

## Global Constraints

- **Color mapping** (apply ONLY to the specific decorative-chrome instances named in each task below): `border-emerald-400` (loading spinners) → `border-amber-300`; `focus:ring-emerald-400/30` (page-local input focus rings) → `focus:ring-amber-300/30`; filled `from-emerald-500 to-cyan-500` CTA gradients → `from-amber-500 to-amber-600`; the literal inline-style radial glow `rgba(16,185,129,0.4)` (emerald-500 at 40% alpha) → `rgba(245,158,11,0.4)` (amber-500 at the same 40% alpha — `#f59e0b` = `rgb(245,158,11)`, matches the `emerald-500`→`amber-500` decorative rung already established in Play Wave 1). **Never use `amber-400`** anywhere — it's the rung reserved for `--mb-prestige`/`--accent-gold` (the cross-zone PRO/prestige semantic), a semantic reservation not a hex-identity claim (under Tailwind v4's oklch amber ramp they're close golds, not byte-identical, but the reservation rule holds regardless) — using it for Play-zone decorative chrome will read as a collision with that token (this exact mistake happened once already in Play Wave 1, caught at final review — the correct rung for `emerald-400` is `amber-300`, not `amber-400`).

- **Filled/solid gold CTAs need dark text for WCAG AA**, matching the fix Play Wave 1's final review required: any button whose background becomes a filled `from-amber-500 to-amber-600` gradient must use `text-slate-900`, not `text-white` — white-on-filled-amber measures well under the 4.5:1 AA threshold. Every task below that recolors a filled CTA already has this baked into its Find/Replace code; do not "restore" `text-white` if it looks visually similar in a screenshot, the contrast math is the reason, not appearance.

- **What must NOT be recolored, left exactly as-is (this list matters more than the mapping in this wave — most emerald/red usage here is per-answer gameplay feedback, not brand chrome):**
  1. **Correct/incorrect answer feedback colors** — any color conditionally tied to whether an answer/placement was right or wrong (`border-emerald-500`/`bg-emerald-500/10`/`ring-emerald-400/60`/`bg-emerald-500/20 text-emerald-300` for correct; `border-red-500`/`bg-red-500/10`/`ring-red-400/60`/`bg-red-500/20 text-red-300` for incorrect, in `ValueOrder.vue`/`AgeOrder.vue`/`HeightOrder.vue`'s ordering-slot feedback) stays exactly as-is. This is the per-answer instance of the same `--mb-success`/`--mb-danger` semantic constant Play Wave 1 established for `GameSummaryPopup.vue`'s win/loss banner — it doesn't change per zone, and it doesn't change based on whether the feedback fires once per game or once per answer.
  2. **`ShirtNumber.vue`'s inline `optionClass()` correct/incorrect colors are `green-500`/`red-500`, not `emerald-500`/`red-500`** — a plain Tailwind `green`, a different color from `emerald`. This is both outside the literal color-mapping's scope (the mapping only touches `emerald`/`cyan`) AND semantic (correct/incorrect feedback) — two independent reasons it stays untouched. Do not "fix" it to match the other games' `emerald` convention; that would be scope creep into gameplay-feedback color choices this plan doesn't touch.
  3. **`WhoIs.vue`'s correct-guess name-reveal color** (`lastResultOk ? 'text-emerald-400' : 'text-white'`) — semantic (did you guess right), stays exactly as-is. Its font-weight DOES change per rule 5 below — weight and color are independent axes, changing one doesn't mean touching the other.
  4. **Lives icons** (`text-rose-500` in `WhoIs.vue`) — never emerald/cyan to begin with, out of scope by definition.
  5. **The "tiempo agotado" (time's up) banner and hint text** (`border-amber-500/20 bg-amber-500/10 text-amber-400`/`text-amber-300`, appearing in `GuessPlayer.vue`, `NationalityGame.vue`, `PlayerPosition.vue`, `ShirtNumber.vue`) — already amber, never emerald/cyan, and per Play Wave 1's established rule pre-existing amber gets zero shade-normalization this wave. Leave every instance byte-for-byte as it is.
  6. **The drag-hover ring** (`ring-amber-400 border-amber-400` in `ValueOrder.vue`/`AgeOrder.vue`/`HeightOrder.vue`) and the **selection ring** (`ring-sky-400 border-sky-400`/`bg-sky-500/10`) — neither was ever emerald/cyan, out of scope.
  7. **Any color inside a service `.js` file** (see Scope note above) — those files aren't part of this plan.

- **Surface migration**: exactly 3 instances of the sanctioned literal `class="card ..."` → `class="surface-solid ..."` pattern, one each in `ValueOrder.vue`, `AgeOrder.vue`, `HeightOrder.vue` (Task 6). No other file in this wave has either sanctioned surface pattern (the MCQ games' card container is `bg-gradient-to-b from-slate-800/70 to-slate-900/85`, a hand-rolled gradient — per Play Wave 1's controller ruling, this stays out of scope, not one of the 2 sanctioned patterns).

- **Font weight**: every `.font-display` element combined with `font-extrabold` drops to `font-bold` (Space Grotesk ships only weights 600/700). This wave has exactly 9 instances: the score-badge `<span>` in the `#stat` slot of `GuessPlayer.vue`, `NationalityGame.vue`, `PlayerPosition.vue`, `WhoIs.vue`, `ShirtNumber.vue` (5 instances, one per file, identical markup), `WhoIs.vue`'s correct-guess name-reveal `<p>` (1 instance), and the slot-number-badge `<div>` in `ValueOrder.vue`/`AgeOrder.vue`/`HeightOrder.vue` (3 instances, one per file, identical markup). Apply the weight change ONLY — where the element also has a semantic color (the `WhoIs.vue` name-reveal), the color stays exactly as-is.

- Do not touch `<script>`-block logic (scoring, session/challenge state machines, RNG seeding, XP calculation, drag-and-drop handlers) anywhere in this wave — templates/styles only, same constraint as every prior wave.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse `--play-400/500/600` (via the `amber-300`/`amber-500`/`amber-600` Tailwind classes established in Play Wave 1) — do not invent new Play-zone tokens or introduce a second hue.

---

## Task 1: Migrate `GuessPlayer.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/GuessPlayer.vue`

**Interfaces:** none (standalone routed page, no props/emits change).

- [ ] **Step 1: Score badge font-weight**

Find:
```html
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
```

- [ ] **Step 2: Radial background glow**

Find:
```html
        <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%);"></div>
```
Replace with:
```html
        <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl" style="background: radial-gradient(circle, rgba(245,158,11,0.4), transparent 70%);"></div>
```

Leave the "Tiempo agotado" banner (`border-amber-500/20 bg-amber-500/10`, `text-amber-400`, `text-amber-300`) and the hint text (`text-amber-300`) untouched — already amber, Global Constraints rule 5.

- [ ] **Step 3: Verify no leftover brand-color references**

```bash
rg 'rgba\(16,185,129|font-extrabold' src/pages/games/GuessPlayer.vue
```
Expected: zero matches for both patterns.

- [ ] **Step 4: Live verification**

With the dev server running, navigate to `/games/guess-player`. Confirm: the score badge in the top stat pill renders `font-bold` not `font-extrabold` (spot-check via `getComputedStyle` if visually subtle — Space Grotesk was already faux-bolding at 700 since no 800 face is loaded, so there may be zero visible difference, which is expected and correct). Confirm the soft background glow behind the card is now warm gold-tinted, not green-tinted (most visible at the top of the card, a large soft blur). No console errors. Paste actual observations. If Playwright MCP is unavailable, fall back to `curl`/HTTP-200 on the route + the grep verification above as your primary evidence.

- [ ] **Step 5: Commit**

```bash
git add src/pages/games/GuessPlayer.vue
git commit -m "feat(play-zone): migrate GuessPlayer.vue to Play accent"
```

---

## Task 2: Migrate `NationalityGame.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/NationalityGame.vue`

**Interfaces:** none.

- [ ] **Step 1: Loading spinner border**

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
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
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

Leave the hint text (`text-amber-300`) and the "Tiempo agotado" banner (amber) untouched — Global Constraints rule 5. Leave `optionClass()` (imported from `services/nationality.js`) untouched — out of scope, Scope note.

- [ ] **Step 4: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400|rgba\(16,185,129|font-extrabold' src/pages/games/NationalityGame.vue
```
Expected: zero matches for all three patterns.

- [ ] **Step 5: Live verification**

With the dev server running, navigate to `/games/nationality`. Confirm: while the page is loading, the spinner is gold-tinted (may be too fast to observe visually — check via source/computed-style instead if so); the score badge is `font-bold`; the background glow behind the card is gold-tinted. No console errors. Paste actual observations. Playwright MCP fallback same as Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/pages/games/NationalityGame.vue
git commit -m "feat(play-zone): migrate NationalityGame.vue to Play accent"
```

---

## Task 3: Migrate `PlayerPosition.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/PlayerPosition.vue`

**Interfaces:** none.

- [ ] **Step 1: Loading spinner border**

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
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
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

Leave the hint text (`text-amber-300`) untouched — Global Constraints rule 5. Leave `optionClass()` (imported from `services/player-position.js`) untouched — out of scope, Scope note.

- [ ] **Step 4: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400|rgba\(16,185,129|font-extrabold' src/pages/games/PlayerPosition.vue
```
Expected: zero matches for all three patterns.

- [ ] **Step 5: Live verification**

With the dev server running, navigate to `/games/player-position`. Same checks as Task 2 (spinner, score badge weight, background glow). No console errors. Paste actual observations. Playwright MCP fallback same as Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/pages/games/PlayerPosition.vue
git commit -m "feat(play-zone): migrate PlayerPosition.vue to Play accent"
```

---

## Task 4: Migrate `WhoIs.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/WhoIs.vue`

**Interfaces:** none.

- [ ] **Step 1: Loading spinner border**

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
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * (pointsPerCorrect || 10) }}</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * (pointsPerCorrect || 10) }}</span>
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

- [ ] **Step 4: Correct-guess name reveal — font-weight only, color stays**

Find:
```html
                <p :class="lastResultOk ? 'text-emerald-400' : 'text-white'" class="font-display font-extrabold text-lg leading-tight">{{ current?.name }}</p>
```
Replace with:
```html
                <p :class="lastResultOk ? 'text-emerald-400' : 'text-white'" class="font-display font-bold text-lg leading-tight">{{ current?.name }}</p>
```
Only the weight changes. `lastResultOk ? 'text-emerald-400' : 'text-white'` is a protected correct-guess semantic — leave it exactly as-is, per Global Constraints rule 3.

- [ ] **Step 5: Guess-input focus ring**

Find:
```html
              <input v-model="guess" @focus="suggestOpen=true" @input="suggestOpen = (guess?.length||0) >= 3; selectedIndex=-1"
                     @keydown.down.prevent="moveSelection(1)" @keydown.up.prevent="moveSelection(-1)" @keydown.enter.prevent="onEnterKey"
                     type="text" placeholder="Escribí el nombre del jugador..."
                     class="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
```
Replace with:
```html
              <input v-model="guess" @focus="suggestOpen=true" @input="suggestOpen = (guess?.length||0) >= 3; selectedIndex=-1"
                     @keydown.down.prevent="moveSelection(1)" @keydown.up.prevent="moveSelection(-1)" @keydown.enter.prevent="onEnterKey"
                     type="text" placeholder="Escribí el nombre del jugador..."
                     class="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300/30" />
```
This is a page-local inline input, not the shared global `.input` class (which stays untouched app-wide, same precedent as Hub Wave 2's `FriendsDock.vue` inline inputs and Hub Wave 3's `Pricing.vue` confirmation-modal input).

- [ ] **Step 6: "Adivinar" submit button — decorative CTA + WCAG contrast fix**

Find:
```html
              <button type="submit" :disabled="(guess?.length || 0) < 3" class="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white px-6 py-2 text-sm font-bold disabled:opacity-40 transition shadow-lg shadow-emerald-500/20">Adivinar</button>
```
Replace with:
```html
              <button type="submit" :disabled="(guess?.length || 0) < 3" class="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-900 px-6 py-2 text-sm font-bold disabled:opacity-40 transition shadow-lg shadow-amber-500/25">Adivinar</button>
```
`text-white`→`text-slate-900` is the WCAG AA fix established in Play Wave 1 for filled gold CTAs — do not restore `text-white`.

- [ ] **Step 7: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400|rgba\(16,185,129|from-emerald-500 to-cyan-500|font-extrabold' src/pages/games/WhoIs.vue
```
Expected: zero matches for all four patterns. (The `lastResultOk ? 'text-emerald-400' : ...` ternary is a separate string shape that these patterns don't match — it should still be present, untouched.)

```bash
rg 'text-emerald-400' src/pages/games/WhoIs.vue
```
Expected: exactly 1 match — the protected correct-guess ternary from Step 4.

- [ ] **Step 8: Live verification**

With the dev server running, navigate to `/games/who-is`. Confirm: loading spinner, score badge weight, and background glow per the usual checks. Type a partial player name into the guess input and confirm the focus ring is gold, not green. Confirm the "Adivinar" button is a gold gradient with dark (not white) text. If you can complete a round, confirm a correct guess still shows the revealed name in emerald (not gold). No console errors. Paste actual observations.

- [ ] **Step 9: Commit**

```bash
git add src/pages/games/WhoIs.vue
git commit -m "feat(play-zone): migrate WhoIs.vue to Play accent"
```

---

## Task 5: Migrate `ShirtNumber.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/ShirtNumber.vue`

**Interfaces:** none.

- [ ] **Step 1: Loading spinner border**

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
        <span class="font-display text-white font-extrabold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
```
Replace with:
```html
        <span class="font-display text-white font-bold text-base leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
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

Leave `optionClass(opt)`'s inline `green-500`/`red-500` correct/incorrect classes (defined in this file's own `<script>` block's `methods`) completely untouched — Global Constraints rule 2 (different color family from the mapping AND semantic feedback, two independent reasons). Leave the hint text and "Tiempo agotado" banner (amber) untouched — rule 5.

- [ ] **Step 4: Verify no leftover brand-color references**

```bash
rg 'border-emerald-400|rgba\(16,185,129|font-extrabold' src/pages/games/ShirtNumber.vue
```
Expected: zero matches for all three patterns.

```bash
rg 'green-500' src/pages/games/ShirtNumber.vue
```
Expected: exactly 1 matching line (`border-green-500 bg-green-500/10 text-green-300 option-correct` — the pattern appears twice on that single line, but `rg` in default content mode reports the line once, not once per occurrence) — confirms the `optionClass()` correct branch is untouched, not that it was removed.

- [ ] **Step 5: Live verification**

With the dev server running, navigate to `/games/shirt-number`. Same checks as Task 2/3 (spinner, score badge weight, background glow). If you can complete a round, confirm correct/incorrect option feedback is still green/red (unchanged). No console errors. Paste actual observations.

- [ ] **Step 6: Commit**

```bash
git add src/pages/games/ShirtNumber.vue
git commit -m "feat(play-zone): migrate ShirtNumber.vue to Play accent"
```

---

## Task 6: Migrate `ValueOrder.vue` + `AgeOrder.vue` + `HeightOrder.vue` to the Play design system

**Files:**
- Modify: `src/pages/games/ValueOrder.vue`
- Modify: `src/pages/games/AgeOrder.vue`
- Modify: `src/pages/games/HeightOrder.vue`

**Interfaces:** none. These 3 files are near-identical clones (same ordering-game mechanic, different sort metric) — batched into one task per the subagent-driven-development "batch small same-shape work" guidance, since all 3 need the exact same 3 changes.

- [ ] **Step 1: Surface migration — literal `.card` → `.surface-solid` (all 3 files, identical)**

Find (in `ValueOrder.vue`, `AgeOrder.vue`, AND `HeightOrder.vue` — apply to each file independently, same string in all 3):
```html
      <div class="relative card p-4 sm:p-6 ring-1 ring-white/5" ref="confettiHost">
```
Replace with:
```html
      <div class="relative surface-solid p-4 sm:p-6 ring-1 ring-white/5" ref="confettiHost">
```

- [ ] **Step 2: Slot-number badge font-weight (all 3 files, identical)**

Find (in each of the 3 files):
```html
                <div class="shrink-0 w-8 h-8 rounded-full grid place-items-center font-display font-extrabold text-sm"
```
Replace with:
```html
                <div class="shrink-0 w-8 h-8 rounded-full grid place-items-center font-display font-bold text-sm"
```

- [ ] **Step 3: "Comprobar" button — decorative CTA + WCAG contrast fix (all 3 files, identical)**

Find (in each of the 3 files):
```html
          <button @click="check" :disabled="slots.some(x=>x==null) || locked"
                  class="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 border border-white/10 text-white px-6 py-2.5 text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95">
            Comprobar
          </button>
```
Replace with:
```html
          <button @click="check" :disabled="slots.some(x=>x==null) || locked"
                  class="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 border border-white/10 text-slate-900 px-6 py-2.5 text-sm font-bold shadow-lg shadow-amber-500/25 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95">
            Comprobar
          </button>
```
`text-white`→`text-slate-900` is the WCAG AA fix established in Play Wave 1 — do not restore `text-white`.

Leave every instance of the slot correctness feedback (`border-emerald-500 bg-emerald-500/10 slot-correct` / `border-red-500 bg-red-500/10 shake`, the `ring-emerald-400/60`/`ring-red-400/60` avatar rings, the `bg-emerald-500/20 text-emerald-300`/`bg-red-500/20 text-red-300` value badges) untouched in all 3 files — Global Constraints rule 1. Leave the amber drag-hover ring and sky selection ring untouched — rule 6.

- [ ] **Step 4: Verify no leftover brand-color references, per file**

```bash
rg 'class="relative card|from-emerald-500 to-cyan-500|font-extrabold' src/pages/games/ValueOrder.vue
rg 'class="relative card|from-emerald-500 to-cyan-500|font-extrabold' src/pages/games/AgeOrder.vue
rg 'class="relative card|from-emerald-500 to-cyan-500|font-extrabold' src/pages/games/HeightOrder.vue
```
All three expected: zero matches.

```bash
rg -n 'emerald' src/pages/games/ValueOrder.vue
rg -n 'emerald' src/pages/games/AgeOrder.vue
rg -n 'emerald' src/pages/games/HeightOrder.vue
```
Each expected: exactly 3 matching lines per file — the slot-correct border/bg line (`border-emerald-500 bg-emerald-500/10 slot-correct`), the avatar ring line (`ring-emerald-400/60`), and the value-badge bg+text line (`bg-emerald-500/20 text-emerald-300`) — all protected feedback semantics, confirming nothing else was missed or over-recolored.

- [ ] **Step 5: Live verification**

With the dev server running, navigate to `/games/value-order`, `/games/age-order`, and `/games/height-order`. For each: confirm the card container is now a flat `.surface-solid` background (no gradient/blur difference vs. before may be subtle — compare against an already-migrated Hub page for the flat-navy look), the slot-number circles are `font-bold`, and the "Comprobar" button is a gold gradient with dark text. If you can complete a round, confirm correct/incorrect slot feedback is still green/red (unchanged). No console errors on any of the 3 routes. Paste actual observations for at least one of the 3 (they share the same template, but confirm the commit touched all 3 files via `git diff --stat`).

- [ ] **Step 6: Commit**

```bash
git add src/pages/games/ValueOrder.vue src/pages/games/AgeOrder.vue src/pages/games/HeightOrder.vue
git commit -m "feat(play-zone): migrate ValueOrder.vue + AgeOrder.vue + HeightOrder.vue to Play accent + surface-solid"
```

---

## Self-Review Notes

- **Spec coverage:** all 8 named games covered, one task each except the 3 near-identical ordering games batched into Task 6. Shared secondary game components (`GamePreviewModal.vue`, `CircularTimer.vue`, `StreakBadge.vue`, `PowerupBar.vue`) explicitly excluded with reasoning (cross-cutting primitives shared with not-yet-migrated Play Wave 3 games) rather than silently skipped.
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code, including the raw inline-style `rgba(...)` edits (5 instances, same value/replacement across GuessPlayer/NationalityGame/PlayerPosition/WhoIs/ShirtNumber).
- **Type/signature consistency:** no props, emits, or component interfaces change anywhere in this plan — template/inline-style-only, like every prior wave.
- **Semantic-color judgment calls, stated once here rather than repeated per task:** the single biggest one this wave is that MOST emerald/red usage across these 8 files is per-answer gameplay feedback (correct/incorrect), not brand chrome — the ratio here skews even further toward "protected" than Play Wave 1's `GameSummaryPopup.vue` did. `ShirtNumber.vue`'s inline `green-500`/`red-500` (not `emerald-500`) is flagged explicitly so an implementer doesn't "helpfully" normalize it to match the other games' `emerald` — it was never in scope by the literal mapping OR by the semantic rule, two independent reasons.
- **Cross-wave duplicate-string check:** the radial-glow `rgba(16,185,129,0.4)` inline style appears identically in 5 of these 8 files (GuessPlayer, NationalityGame, PlayerPosition, WhoIs, ShirtNumber) — same value, same fix, applied independently in each file's own task (not a shared component, so no risk of a Wave-1-style "already fixed elsewhere" skip).
- **WCAG AA carried forward correctly:** both filled-gold CTAs this wave introduces (`WhoIs.vue`'s "Adivinar" button, and the shared "Comprobar" button across the 3 ordering games) get `text-slate-900` from the start, per the fix Play Wave 1's final review required — not discovered again at this wave's final review.
