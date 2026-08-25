# Play Wave 5 — Daily Challenge (`/reto`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Play zone's design system (monochrome gold, Space Grotesk weight ceiling) to `src/pages/DailyChallenge.vue`, the public no-login marketing funnel behind `/reto` — continuing the rollout Play Waves 1-4 completed on shared infra, all 14 games, and the celebration overlays.

**Architecture:** No new shared component. Pure recolor + font-weight fixes across a single self-contained page — this file is genuinely standalone: it imports no Vue subcomponents at all (only two service modules, `daily-reto.js` and `share.js`), does not render `GameShell.vue`/`GameSummaryPopup.vue`/`CircularTimer.vue`/`StreakBadge.vue`/`GamePreviewModal.vue`/`PowerupBar.vue`, and has its own inline `optionClass()` answer-feedback logic in its `<script setup>` block rather than importing a shared helper. One important correction to the survey estimate: the file lives at `src/pages/DailyChallenge.vue`, not `src/pages/games/DailyChallenge.vue` as the scoping survey guessed — confirmed via `router.js:48,96`.

**Tech Stack:** Vue 3 `<script setup>`, Tailwind CSS v4. Foundation + all 3 Hub waves + Play Waves 1-4 already merged to `main`. No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- **Color mapping** (the established rung ladder from Play Waves 1-3, reused here — apply ONLY to the specific decorative-chrome instances named in the task below): `emerald-400`→`amber-300`, `emerald-500`→`amber-500`, `cyan-300`/`cyan-400`→`amber-300` (same rung as `emerald-400` — both were the "lighter" hue in a two-hue pairing), `cyan-500`→`amber-500`. **Never use `amber-400`** anywhere — it's the rung reserved for `--mb-prestige`/`--accent-gold` (a semantic reservation, not a hex-identity claim). This file has zero instances that would naturally map to `amber-400` (no `emerald-400`/`cyan-400`-adjacent instance requires it), but stay alert regardless — it's the mistake that has recurred most across this whole initiative.

- **Established idioms, not a literal per-token lookup — reuse these exactly, don't re-derive them:**
  1. **Filled CTA gradient**: any `bg-gradient-to-r from-emerald-500 to-cyan-500` button becomes `bg-gradient-to-r from-amber-500 to-amber-600` — this is the fixed 2-stop CTA idiom used identically in every prior wave (Play Wave 1's `GameSummaryPopup.vue`, Wave 2's `WhoIs.vue`/`ValueOrder.vue` family, Wave 3's `FootballWordle.vue`/`Connections.vue`, Wave 4's `CosmeticUnlockOverlay.vue`), NOT a literal `emerald-500→amber-500, cyan-500→amber-500` token substitution (which would flatten to `from-amber-500 to-amber-500`, a non-gradient). This file has 2 such buttons — see Task Steps 4 and 14.
  2. **Multi-stop mixed-hue decorative gradients** (progress bars, NOT CTAs): where the old gradient combined two different hues at the same-ish lightness (e.g. `from-emerald-400 to-cyan-400`), do not collapse to one flat repeated rung — spread across two different amber rungs preserving the original light→dark order (`from-amber-300 to-amber-500` for a 2-stop bar). This file's question-progress bar (Step 6) needs this treatment. The 3-stop `from-emerald-400 via-cyan-400 to-indigo-400` gradient (Step 12, this file's level-progress bar) is the exact duplicate string already fixed independently in `ProfileIdentityCard.vue` (Hub Wave 2, violet/purple) and `GameSummaryPopup.vue` (Play Wave 1, gold) — this is a THIRD, separate instance of that string in a THIRD file; it gets its own gold treatment (`from-amber-300 via-amber-500 to-amber-600`, matching `GameSummaryPopup.vue`'s exact precedent since both are Play-zone), not copied from either prior fix and not skipped as "already done elsewhere."
  3. **WCAG AA on filled CTAs**: `text-white`→`text-slate-900`, required on both of this file's filled-gold buttons (Steps 4 and 14) — established Play Wave 1 fix for the same reason every time: white text on a filled `amber-500`/`amber-600` background fails 4.5:1 contrast.

- **Font weight**: every `.font-display` element combined with `font-extrabold` → `font-bold` (Space Grotesk ships only weights 600/700). This file has exactly 7 `font-extrabold` occurrences; 6 are paired with `.font-display` and get the weight fix (Steps 3, 8, 9, 10, 11, 13 below); the 7th — the "Reclamar mis recompensas" claim button (`class="claim-btn ... font-extrabold uppercase tracking-wide ..."`) — has NO `.font-display` class on that element, so per the established rule it stays untouched entirely (both weight and color, since its `from-amber-400 to-yellow-500` gradient was also never emerald/cyan to begin with — see exclusion rule 6 below). Verify by reading the actual class list, don't assume every `font-extrabold` in a `.font-display`-heavy file is paired.

- **What must NOT be recolored, left exactly as-is (longer and more consequential than the mapping in this wave):**
  1. **`optionClass()` — the entire function, all 4 branches, including its one decorative-looking sub-branch.** This is a `<script setup>`-block JS function (lines 135-140) returning Tailwind class strings for the answer-option buttons: not-yet-answered (`'border-white/10 bg-white/[0.04] hover:border-cyan-400/40 hover:bg-white/[0.07] active:scale-[0.98]'`), correct (`'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'`), wrong-selected (`'border-red-400/50 bg-red-500/15 text-red-300'`), and the dimmed-other-options fallback. The correct/wrong branches are the same cross-zone answer-feedback semantic protected in every prior wave (`--mb-success`/`--mb-danger`) — but this task leaves the WHOLE function untouched, including the not-yet-answered branch's `hover:border-cyan-400/40` (which, read in isolation, looks like ordinary decorative chrome). This is a deliberate scope call, consistent with how `Connections.vue`'s `GROUP_COLORS` array was protected in Play Wave 3: this whole initiative's constraint is "do not touch `<script>`-block logic... templates/styles only" — that boundary is about where the code LIVES (script vs. template/style), not about re-litigating whether each individual string inside a script function is semantic or decorative. Do not extract or restyle any part of this function.
  2. **The win/loss result banner and title** (lines 200, 202): `won ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border-emerald-500/25' : 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 border-amber-500/25'` and `won ? 'text-emerald-400' : 'text-amber-400'` — the same cross-zone win/loss constant (`--mb-success`/`--mb-danger`) established since Hub Wave 1's `GameCard.vue` and reused in every wave since (most recently Play Wave 1's `GameSummaryPopup.vue`, which protected the exact same `to-cyan-500/10` win-banner gradient stop for the identical reason: it's the win-side member of a matched semantic pair with the loss banner's `to-orange-500/10`, not a free decorative slot). Only the title's font-weight changes (Step 9); its color ternary is untouched.
  3. **The "XP ganada" reward card** (lines 221-223) and its echo inside the claim-gate paragraph (line 279, `<strong class="text-emerald-400">+{{ rewards.xp }} XP</strong>`) — this genuinely follows the app's shared `.xp-float` reward-number convention: `src/style.css:177-193` defines `.xp-float` with `background: rgba(16,185,129,0.12)` / `border-color: rgba(16,185,129,0.45)` (both `emerald-500`'s RGB), and this reward card independently uses the identical `border-emerald-400/30 bg-emerald-500/10` tint family plus a matching `drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]` glow (`52,211,153` = `emerald-400`) — same convention, same reasoning already applied to protect `GameSummaryPopup.vue`'s XP stat card (Play Wave 1) and `LevelUpOverlay.vue`'s "+XP" badge (Play Wave 4), and the OPPOSITE of the ruling for `OnceIdeal.vue`'s cyan XP text (Play Wave 3), which never used this convention to begin with. Only the number's font-weight changes (Step 10); its color and drop-shadow are untouched. The gate-paragraph echo (line 279) is untouched entirely (no weight change needed there — it's a `<strong>` inline element, not `.font-display`).
  4. **The "Fichas" reward card** (lines 225-229) and its gate-paragraph echo (line 280, `<strong class="text-amber-400">{{ rewards.fichas }} Fichas</strong>`) — already amber (`border-amber-400/30 bg-amber-500/10 text-amber-400`, plus a matching amber `drop-shadow`), never emerald/cyan to begin with. Only the number's font-weight changes (Step 11); color and drop-shadow untouched. Note: this file's "Fichas" styling is amber, which does NOT match the emerald→cyan "Fichas" currency-identity color established in `Tienda.vue`/`ShopCard.vue`/`CurrencyIcon.vue` (Hub Wave 3's deferred Tienda decision) — this is a pre-existing inconsistency in the app, not something this wave introduces or is responsible for reconciling; out of scope regardless of which direction it's inconsistent in.
  5. **The level-progress teaser block's non-milestone chrome**: the level numbers (`text-white`/`rewards.levelUp ? 'text-yellow-400' : 'text-slate-500'`, lines 238/240) and the "¡SUBÍS DE NIVEL!" badge (`text-yellow-400 bg-yellow-500/15 border-yellow-500/25`, line 242) are yellow or neutral, never emerald/cyan — out of scope by definition, same as every prior wave's rule for colors that were never part of the mapping.
  6. **The "Reclamar mis recompensas" claim button** (lines 264-268, `.claim-btn` — `bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 ... font-extrabold ...`) and the claim-gate overlay box (lines 272-274, `border-amber-400/30`/`bg-amber-500/15`/`text-amber-400`) — both already amber/yellow, never emerald/cyan. The claim button also carries the `.claim-btn` scoped-CSS `claim-glow` animation (`box-shadow` pulsing between two `rgba(245,158,11,...)` values — already `amber-500`'s RGB, no change needed) — not touched at all, consistent with not touching any part of this element.
  7. **The share button's transient "shared" confirmation state** (line 291): `state.shareMsg ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300' : '...'` — a transient "operation succeeded" signal (the message clears itself after 2.4s via `setTimeout`, confirmed in `share()`, lines 125-133), the same cross-zone `--mb-success` semantic Play Wave 1 protected on `GameSummaryPopup.vue`'s share button. Only the DEFAULT (not-yet-shared) branch would ever be a recolor target — but this file's default branch (`'border border-white/15 text-slate-300 hover:bg-white/5'`) was never emerald/cyan to begin with, so there is nothing to recolor here at all; the whole ternary is untouched.
  8. **Accuracy/streak stat tiles** (lines 251-260, "🎯 {{ accuracy }}%" / "🔥 x{{ state.maxStreak }}") — plain white/slate text, never emerald/cyan.
  9. **The scoped `<style>` block** (lines 303-313): `.reward-card`'s `reward-pop` keyframe and `.gate-in`'s `gate-in` keyframe have no color values at all (transform/opacity only). `.claim-btn`'s `claim-glow` keyframe already uses `rgba(245,158,11,...)` (`amber-500`) — pre-existing gold, not emerald/cyan, not touched.

- **Surface migration**: this file has no literal `class="card ..."` usage and no instance of the sanctioned `bg-slate-900/60-70 + backdrop-blur-md` pattern — both card containers (lines 179, 198) use a hand-rolled 3-stop `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900`, the same pattern every prior wave has correctly left out of scope (not one of the 2 sanctioned patterns, per Play Wave 1's controller ruling against inventing a 3rd). No surface-class task this wave.

- Do not touch `<script>`-block logic (the reto load/save/retry flow, the count-up animation timing, `share()`, `optionClass()`) anywhere in this wave — templates/styles only, same constraint as every prior wave.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse `--play-400/500/600` via the `amber-300`/`amber-500`/`amber-600` Tailwind classes — do not invent new Play-zone tokens or introduce a second hue.

---

## Task 1: Migrate `DailyChallenge.vue` to the Play design system

**Files:**
- Modify: `src/pages/DailyChallenge.vue`

**Interfaces:** none (standalone routed page — `/reto`, `meta.zone: 'play'` already set in `router.js:96` — no props/emits change).

- [ ] **Step 1: Loading spinner**

Find:
```html
      <div class="h-10 w-10 rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin"></div>
```
Replace with:
```html
      <div class="h-10 w-10 rounded-full border-4 border-amber-300/30 border-t-amber-300 animate-spin"></div>
```

- [ ] **Step 2: "Reto del día" badge pill (border/bg/text + both ping-dot layers)**

Find:
```html
      <div class="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-5">
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
        </span>
        Reto del día
      </div>
```
Replace with:
```html
      <div class="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-5">
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-amber-300"></span>
        </span>
        Reto del día
      </div>
```

- [ ] **Step 3: Intro headline — font-weight only**

Find:
```html
      <h1 class="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">{{ state.game?.label }}</h1>
```
Replace with:
```html
      <h1 class="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-3">{{ state.game?.label }}</h1>
```

- [ ] **Step 4: "Jugar ahora" CTA — decorative recolor + WCAG AA fix**

Find:
```html
      <button @click="start" class="w-full max-w-xs mx-auto rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-4 text-lg font-bold transition shadow-lg shadow-emerald-500/25 active:scale-[0.98]">
        Jugar ahora
      </button>
```
Replace with:
```html
      <button @click="start" class="w-full max-w-xs mx-auto rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-900 py-4 text-lg font-bold transition shadow-lg shadow-amber-500/25 active:scale-[0.98]">
        Jugar ahora
      </button>
```
`text-white`→`text-slate-900` is the WCAG AA fix established in Play Wave 1 for filled gold CTAs.

- [ ] **Step 5: "Iniciá sesión" link color**

Find:
```html
      <p class="text-slate-500 text-xs mt-6">¿Ya tenés cuenta? <RouterLink to="/login" class="text-cyan-400 hover:underline">Iniciá sesión</RouterLink></p>
```
Replace with:
```html
      <p class="text-slate-500 text-xs mt-6">¿Ya tenés cuenta? <RouterLink to="/login" class="text-amber-300 hover:underline">Iniciá sesión</RouterLink></p>
```

- [ ] **Step 6: Question-progress bar (2-stop decorative gradient)**

Find:
```html
        <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300" :style="{ width: progressPct + '%' }"></div>
```
Replace with:
```html
        <div class="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-300" :style="{ width: progressPct + '%' }"></div>
```
Per the Global Constraints multi-stop rule — spread across 2 rungs to preserve a visible gradient, not `from-amber-300 to-amber-300`.

- [ ] **Step 7: Player-name heading — font-weight only**

Find:
```html
        <h2 class="font-display text-2xl font-extrabold text-white leading-tight">{{ current.player.name }}</h2>
```
Replace with:
```html
        <h2 class="font-display text-2xl font-bold text-white leading-tight">{{ current.player.name }}</h2>
```

- [ ] **Step 8: Prompt text color**

Find:
```html
        <p class="text-cyan-300/90 text-sm mt-3 font-semibold">{{ state.game?.prompt }}</p>
```
Replace with:
```html
        <p class="text-amber-300/90 text-sm mt-3 font-semibold">{{ state.game?.prompt }}</p>
```

- [ ] **Step 9: Result title — font-weight only, win/loss color ternary stays**

Find:
```html
          <h2 :class="['font-display text-3xl font-extrabold', won ? 'text-emerald-400' : 'text-amber-400']">{{ won ? '¡Bien jugado!' : '¡Casi!' }}</h2>
```
Replace with:
```html
          <h2 :class="['font-display text-3xl font-bold', won ? 'text-emerald-400' : 'text-amber-400']">{{ won ? '¡Bien jugado!' : '¡Casi!' }}</h2>
```
Only the weight changes — the `won ? ...` color ternary is the protected cross-zone win/loss semantic (Global Constraints rule 2), leave it exactly as-is.

- [ ] **Step 10: XP reward number — font-weight only, color + drop-shadow stay**

Find:
```html
              <div class="font-display text-3xl font-extrabold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]">+{{ state.animXp }}</div>
```
Replace with:
```html
              <div class="font-display text-3xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]">+{{ state.animXp }}</div>
```
Only the weight changes — this is the protected `.xp-float`-convention reward number (Global Constraints rule 3), color and glow stay exactly as-is.

- [ ] **Step 11: Fichas reward number — font-weight only, color + drop-shadow stay**

Find:
```html
              <div class="font-display text-3xl font-extrabold text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]">
```
Replace with:
```html
              <div class="font-display text-3xl font-bold text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]">
```
Already amber (Global Constraints rule 4), never emerald/cyan — only the weight changes.

- [ ] **Step 12: Level-progress bar (3-stop duplicate-string gradient)**

Find:
```html
              <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400" :style="{ width: state.animBar + '%', transition: 'width 0.3s' }"></div>
```
Replace with:
```html
              <div class="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-500 to-amber-600" :style="{ width: state.animBar + '%', transition: 'width 0.3s' }"></div>
```
This exact gradient string also appears in `ProfileIdentityCard.vue` (Hub Wave 2, already fixed to violet/purple) and previously appeared in `GameSummaryPopup.vue` (Play Wave 1, already fixed to this same gold treatment) — this is a third, independent instance in a third file. It gets its own gold fix here; do not skip it thinking it was "already handled," and do not copy Hub's violet/purple treatment (wrong zone).

- [ ] **Step 13: Claim-gate heading — font-weight only**

Find:
```html
            <h3 class="font-display text-xl font-extrabold text-white mb-1">Tus recompensas te esperan</h3>
```
Replace with:
```html
            <h3 class="font-display text-xl font-bold text-white mb-1">Tus recompensas te esperan</h3>
```

- [ ] **Step 14: "Crear cuenta gratis y reclamar" CTA — decorative recolor + WCAG AA fix**

Find:
```html
            <RouterLink to="/register" class="block w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 text-sm font-bold transition shadow-lg shadow-emerald-500/25 mb-2">
              Crear cuenta gratis y reclamar
            </RouterLink>
```
Replace with:
```html
            <RouterLink to="/register" class="block w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-900 py-3 text-sm font-bold transition shadow-lg shadow-amber-500/25 mb-2">
              Crear cuenta gratis y reclamar
            </RouterLink>
```
Same WCAG AA fix as Step 4.

Leave completely untouched, per Global Constraints: `optionClass()` (entire function, script block), the win/loss banner background (line 200), the XP/Fichas reward cards' border/background/label colors (lines 221-222, 225-226), the gate paragraph's XP/Fichas `<strong>` echoes (lines 279-280), the level-number/badge yellow chrome (lines 238-242), the claim button and its `claim-glow` animation (lines 264-268), the claim-gate overlay box (lines 272-274), and the share button's transient-confirmation ternary (line 291).

- [ ] **Step 15: Verify no leftover brand-color references, and confirm protected instances survived**

```bash
rg -n 'cyan' src/pages/DailyChallenge.vue
```
Expected: exactly 1 matching line — the win banner's `to-cyan-500/10` gradient stop (line ~200, inside the `won ? ...` ternary). This is the ONLY cyan instance in the whole file that's protected; every other cyan usage was decorative and should be gone.

```bash
rg -n 'emerald' src/pages/DailyChallenge.vue
```
Expected: exactly 8 matching lines — `optionClass()`'s correct branch (script), the win banner's background gradient + border, the win title's color ternary, the XP reward card's border/bg line, the XP reward card's label line, the XP reward number's color+drop-shadow line, the gate paragraph's XP `<strong>` echo, and the share button's transient-confirmation ternary. All 8 are protected per Global Constraints; none should show as a diff in this task's commit.

```bash
rg 'amber-400' src/pages/DailyChallenge.vue
```
Expected: zero matches introduced by this task — any `amber-400` present must be pre-existing (there shouldn't be any in this file at all; if `rg` finds one, verify via `git diff` whether this task introduced it, which would be a bug).

- [ ] **Step 16: Live verification**

With the dev server running, navigate to `/reto` (no login required — this is a public page). Confirm: the loading spinner (if visible) and the "Reto del día" badge are gold, not cyan. On the intro screen: confirm "Jugar ahora" is a gold gradient button with dark text, and "Iniciá sesión" is a gold link. Start the challenge: confirm the question-progress bar fill is a 2-tone gold gradient, and the prompt text under the player photo is gold. Answer through to the result screen (or force `state.phase = 'result'` via Vue devtools if faster): confirm the win/loss banner and title are STILL emerald-for-win/amber-for-loss (unchanged), the "XP ganada" card is STILL emerald with its glow (unchanged), the "Fichas" card is still amber (unchanged), the level-progress teaser bar is now a 3-stop gold gradient, and clicking "Reclamar mis recompensas" shows the gate with a gold "Crear cuenta gratis y reclamar" button (dark text) — confirm the "+XP"/Fichas strings inside the gate paragraph are still emerald/amber respectively (unchanged). Click "Compartir mi resultado" and confirm the transient "¡Copiado!"/"¡Gracias por compartir!" state is still emerald (unchanged). No console errors. Paste actual observations. If Playwright MCP is unavailable, fall back to `curl`/HTTP-200 on `/reto` + the grep verification above as primary evidence.

- [ ] **Step 17: Run build**

```bash
npm run build
```
Expected: clean build, no new errors (this is the plan's only task, so this doubles as the whole-branch build check).

- [ ] **Step 18: Commit**

```bash
git add src/pages/DailyChallenge.vue
git commit -m "feat(play-zone): migrate DailyChallenge.vue to Play accent"
```

---

## Self-Review Notes

- **Spec coverage:** the one named file in this wave's scope (`DailyChallenge.vue`, confirmed as the actual `/reto` route backer via `router.js`, correcting the survey's guessed path) is fully covered — 14 recolor/weight-fix steps plus an explicit, exhaustive enumeration of every protected instance (9 numbered exclusion rules in Global Constraints, cross-referenced by line number).
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code copied verbatim from a fresh read of the file.
- **Type/signature consistency:** no props, emits, or component interfaces change — template/class-only. Single task, no cross-task dependency.
- **Reachability confirmed:** this file imports zero Vue subcomponents (only `daily-reto.js`/`share.js` services) — it does not render any of the already-established excluded shared game components (`GameShell.vue`, `GameSummaryPopup.vue`, `CircularTimer.vue`, `StreakBadge.vue`, `GamePreviewModal.vue`, `PowerupBar.vue`), so there was no exclusion-list cross-check needed beyond confirming their absence.
- **Semantic-color judgment calls, stated once here rather than repeated per step:** the wave's most consequential call is protecting `optionClass()`'s entire function — including its one sub-branch (`hover:border-cyan-400/40`) that, read in isolation, looks like ordinary decorative chrome — purely on the grounds that it lives in the `<script>` block, consistent with how `Connections.vue`'s `GROUP_COLORS` (Play Wave 3) was protected the same way regardless of its individual entries' content. The second most consequential call is confirming (not assuming) that the XP reward card genuinely follows the app's `.xp-float` convention, by independently reading `style.css`'s actual `.xp-float` definition and matching its `rgba(16,185,129,...)`/`rgba(52,211,153,...)` values against this file's `emerald-500`/`emerald-400` tokens — the same verification rigor Play Wave 4's final review applied to `LevelUpOverlay.vue`'s equivalent badge, arriving at the same "protect it" conclusion for the same demonstrated (not assumed) reason.
- **Multi-stop gradient handling:** both of this file's decorative progress-bar gradients (2-stop and 3-stop) use the established "spread across amber rungs, don't flatten" idiom rather than a naive per-token substitution, which would have collapsed both to non-gradients. The 3-stop instance (Step 12) is explicitly flagged as a third occurrence of a string already fixed twice before in two other files, so an implementer doesn't skip it or copy the wrong zone's fix.
- **Font-weight sweep:** all 7 `font-extrabold` occurrences in the file were individually checked for `.font-display` pairing; 6 get the fix (Steps 3, 7, 9, 10, 11, 13), 1 (`claim-btn`) does not qualify and is explicitly left alone with its reasoning stated, rather than silently omitted.
