# Play Wave 6 — Rewards Center (`/rewards`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Play zone's design system (monochrome gold, Space Grotesk weight ceiling) to `/rewards` — `src/pages/RewardCenter.vue`, `src/components/rewards/DailyStreakCalendar.vue`, `src/components/rewards/RewardCard.vue`, `src/components/rewards/MonthlyPass.vue` — the SIXTH AND FINAL sub-wave of Zona Juego, completing the rollout Play Waves 1-5 built on shared infra, all 14 games, celebration overlays, and `/reto`.

**Architecture:** No new shared component. Pure recolor + font-weight fixes across 4 files. Two files in this cluster need ZERO edits and are excluded from the task list entirely: `src/components/rewards/PowerupIcon.vue` (confirmed by reading it — every glyph is drawn with `stroke="currentColor"`/inherits `fill`, it has no literal color class anywhere, it tints via whatever ring/text color wraps it) and `src/components/rewards/PassCosmetic.vue` (confirmed by reading it — its entire palette routes through `frameStyle()`/`bannerStyle()`/`rarity()` from `services/cosmetics.js`, a data-driven service, same category as Hub Wave 2's `ProfileHoverCard.vue` and Play Wave 2's `PassCosmetic.vue`-adjacent finding in Wave 3's survey). One correction to the original survey estimate: the route-backing file is `src/pages/RewardCenter.vue`, not under `components/rewards/` — confirmed via `router.js:37,92`.

**This wave has more exclusion reasoning than recolor instructions — read Global Constraints in full before touching any file.** As flagged by Play Wave 5's final reviewer, `/rewards` is a currency/progression surface where XP conventions, a free-vs-PRO track identity system, reward-type categorical color-coding, and pre-existing PRO/prestige gold all collide. The single biggest ruling this plan makes is protecting `MonthlyPass.vue`'s entire "Gratis = emerald / PRO = amber" dual-track color-coding as a load-bearing semantic system, not decorative chrome — see Global Constraints rule 3.

**Tech Stack:** Vue 3 (Options API in `RewardCenter.vue`/`DailyStreakCalendar.vue`/`RewardCard.vue`, `<script setup>` in `MonthlyPass.vue`), Tailwind CSS v4. Foundation + all 3 Hub waves + Play Waves 1-5 already merged to `main`. No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- **Color mapping** (the established rung ladder, reused here): `emerald-400`→`amber-300`, `emerald-500`→`amber-500`, `cyan-400`/`cyan-500`→ fold into the amber family (never a second hue). **Never use `amber-400`** anywhere — it's the rung reserved for `--mb-prestige`/`--accent-gold` (a semantic reservation, not a hex-identity claim). This is the single most common mistake across the whole initiative — triple-check every `emerald-400`/`cyan-400` mapping target in this wave.

- **Multi-stop mixed-hue decorative gradients**: where an old gradient mixes two different hues at the same-ish lightness for purely decorative purposes (not track-identity, not categorical — see rules below), spread across two different amber rungs preserving the original light→dark order, don't flatten to one repeated class. This wave has 2 such instances, both in `MonthlyPass.vue`'s standalone decorative washes (its teaser card background and its modal header background each end with a stray `to-cyan-500/[…]` stop that doesn't belong to the track-identity system — see Task 3 Steps 1 and 4).

- **Filled CTA gradient idiom**: `bg-gradient-to-r from-emerald-500 to-cyan-500` → `bg-gradient-to-r from-amber-500 to-amber-600`, `text-white`→`text-slate-900` (WCAG AA). This wave has 4 such buttons (RewardCenter's daily-claim button and challenge-claim button, RewardCenter's "Reclamar todo", RewardCard's claim button) — see each task.

- **Font weight**: every `.font-display` element combined with `font-extrabold`/`font-black` → `font-bold` (Space Grotesk ships only weights 600/700). Apply this **independently of color** — several instances below keep their protected color but still need the weight fix (this exact "weight and color are independent axes" gap caused Hub Wave 2's blocking final-review finding; do not skip a weight fix just because the element's color is staying untouched).

- **What must NOT be recolored, left exactly as-is — read every rule, this wave has more of these than any prior wave:**

  1. **Permanent possession/confirmation state** (the standard cross-zone rule, reused): a checkmark or label meaning "you already have/did this," not a call to action. In this wave: `RewardCenter.vue`'s "Reclamada" checkmark+label on the daily-reward card (line ~241, `text-emerald-400`) — the reward was already claimed, this is the possession semantic, not a claim-me highlight. `DailyStreakCalendar.vue`'s "played/claimed" chest-cell styling and checkmark (lines ~138-153, `bg-emerald-500/15 border-emerald-500/30` + `text-emerald-400` check icon) — a completed day, permanent. `MonthlyPass.vue`'s free-track "claimed" checkmark (line ~324, `text-emerald-400` "✓") — same semantic, doubled-protected by rule 3 below too.

  2. **Reward/XP-earned number text** — stays emerald, matching the app-wide `.xp-float` convention (`src/style.css:177-193`, `rgba(16,185,129,…)` = `emerald-500`/`emerald-400` family). Confirmed present in this wave at: `RewardCenter.vue`'s daily-challenge "+{{ c.reward_xp }} XP" (line ~278, `text-emerald-400`) and progressive-challenge "+{{ c.reward_xp }}" (line ~372, `font-display font-extrabold text-emerald-300` — **weight changes, color stays**, per the independent-axes rule). `MonthlyPass.vue`'s free-track reward-content XP numbers (lines ~304-313, `text-emerald-200`/`text-emerald-300`, one is `font-display font-extrabold` — **weight changes, color stays**) — these are additionally protected by rule 3 (track-identity) since their color is tied to which track they're in, not independently to the XP convention, but the outcome (protect) is the same either way.

  3. **`MonthlyPass.vue`'s free-vs-PRO dual-track color-coding — the wave's single biggest ruling, protect as a whole system, not per-instance.** This file's detail modal shows every reward tier as two parallel boxes: a FREE track (top) and a PRO track (bottom), and the ENTIRE free track is color-coded emerald while the ENTIRE PRO track is color-coded amber — legend dots+labels ("Gratis"/"PRO"), each tier's free-track container border/background (claimable vs. default state), the free-track claim button, the free-track's reward-content text (cosmetic name, powerup count, XP number), the free-track claimed-checkmark, and the footer caption's "Gratis"/"PRO" mentions — repeated once per pass tier, potentially dozens of times across the horizontal-scrolling track. **None of this is decorative brand chrome — it is the mechanism by which a player tells "this is what I get for free" apart from "this is what I get with PRO" at a glance, all the way down the track.** Recoloring the free track's emerald to amber would make it visually collide with the PRO track directly below it in the same column, destroying the one piece of information this whole UI section exists to convey. This is the same category of finding as Play Wave 3's `HigherOrLower.vue` Mayor/Menor buttons and `Connections.vue`'s `GROUP_COLORS`, and Hub Wave 2's `TIER_TINT` — a color system doing real semantic work, left untouched as a set regardless of which literal hue each side happens to use. **Only the font-weight fixes inside this block still apply** (rule above) — never the color.
     - Exact locations, all PROTECTED (zero diff expected): free-track legend dot+label (`bg-emerald-400`/`text-emerald-300` "Gratis", paired with PRO's amber "· {{n}} cosmético…"); free-track tier-box border/bg for both `claimable` and default states (`border-emerald-400/50 bg-emerald-500/[0.08]` / `border-emerald-500/15 bg-emerald-500/[0.03]`); free-track reward-content (cosmetic-name `text-emerald-200`, powerup-qty `text-emerald-300`, XP-number `text-emerald-300` + its `font-extrabold`), free-track claim button (`from-emerald-500 to-cyan-500 text-white` "Reclamar" — **this exact string looks identical to the generic filled-CTA idiom named above, but it is NOT that idiom here — it is the free-track's own identity color and must stay untouched**, the one place in this whole plan where the filled-CTA-gradient mapping rule does NOT apply); free-track claimed state (`text-emerald-400` "✓"); footer caption's "Gratis" mention (`text-emerald-300`).

  4. **`RewardCard.vue`'s reward-type categorical color system — protect as a whole, same reasoning as rule 3.** The `icon()` computed property (script block) maps 5 reward types to 5 distinct colors — `achievement`→`emerald`, `milestone`→data-driven (`reward.data?.color`, defaults `amber`), `levelUp`→`yellow`, `streak`→`orange`, default (unknown type)→`cyan` — and the template's `borderColor()` computed + the icon-tile's inline `:class="{ 'bg-emerald-500/15': icon.color === 'emerald', … }"` bindings read straight from it. This exists so a player can tell an achievement-reward card apart from a level-up-reward card apart from a mystery-reward card at a glance in a scrolling list. Recoloring only `emerald`→`amber` would make achievement-cards visually collide with milestone-cards (already amber by default). Left untouched as a whole — the entire `icon()` computed, `borderColor()` computed, and every template class binding that reads `icon.color`. (Also doubly out of scope for `icon()` itself since it's `<script>`-block content.) **The one thing in this file that is NOT part of this system**: the claim button's `bg-gradient-to-r from-emerald-500 to-cyan-500` is a fixed CTA applied to every reward card regardless of `icon.color` — that recolors normally, see Task 2.

  5. **Free-play "claim-me-now" attention highlights — decorative, DO recolor, distinguished from rule 1's possession states by being transient/pre-claim rather than permanent/post-claim.** `RewardCenter.vue`'s daily-reward-card AVAILABLE state (border/bg gradient + icon tile + "Recompensa diaria" label, lines ~208-223 — note this is the OPPOSITE state from rule 1's "Reclamada," i.e. before vs. after claiming) and its "Retos diarios" per-challenge "ready to claim" border/bg (line ~266-268, `c.progress >= c.target` branch). `DailyStreakCalendar.vue`'s `canClaim` chest-cell state (today, ready to open — lines ~140-141/157-161, `bg-emerald-500/20 border-2 border-emerald-400/60` + gift icon `text-emerald-300`) and its matching per-day XP label in the `canClaim` branch (line ~179, `text-emerald-300`) — **ruled distinct from the adjacent `played`/`claimed` branch (rule 1, protected) precisely because it's the transient "come get it" state, not the permanent "you got it" state; recoloring only this branch to gold is intentional and creates a coherent cross-wave pattern where every "ready to claim" highlight in this whole redesign (RewardCenter's daily card, MonthlyPass's "N para reclamar" badge, this cell) reads as gold, while every "already claimed" indicator reads as emerald.** `MonthlyPass.vue`'s "{{n}} para reclamar" teaser badge (line ~169) — same convention, not track-specific (a single summary count regardless of which track has claimables).

  6. **Pre-existing amber/yellow/orange never touched, full stop, regardless of internal shade consistency.** `MonthlyPass.vue`'s progress-bar gradient (`from-amber-400 via-yellow-300 to-amber-500`, appearing twice) mixes amber and yellow — this was investigated specifically (the survey flagged `MonthlyPass.vue` as needing this check) and ruled OUT of scope: `yellow-300` was never part of the emerald/cyan mapping, and every prior wave's rule is "pre-existing amber gets zero shade-normalization" — that rule extends to amber-adjacent yellow too, this wave doesn't get to be the exception. Also untouched: the "PRO"-branded chrome throughout (badges, locked-tier CTA, "Desbloquear PRO" button, PRO-track box borders/content — already amber/orange, i.e. `from-amber-500 to-orange-500`, `text-black` on the locked-PRO CTA notwithstanding — these predate the redesign and were never emerald/cyan); `RewardCenter.vue`'s progressive-challenge tier badge and progress bar (`amber-500`/`orange-400`, already amber); the "Mejor racha"/best-streak footer in `DailyStreakCalendar.vue` (`text-amber-400`); `RewardCenter.vue`'s "nunca terminan"/"más grande" emphasis text (`text-amber-300`).

  7. **`RewardCard.vue`'s `timeAgo`/`subtitle` and other plain white/slate text** — never emerald/cyan.

- **Surface migration — this is the zone's final revisit point, and the answer is "no change needed," not "broaden."** Play Wave 1's controller ruling kept surface-class migration to exactly 2 sanctioned patterns (literal `class="card"`; the exact `bg-slate-900/60-70 + backdrop-blur-md` "floating card" shade+blur combination) and deferred broadening it until the whole zone was visible. This wave is that revisit point — all 4 files were read in full and neither pattern appears anywhere in them. `RewardCenter.vue`'s tab strip uses `bg-slate-900/80 backdrop-blur` (a different opacity, and a nav strip, not an elevated card). `MonthlyPass.vue`'s modal uses a hand-rolled 3-stop `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900` (the same pattern every prior wave has correctly excluded). No file uses literal `class="card"`. **Conclusion: across all 6 Play waves, no file in Zona Juego ever matched the 2 sanctioned patterns closely enough to migrate — the narrow scope was correct as originally set, it never needed broadening, and there is nothing to do here.** No surface-class task this wave.

- Do not touch `<script>`-block logic (claim/load/save flows, the `RewardCard.vue` `icon()`/`borderColor()` computeds discussed above, `MonthlyPass.vue`'s tier-state/reward-lookup functions, `DailyStreakCalendar.vue`'s countdown timer and localStorage-scoping logic) anywhere in this wave — templates/styles only, same constraint as every prior wave.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse `--play-400/500/600` via the `amber-300`/`amber-500`/`amber-600` Tailwind classes — do not invent new Play-zone tokens or introduce a second hue.
- **Do not resolve the Fichas/Balón de Oro currency-color question.** This cluster does not render Fichas/Balón-de-oro currency chips or `CurrencyIcon`-style UI at all (confirmed by reading all 4 files — `MonthlyPass.vue`'s currency is abstracted to a single "points" number, not a Fichas/Balón split), so this decision (deferred since Hub Wave 3, still pending an explicit owner call) simply does not arise in this wave. Not resolved, not re-litigated, just genuinely out of scope here.

---

## Task 1: Migrate `RewardCenter.vue` to the Play design system

**Files:**
- Modify: `src/pages/RewardCenter.vue`

**Interfaces:** none (standalone routed page — `/rewards`, `meta.zone: 'play'` already set in `router.js:92` — no props/emits change).

- [ ] **Step 1: Page title — font-weight only**

Find:
```html
        <h1 class="font-display font-extrabold text-white text-xl">Recompensas</h1>
```
Replace with:
```html
        <h1 class="font-display font-bold text-white text-xl">Recompensas</h1>
```
Leave the header icon tile (`bg-amber-500/15 border border-amber-500/30 text-amber-300`) untouched — already amber, Global Constraints rule 6.

- [ ] **Step 2: Tab bar active-state background + ring**

Find:
```html
          :class="activeTab === t.key ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white ring-1 ring-emerald-400/30' : 'text-slate-400 hover:text-slate-200'"
```
Replace with:
```html
          :class="activeTab === t.key ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-white ring-1 ring-amber-300/30' : 'text-slate-400 hover:text-slate-200'"
```
Per the multi-stop rule, the two mixed hues spread across two amber rungs; the ring uses the separate `emerald-400`→`amber-300` rung.

- [ ] **Step 3: Tab count badge**

Find:
```html
            class="absolute -top-1 -right-1 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none ring-2 ring-slate-900"
```
Replace with:
```html
            class="absolute -top-1 -right-1 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none ring-2 ring-slate-900"
```

- [ ] **Step 4: Daily-reward card — AVAILABLE state (decorative "claim me" highlight), CLAIMED state untouched**

Find:
```html
        :class="dailyReward.available
          ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-cyan-500/5'
          : 'border-white/10 bg-white/[0.03]'"
```
Replace with:
```html
        :class="dailyReward.available
          ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-amber-600/5'
          : 'border-white/10 bg-white/[0.03]'"
```

- [ ] **Step 5: Daily-reward icon tile — available state**

Find:
```html
            :class="dailyReward.available ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-white/5 border-white/10 opacity-60'"
```
Replace with:
```html
            :class="dailyReward.available ? 'bg-amber-500/15 border-amber-300/30' : 'bg-white/5 border-white/10 opacity-60'"
```

- [ ] **Step 6: "Recompensa diaria" label**

Find:
```html
            <div class="text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">Recompensa diaria</div>
```
Replace with:
```html
            <div class="text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">Recompensa diaria</div>
```

- [ ] **Step 7: Daily-reward claim button — decorative CTA + WCAG AA fix**

Find:
```html
            class="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 text-white px-5 py-2.5 text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60"
            style="animation: claim-pulse 2s ease-in-out infinite"
          >
            Reclamar
          </button>
          <div v-else class="shrink-0 flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
```
Replace with:
```html
            class="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 text-slate-900 px-5 py-2.5 text-sm font-bold transition-all shadow-lg shadow-amber-500/25 disabled:opacity-60"
            style="animation: claim-pulse 2s ease-in-out infinite"
          >
            Reclamar
          </button>
          <div v-else class="shrink-0 flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
```
`text-white`→`text-slate-900` is the WCAG AA fix. The `<div v-else>` "Reclamada" branch (`text-emerald-400`) is the protected possession state (Global Constraints rule 1) — included in this Find/Replace only as unchanged context so the surrounding button text matches exactly; do not alter that line.

- [ ] **Step 8: Daily-challenge progress bar (2-stop decorative gradient)**

Find:
```html
                      class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
```
Replace with:
```html
                      class="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500"
```
(This exact string appears once in this file, in the daily-challenges section. `MonthlyPass.vue`'s progress bars use a different, already-amber 3-stop gradient — not the same instance, not touched here.)

- [ ] **Step 9: Daily-challenge claim button — decorative CTA + WCAG AA fix**

Find:
```html
              class="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-[0.98] text-white py-2 text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60"
            >
              Reclamar recompensa
            </button>
```
Replace with:
```html
              class="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-[0.98] text-slate-900 py-2 text-sm font-bold transition-all shadow-lg shadow-amber-500/25 disabled:opacity-60"
            >
              Reclamar recompensa
            </button>
```

- [ ] **Step 10: "All challenges done" celebration banner — border/background wash + clock note**

Find:
```html
        <div v-else-if="allChallengesDone" class="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] to-cyan-500/[0.04] p-8 text-center">
          <div class="text-4xl mb-3">🎉</div>
          <p class="font-display font-bold text-white">¡Completaste todos los retos de hoy!</p>
          <p class="text-sm text-slate-400 mt-1">Volvé mañana para nuevos desafíos.</p>
          <div class="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
```
Replace with:
```html
        <div v-else-if="allChallengesDone" class="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] to-amber-600/[0.04] p-8 text-center">
          <div class="text-4xl mb-3">🎉</div>
          <p class="font-display font-bold text-white">¡Completaste todos los retos de hoy!</p>
          <p class="text-sm text-slate-400 mt-1">Volvé mañana para nuevos desafíos.</p>
          <div class="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
```

- [ ] **Step 11: Progressive-challenge reward XP number — font-weight only, color stays**

Find:
```html
                <span class="font-display font-extrabold text-base leading-none text-emerald-300">+{{ c.reward_xp }}</span>
```
Replace with:
```html
                <span class="font-display font-bold text-base leading-none text-emerald-300">+{{ c.reward_xp }}</span>
```
This is the protected `.xp-float`-convention reward number (Global Constraints rule 2) — only the weight changes.

- [ ] **Step 12: "Pendientes" counter badge**

Find:
```html
            <span class="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
```
Replace with:
```html
            <span class="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
```

- [ ] **Step 13: "Reclamar todo" button — decorative CTA + WCAG AA fix**

Find:
```html
            class="rounded-lg px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
```
Replace with:
```html
            class="rounded-lg px-4 py-2 text-sm font-bold text-slate-900 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/25"
```

Leave completely untouched, per Global Constraints: the daily-challenge "+{{ c.reward_xp }} XP" text (`text-emerald-400`, rule 2), the "Reclamada" possession state (rule 1), the progressive-challenge tier badge/progress-bar/locked-state amber chrome (rule 6), "nunca terminan"/"más grande" text (rule 6).

- [ ] **Step 14: Verify no leftover brand-color references, confirm protected instances survived**

```bash
rg -n 'cyan' src/pages/RewardCenter.vue
```
Expected: zero matches (both `cyan` instances in this file were part of the 2-stop CTA/wash gradients this task recolors).

```bash
rg -n 'emerald' src/pages/RewardCenter.vue
```
Expected: exactly 3 matching lines — the "Reclamada" possession label (Step 7's unchanged context), the daily-challenge "+XP" text (rule 2), and the progressive-challenge XP number's color class (Step 11, weight changed but color line still shows `text-emerald-300`).

```bash
rg 'amber-400' src/pages/RewardCenter.vue
```
Expected: zero matches introduced by this task.

- [ ] **Step 15: Live verification**

With the dev server running and logged in, navigate to `/rewards`. Confirm: the page title, tab-bar active state, and tab count badges are gold. Switch to the "Diario" tab — confirm the daily-reward card (if available) glows gold, its icon tile and label are gold, and the claim button is a gold gradient with dark text; if already claimed, confirm the "Reclamada" checkmark is still emerald. Confirm any daily challenge's progress bar is a 2-tone gold gradient and its claim button (if ready) is gold — but its "+XP" reward text stays emerald. If all challenges are done, confirm the celebration banner is gold-themed. Switch to "Progresos" — confirm a progressive challenge's reward-XP number is still emerald (just less bold if you can tell). Switch to "Bandeja" — confirm the pending-count badge and "Reclamar todo" (if shown) are gold. No console errors. Paste actual observations. If Playwright MCP is unavailable, fall back to `curl`/HTTP-200 + the grep verification above as primary evidence.

- [ ] **Step 16: Commit**

```bash
git add src/pages/RewardCenter.vue
git commit -m "feat(play-zone): migrate RewardCenter.vue to Play accent"
```

---

## Task 2: Migrate `DailyStreakCalendar.vue` + `RewardCard.vue` to the Play design system

**Files:**
- Modify: `src/components/rewards/DailyStreakCalendar.vue`
- Modify: `src/components/rewards/RewardCard.vue`

**Interfaces:** none. Batched into one task per the subagent-driven-development "batch small same-shape work" guidance — both are small reward-surface components rendered inside `RewardCenter.vue`'s tabs, neither imports the other.

- [ ] **Step 1 (`DailyStreakCalendar.vue`): Header streak-count number**

Find:
```html
            <span class="text-emerald-400 font-semibold">{{ currentStreak }}</span> días consecutivos
```
Replace with:
```html
            <span class="text-amber-300 font-semibold">{{ currentStreak }}</span> días consecutivos
```

- [ ] **Step 2 (`DailyStreakCalendar.vue`): Countdown-timer icon + text**

Find:
```html
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-mono tabular-nums text-emerald-400 font-semibold">{{ timeLeft }}</span>
```
Replace with:
```html
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-mono tabular-nums text-amber-300 font-semibold">{{ timeLeft }}</span>
```
This SVG's `stroke="currentColor"` inherits from the parent `text-xs text-slate-400` wrapper, not from this span — it stays slate, unaffected by this change (only the span's own class changes).

- [ ] **Step 3 (`DailyStreakCalendar.vue`): "Today" day-label emphasis**

Find:
```html
          <span class="text-[10px] uppercase tracking-wider font-semibold" :class="day.isToday ? 'text-emerald-400' : 'text-slate-500'">
```
Replace with:
```html
          <span class="text-[10px] uppercase tracking-wider font-semibold" :class="day.isToday ? 'text-amber-300' : 'text-slate-500'">
```

- [ ] **Step 4 (`DailyStreakCalendar.vue`): Chest cell — `canClaim` state only, `played`/`claimed` state untouched**

Find:
```html
            :class="[
              day.played || day.claimed
                ? 'bg-emerald-500/15 border border-emerald-500/30'
                : day.canClaim
                  ? 'bg-emerald-500/20 border-2 border-emerald-400/60 hover:scale-105 cursor-pointer'
                  : day.isFuture
```
Replace with:
```html
            :class="[
              day.played || day.claimed
                ? 'bg-emerald-500/15 border border-emerald-500/30'
                : day.canClaim
                  ? 'bg-amber-500/20 border-2 border-amber-300/60 hover:scale-105 cursor-pointer'
                  : day.isFuture
```
Per Global Constraints rule 5: `canClaim` (today, not yet opened) is the transient "come claim it" highlight and recolors to gold; `played`/`claimed` (rule 1, permanent achievement) is untouched — confirm the `played || claimed` branch above is byte-identical before and after.

- [ ] **Step 5 (`DailyStreakCalendar.vue`): "Claimable" gift-icon color**

Find:
```html
            <template v-else-if="day.canClaim">
              <svg class="w-6 h-6 text-emerald-300" fill="currentColor" viewBox="0 0 24 24">
```
Replace with:
```html
            <template v-else-if="day.canClaim">
              <svg class="w-6 h-6 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
```
Leave the `played`/`claimed` checkmark SVG (`text-emerald-400`, the sibling `<template v-if>` just above this one) untouched — rule 1.

- [ ] **Step 6 (`DailyStreakCalendar.vue`): Per-day XP label — `canClaim` shade only**

Find:
```html
          <span class="text-[9px] font-semibold tabular-nums" :class="day.played || day.claimed ? 'text-emerald-400' : day.canClaim ? 'text-emerald-300' : 'text-slate-600'">
```
Replace with:
```html
          <span class="text-[9px] font-semibold tabular-nums" :class="day.played || day.claimed ? 'text-emerald-400' : day.canClaim ? 'text-amber-300' : 'text-slate-600'">
```
Same reasoning as Step 4 — the `played || claimed` branch (rule 1) stays emerald; only the `canClaim` branch (rule 5) recolors.

Leave completely untouched: the best-streak footer (`text-amber-400`, rule 6), the special-day-7 badge (`bg-yellow-500`, never emerald/cyan), the `.chest-pulse` scoped-CSS animation (references `claim-pulse`, no color of its own).

- [ ] **Step 7 (`RewardCard.vue`): Claim button — decorative CTA + WCAG AA fix**

Find:
```html
        class="rounded-lg px-3 py-1.5 text-xs font-display font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 transition-all"
```
Replace with:
```html
        class="rounded-lg px-3 py-1.5 text-xs font-display font-bold text-slate-900 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 transition-all"
```
`text-white`→`text-slate-900` is the WCAG AA fix. Already `font-bold` (not `font-extrabold`) — no weight change needed on this element. This is the ONE thing in `RewardCard.vue` that is NOT part of the protected reward-type categorical system (Global Constraints rule 4) — it's a fixed CTA applied regardless of `reward.type`.

Leave completely untouched, per Global Constraints rule 4: the entire `icon()` computed (script block — `achievement`→`emerald`, `milestone`→data-driven default `amber`, `levelUp`→`yellow`, `streak`→`orange`, default→`cyan`), the `borderColor()` computed, and every template class binding reading `icon.color` (the icon-tile background bindings and the card's border-color binding).

- [ ] **Step 8: Verify no leftover brand-color references, confirm protected instances survived**

```bash
rg -n 'cyan|emerald' src/components/rewards/DailyStreakCalendar.vue
```
Expected: exactly 6 matching lines remaining — the two `played || claimed` branches (Steps 4 and 6, each a ternary with the protected branch first), the two checkmark-icon lines (the `v-if` sibling of Step 5, and the day-label's non-today branch does NOT match — recount by reading, but the played/claimed checkmark SVG plus its bg/border class plus the two `text-emerald-400` instances in the per-day-XP and header-count/countdown ternaries' now-recolored form should show only the protected `emerald` tokens remaining). Read the file directly rather than trusting a specific number if this feels ambiguous — the authoritative check is: every remaining `emerald` instance must be inside a `day.played || day.claimed` branch or the streak-count/header (which were recolored — so should NOT show emerald anymore). If in doubt, diff each remaining match against Global Constraints rule 1's exact list.

```bash
rg -n 'cyan|emerald' src/components/rewards/RewardCard.vue
```
Expected: multiple matches, ALL inside the `icon()` computed, `borderColor()` computed, or the template's `icon.color === '…'` bindings (rule 4) — zero matches in the claim-button class string (Step 7 should have removed both).

```bash
rg 'amber-400' src/components/rewards/DailyStreakCalendar.vue src/components/rewards/RewardCard.vue
```
Expected: zero matches introduced by this task.

- [ ] **Step 9: Live verification**

With the dev server running, navigate to `/rewards` → "Diario" tab. Confirm: the streak-count number and countdown timer are gold, "hoy" 's day-label is gold. If today's chest is claimable, confirm it glows gold with a gold gift icon (not green); if you've already played today, confirm the checkmark cell is still emerald. Confirm the best-streak footer (if shown) is still amber. Navigate to "Bandeja" — if there are unclaimed rewards, confirm each `RewardCard`'s claim button ("+N XP") is a gold gradient with dark text, and that different reward types (achievement/milestone/level-up/streak, if you have a mix) still show visually distinct icon-tile colors from each other (not all uniformly recolored). No console errors. Paste actual observations.

- [ ] **Step 10: Commit**

```bash
git add src/components/rewards/DailyStreakCalendar.vue src/components/rewards/RewardCard.vue
git commit -m "feat(play-zone): migrate DailyStreakCalendar.vue + RewardCard.vue to Play accent"
```

---

## Task 3: Migrate `MonthlyPass.vue` to the Play design system

**Files:**
- Modify: `src/components/rewards/MonthlyPass.vue`

**Interfaces:** none. This is the plan's last task. **Most of this file's emerald usage is the protected free-vs-PRO track-identity system (Global Constraints rule 3) — read that rule in full before starting. Only 6 genuine recolor targets exist in this whole 404-line file; everything else in the "Comparativa" legend and the tier-track loop is a look-but-don't-touch reference for context, not something to edit.**

- [ ] **Step 1: Teaser-card decorative background wash — drop the stray cyan stop**

Find:
```html
    class="group relative w-full text-left overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.10] via-slate-900/60 to-cyan-500/[0.05] p-5 transition-all hover:border-amber-500/40 active:scale-[0.99]"
```
Replace with:
```html
    class="group relative w-full text-left overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.10] via-slate-900/60 to-amber-600/[0.05] p-5 transition-all hover:border-amber-500/40 active:scale-[0.99]"
```
This is the teaser card's OWN background wash (not per-tier, not track-identity) — the `to-cyan-500/[0.05]` stop is a leftover decorative mix, made monochrome per the Play-zone rule.

- [ ] **Step 2: Season-name heading (teaser card) — font-weight only**

Find:
```html
            <h2 class="font-display font-extrabold text-white text-lg leading-tight">{{ seasonName }}</h2>
```
Replace with:
```html
            <h2 class="font-display font-bold text-white text-lg leading-tight">{{ seasonName }}</h2>
```

- [ ] **Step 3: "N para reclamar" teaser badge — decorative claim-highlight**

Find:
```html
        <div v-if="claimableCount > 0" class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300" style="animation: claim-pulse 2s ease-in-out infinite">
```
Replace with:
```html
        <div v-if="claimableCount > 0" class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-300/40 px-2.5 py-1 text-[11px] font-bold text-amber-300" style="animation: claim-pulse 2s ease-in-out infinite">
```
This is a standalone summary badge (not per-track), Global Constraints rule 5 — decorative, recolors. `emerald-400`→`amber-300` per the established rung.

- [ ] **Step 4: Points display (teaser card) — font-weight only**

Find:
```html
            <span class="font-display font-extrabold text-2xl text-white tabular-nums">{{ points }}</span>
```
Replace with:
```html
            <span class="font-display font-bold text-2xl text-white tabular-nums">{{ points }}</span>
```

- [ ] **Step 5: "Sumás jugando" chip (teaser card) — decorative info chip**

Find:
```html
        <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-300">🏆 +3 ganar</span>
```
Replace with:
```html
        <span class="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-300">🏆 +3 ganar</span>
```
This is the first of TWO occurrences of this exact "+3 ganar" chip (teaser card). The second, inside the detail modal, is Step 7 below — a separate, independent instance in a different location, both get this same fix.

- [ ] **Step 6: Detail-modal header — decorative background wash, drop the stray cyan stop**

Find:
```html
            <div class="relative overflow-hidden rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-amber-500/[0.12] to-cyan-500/[0.06] p-5">
```
Replace with:
```html
            <div class="relative overflow-hidden rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-amber-500/[0.12] to-amber-600/[0.06] p-5">
```

- [ ] **Step 7: Season-name heading (modal header) — font-weight only**

Find:
```html
                  <h2 class="font-display font-extrabold text-white text-xl leading-tight">{{ seasonName }}</h2>
```
Replace with:
```html
                  <h2 class="font-display font-bold text-white text-xl leading-tight">{{ seasonName }}</h2>
```
This is a SEPARATE, independent instance of the "season name" heading from Step 2 — same text content, different location (modal header vs. teaser card), both need the weight fix independently.

- [ ] **Step 8: "Sumás jugando" chip (modal header) — second occurrence, decorative info chip**

Find:
```html
                    <span class="inline-flex items-center gap-1 text-emerald-300 font-semibold">🏆 +3 ganar</span>
```
Replace with:
```html
                    <span class="inline-flex items-center gap-1 text-amber-300 font-semibold">🏆 +3 ganar</span>
```
Note this modal-header instance has different surrounding markup than the teaser card's (Step 5) — no `bg-*`/`border-*`/pill classes, just the text color — apply exactly as shown here, don't reuse Step 5's fuller class string.

- [ ] **Step 9: Free-track reward XP number — font-weight only, color stays (protected track-identity)**

Find:
```html
                        <div class="font-display font-extrabold text-lg leading-none text-emerald-300">+{{ rewardFor(tier, 'free').xp }}</div>
```
Replace with:
```html
                        <div class="font-display font-bold text-lg leading-none text-emerald-300">+{{ rewardFor(tier, 'free').xp }}</div>
```
Per Global Constraints rule 3 — the color is load-bearing track-identity and stays exactly `text-emerald-300`; only the weight changes, per the independent-axes rule.

- [ ] **Step 10: PRO-track reward XP number — font-weight only (already amber, untouched color either way)**

Find:
```html
                        <div class="font-display font-extrabold text-lg leading-none text-amber-300">+{{ rewardFor(tier, 'premium').xp }}</div>
```
Replace with:
```html
                        <div class="font-display font-bold text-lg leading-none text-amber-300">+{{ rewardFor(tier, 'premium').xp }}</div>
```
This one was already amber (Global Constraints rule 6) — only the weight needed fixing, included here for completeness of the font-weight sweep.

Leave completely untouched, per Global Constraints rule 3 (the whole free-vs-PRO track-identity system): the "Comparativa" legend (both the emerald "Gratis" dot+label and the amber "PRO" dot+label), every per-tier free-track container border/background (`claimable` and default states), the free-track claim button (`from-emerald-500 to-cyan-500 text-white` — **do NOT apply the generic filled-CTA-gradient mapping rule here**, this is track-identity not a generic CTA), the free-track cosmetic-name label (`text-emerald-200`), the free-track claimed checkmark (`text-emerald-400`), and the footer caption's "Gratis" mention (`text-emerald-300`). Also leave untouched per rule 6: the progress-bar gradients (`from-amber-400 via-yellow-300 to-amber-500`, ×2), all PRO-track/locked-PRO/"Desbloquear PRO" amber-orange chrome, the tier-node circle (`bg-amber-500/20 border-amber-400/50`), and the "PRO" corner label.

- [ ] **Step 11: Verify no leftover brand-color references, confirm the track-identity system survived intact**

```bash
rg -n 'cyan' src/components/rewards/MonthlyPass.vue
```
Expected: zero matches (both stray `cyan` stops, Steps 1 and 6, are gone; the free-track claim button's `to-cyan-500` — Global Constraints rule 3 — was NEVER a `cyan-400`/`cyan-500` decorative-chrome instance in the mapping sense, but check it specifically: it MUST still read `from-emerald-500 to-cyan-500` unchanged, so if this grep returns zero matches for `cyan` entirely, that means the free-track button was WRONGLY touched — treat any `cyan` grep returning fewer than 1 match as a possible regression and inspect the free-track claim button by eye before concluding the task is correct).

```bash
rg -n 'emerald' src/components/rewards/MonthlyPass.vue
```
Expected: roughly a dozen-plus matches, ALL of them inside the free-track system (legend, container states, claim button, reward content, claimed checkmark, footer caption) — cross-check every match against the "leave completely untouched" list above. Zero matches should appear in the teaser card, the modal header, or either "Sumás jugando" chip (all three were recolored to amber in Steps 1/3/5/6/8).

```bash
rg 'amber-400' src/components/rewards/MonthlyPass.vue
```
Expected: same set of pre-existing matches as before this task (the right-side amber tier-node border, the PRO-track corner label, etc.) — zero NEW introductions.

```bash
rg 'font-extrabold' src/components/rewards/MonthlyPass.vue
```
Expected: zero matches — all 6 `font-extrabold` instances in this file (teaser heading, teaser points, modal-header heading, free-track XP number, PRO-track XP number, plus confirm there isn't a 6th you haven't accounted for by reading the file once more after this task) are now `font-bold`.

- [ ] **Step 12: Live verification**

With the dev server running, navigate to `/rewards` → "Pase" tab. Confirm the teaser card: gold background wash (no green tint), "N para reclamar" badge (if shown) is gold, points number renders (weight change may be subtle). Click to open the detail modal: confirm the header wash is gold, the "Sumás jugando" chip is gold. In the "Comparativa" legend, confirm "Gratis" is STILL emerald with an emerald dot, and "PRO" is still amber with an amber dot — these must look different from each other. Scroll the tier track: confirm every free-track box (top row) is still emerald-tinted and every PRO-track box (bottom row) is still amber-tinted, and that they remain visually distinguishable from each other at a glance. Confirm a free-track claim button (if any tier is claimable) is STILL the emerald→cyan gradient (not gold) — this is the one deliberate exception to the CTA-recolor rule. Confirm the locked-PRO / "Desbloquear PRO" chrome is unchanged (still amber/orange). No console errors. Paste actual observations — this task's live-verification is unusually important given how much of the file is "verify it did NOT change."

- [ ] **Step 13: Run build**

```bash
npm run build
```
Expected: clean build, no new errors (this is the plan's last task, so this doubles as the whole-branch build check).

- [ ] **Step 14: Commit**

```bash
git add src/components/rewards/MonthlyPass.vue
git commit -m "feat(play-zone): migrate MonthlyPass.vue to Play accent"
```

---

## Self-Review Notes

- **Spec coverage:** all 4 files needing edits are covered (3 tasks: `RewardCenter.vue` alone given its size; `DailyStreakCalendar.vue`+`RewardCard.vue` batched as same-shape small reward-surface components; `MonthlyPass.vue` alone given its density and the track-identity system requiring careful isolation). The 2 files needing zero edits (`PowerupIcon.vue`, `PassCosmetic.vue`) are explicitly named and reasoned about in the plan header, not silently omitted.
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code, copied verbatim from a fresh full read of all 4 files (and the 2 zero-edit files) during plan-writing.
- **Type/signature consistency:** no props, emits, or component interfaces change anywhere in this plan — template/class-only. All 3 tasks touch fully disjoint files, no cross-task dependency.
- **This wave's central judgment call, stated once here rather than repeated:** `MonthlyPass.vue`'s free-vs-PRO dual-track color system (Global Constraints rule 3) is this whole plan's most consequential ruling — it inverts the "recolor emerald→gold" default for roughly a dozen instances in one file, including one that looks byte-identical to the generic filled-CTA-gradient idiom used everywhere else in this initiative (the free-track's "Reclamar" button) but must NOT get that treatment here. Task 3's Step 11 verification specifically guards against an implementer "fixing" this by accident.
- **Two other categorical-color systems found and protected the same way**: `RewardCard.vue`'s 5-way reward-type icon-color map (Global Constraints rule 4) and the transient-vs-permanent claim-state distinction threaded through `RewardCenter.vue` and `DailyStreakCalendar.vue` (rules 1 vs. 5) — the latter is a genuinely new pattern this wave establishes (gold = "come claim this now," emerald = "you already claimed this") that reads as a coherent, deliberate visual language across every claim-related surface in this file cluster, not an arbitrary per-instance call.
- **Surface-scope revisit (flagged since Play Wave 1) resolved with "no change," not "broadened"**: after reading all 4 files in full, neither of the 2 sanctioned surface patterns appears anywhere in this final Zona Juego wave — the narrow scope set in Wave 1 turned out to be correct for the whole zone, confirmed rather than assumed.
- **Fichas currency-color question (deferred since Hub Wave 3) genuinely does not arise**: confirmed by reading all 4 files that none of them render Fichas/Balón-de-oro currency chips — `MonthlyPass.vue` abstracts its currency to a single "points" number. Not resolved, not re-litigated, simply out of scope.
- **Font-weight sweep**: every `.font-display`+`font-extrabold` instance across all 4 files was checked individually — `RewardCenter.vue` (2: page title, progressive-XP number), `DailyStreakCalendar.vue`/`RewardCard.vue` (0 — neither file has any `font-extrabold` at all, confirmed by reading both fully), `MonthlyPass.vue` (6: teaser heading, teaser points, modal-header heading, free-track XP number, PRO-track XP number — the last two demonstrate the "weight changes independently of protected color" rule in practice, not just in theory).
