# Data Wave 2 — Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `Leaderboards.vue`, `LeaderboardTable.vue`, and `PeriodTabs.vue` from their current emerald/cyan/violet decorative chrome to the Data-zone's monochrome-blue accent, established in Data Wave 1. `GameFilter.vue` is confirmed neutral and needs zero edits (documented, not a task).

**Architecture:** Pure template/scoped-CSS recolor, no `<script>` changes, no props/emits changes. Reuses Data Wave 1's established vocabulary in full (color mapping, filled-CTA idiom, font-weight-ceiling rule) — this wave does not invent new vocabulary, only applies it, with one narrow new ruling (extending `.surface-flat` to a ranked-list container, see Task 1).

**Tech Stack:** Vue 3 (`<script setup>` in `LeaderboardTable.vue`/`PeriodTabs.vue`, Options API in `Leaderboards.vue`), Tailwind CSS v4, Vite.

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md` (Data zone: pure-blue accent, `.surface-flat`). Precedent plan: `docs/superpowers/plans/2026-08-26-data-wave1-competitions-brackets.md` (all exact values below are copied from there, not re-derived).

## Global Constraints

- **Data-zone color mapping (from Data Wave 1, reuse verbatim):** `emerald-300`/`cyan-300`→`blue-300`, `emerald-400`/`cyan-400`→`blue-400`, `emerald-500`/`cyan-500`→`blue-500`. Monochrome — both hues collapse to the same rung.
- **New this wave: `violet-500`/`violet-300` (Hub-zone accent, found live in `Leaderboards.vue`, not part of the mapping table above since it's the wrong zone's color to begin with) maps the same way by rung: `violet-500`→`blue-500` (as part of the filled-CTA idiom below, not a bare swap), `violet-300`→`blue-300`.
- **Filled/solid CTA idiom (from Data Wave 1, reuse verbatim, do not use `-500`→`-600`):** `bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900` — computed contrast 7.02:1 / 4.85:1, both clear WCAG AA for normal-weight `text-sm` (this wave's buttons carry no `font-semibold`, same as the reference case — contrast math is independent of weight, only the "large text" size threshold would change the requirement, and 14px normal text does not qualify as large text).
- **`.surface-flat` (from `style.css:132-136`):** `border-radius: var(--mb-radius-md); background: var(--mb-900); border: 1px solid color-mix(in srgb, var(--data-500) 22%, transparent);` — no shadow, no blur. Data Wave 1 scoped this to exactly 4 genuine table/bracket containers. This wave adds ONE new target under the same reasoning (a literal ranked list, see Task 1) — do not broaden further than what Task 1 names.
- **Font-weight ceiling:** any element combining `.font-display` with `font-extrabold`/`font-black` must drop to `font-bold` (Space Grotesk ships only 600/700). Elements with `font-extrabold`/`font-black` WITHOUT `.font-display` are out of scope (Inter body text, supports the heavier weight natively) — do not "fix" those, that would be a regression. Sweep the WHOLE file for this, not just the enumerated instances below — this exact miss (an instance outside the plan's own enumerated list) is what Data Wave 1's final review caught in `CompetitionsHub.vue`.
- **Cascade-collision bug class — 3 known variants, know which applies before writing a fix:**
  1. `.surface-flat` is unlayered in `style.css`, always beats any `@layer utilities` Tailwind class regardless of specificity. If a task ever needs a *conditional* style on a `.surface-flat` element, it must go in a scoped, unlayered `<style>` rule (`color-mix(in srgb, var(--data-500) X%, transparent)` syntax), never a bare Tailwind utility stacked on the same element.
  2. A scoped rule with a `[data-v-xxx]` attribute selector can out-specificity a plain `.surface-flat` class even though both are unlayered — if converting an existing scoped-CSS card to `.surface-flat`, delete the scoped rule's competing `border`/`background`/`box-shadow` declarations entirely, don't just add the class alongside them.
  3. A Tailwind hover/state utility stacked on a `.surface-flat` element is invisibly dead in every state (not just at rest) — same fix as #1, but recognize the symptom (a hover effect that visually never fires).
  **This wave has no scoped-CSS cards and adds no new conditional/hover styling on `.surface-flat` elements** (Task 1's one `.surface-flat` addition is a static, unconditional container) — flagged here only so the implementer/reviewer recognize it if something surfaces, per the standing rule that new files always get this checked.
- **Protected/never-recolor categories confirmed present in this wave's files (verify zero diff on each):**
  - Medal/podium gold-silver-bronze color map (`LeaderboardTable.vue`'s `MEDAL` object) — a universal, real-world medal convention, zone-independent, same category as `KnockoutBracket.vue`'s `.kb-final` amber and Data Wave 1's protected win/loss-adjacent semantics.
  - Level-tier categorical color map (`LeaderboardTable.vue`'s `levelClass()` function) — a data-driven tier lookup (red≥30/orange≥20/amber≥10/else emerald-cyan gradient), same "never touch a tier map even if its own literal string happens to be emerald/cyan" rule established across every prior wave.
  - Top-3 gold ranking numbers in the peñas list (`Leaderboards.vue`, `idx < 3 ? 'text-amber-400' : 'text-slate-500'`) — same rank/achievement-gold convention as the medal map above.
  - The page header's trophy icon tile (`Leaderboards.vue`, `bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-400/25` + `text-amber-400` glyph) — a literal trophy, gold reinforces the "ranking/achievement" meaning regardless of which zone hosts the page, same category as `CompetitionsHub.vue`'s amber Mundial banner staying untouched inside an otherwise-migrated Data-zone page.

---

## Task 1: Migrate Leaderboards.vue

**Files:**
- Modify: `src/pages/Leaderboards.vue:152-153` (view-switch tab buttons), `src/pages/Leaderboards.vue:189` (peñas ranked-list container), `src/pages/Leaderboards.vue:199` (peñas total-XP text)

**Interfaces:** None — template/class-only changes, no props/emits/script changes. `Leaderboards.vue` renders `LeaderboardTable`, `PeriodTabs`, `GameFilter` as child components (Task 2 covers `LeaderboardTable.vue`/`PeriodTabs.vue`'s own internals) but passes no new props and expects no new emits from either.

**Ruling this task establishes:** the peñas ranked-list container (Step 3 below) is not one of Data Wave 1's 4 named `.surface-flat` targets, but it is functionally a ranking list — the same kind of "densidad/legibilidad" content the spec's `.surface-flat` description names ("tablas y brackets"). Treat a literal ranked/scored list the same as a table for this narrow purpose. Do not extend this reasoning to any OTHER container in this wave or a future one without a fresh ruling — this is a one-time, named exception, not a broadened rule.

- [ ] **Step 1: Recolor the "Jugadores" view-switch button**

In `src/pages/Leaderboards.vue`, find (line 152):
```html
      <button @click="switchView('players')" :class="['px-3 py-1.5 text-sm rounded-lg transition', view==='players' ? 'bg-violet-500 text-white' : 'text-slate-300 hover:text-white']">Jugadores</button>
```
Replace with:
```html
      <button @click="switchView('players')" :class="['px-3 py-1.5 text-sm rounded-lg transition', view==='players' ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900' : 'text-slate-300 hover:text-white']">Jugadores</button>
```

- [ ] **Step 2: Recolor the "Peñas" view-switch button**

In the same file, find (line 153):
```html
      <button @click="switchView('penias')" :class="['px-3 py-1.5 text-sm rounded-lg transition', view==='penias' ? 'bg-violet-500 text-white' : 'text-slate-300 hover:text-white']">Peñas</button>
```
Replace with:
```html
      <button @click="switchView('penias')" :class="['px-3 py-1.5 text-sm rounded-lg transition', view==='penias' ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900' : 'text-slate-300 hover:text-white']">Peñas</button>
```

- [ ] **Step 3: Apply `.surface-flat` to the peñas ranked-list container**

In the same file, find (line 189):
```html
        <div v-else class="rounded-2xl border border-white/10 divide-y divide-white/5 overflow-hidden">
```
Replace with:
```html
        <div v-else class="surface-flat divide-y divide-white/5 overflow-hidden">
```
(`.surface-flat` supplies `border-radius`/`background`/`border` — the old `rounded-2xl border border-white/10` is dropped as redundant, matching Data Wave 1's collision-avoidance rule. `divide-y divide-white/5` and `overflow-hidden` stay, they're unrelated utility classes, not part of the old surface treatment.)

- [ ] **Step 4: Recolor the peñas total-XP text**

In the same file, find (line 199):
```html
            <div class="text-sm font-bold text-violet-300 tabular-nums shrink-0">{{ p.totalXp.toLocaleString('es-AR') }} XP</div>
```
Replace with:
```html
            <div class="text-sm font-bold text-blue-300 tabular-nums shrink-0">{{ p.totalXp.toLocaleString('es-AR') }} XP</div>
```

- [ ] **Step 5: Verify no other violet/emerald/cyan brand-chrome instance was missed**

Run: `grep -n "violet-\|emerald-\|cyan-" src/pages/Leaderboards.vue`
Expected: zero matches. (The protected `amber-400`/`amber-500` trophy-icon and top-3-ranking instances are a different color family and correctly still present — this check is only for the violet/emerald/cyan families this task was responsible for.)

- [ ] **Step 6: Verify the font-weight ceiling holds (whole-file sweep, not just named instances)**

Run: `grep -n "font-extrabold\|font-black" src/pages/Leaderboards.vue`
Expected: zero matches (the file's one `.font-display` element, the `<h1>` at line 147, was already `font-bold` before this task — confirm it's still `font-bold`, not touched).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exits 0, no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Leaderboards.vue
git commit -m "feat(data-zone): migrate Leaderboards.vue to Data accent + surface-flat"
```

---

## Task 2: Migrate LeaderboardTable.vue + PeriodTabs.vue

**Files:**
- Modify: `src/components/leaderboard/LeaderboardTable.vue:63,68,78,88` (font-weight ceiling ×2, "this is you" row-highlight recolor ×2)
- Modify: `src/components/leaderboard/PeriodTabs.vue:17` (active-tab filled CTA)

**Interfaces:** None — template-only changes in both files, no `<script setup>` changes, no props/emits changes. `PeriodTabs.vue` is consumed by both `Leaderboards.vue` (Task 1, already migrated by the time this task runs if executed in order, but the two tasks have no file overlap and can run in either order) and its own `v-model` contract is unchanged.

**Ruling this task establishes:** `LeaderboardTable.vue`'s "this is you" row highlight (`r.user_id === meId`) is not one of the app's established protected-forever categories (win/loss, possession/confirmation, online-presence, reward/XP text, tier maps) — it is a selection/current-context highlight, the same category Hub-zone treats with its active-state accent (`border-violet-400/50 bg-indigo-500/20`). It recolors to the current zone's accent. Verified: no other file in the app uses this exact `meId`/`isMe` highlight pattern (checked via `grep -rn "meId\|isMe" src --include="*.vue"` during plan-writing — the only real hits were this file and `Leaderboards.vue` itself, which doesn't render this specific highlight), so there is no cross-file convention this change could break.

- [ ] **Step 1: Fix font-weight ceiling on the podium rank badge**

In `src/components/leaderboard/LeaderboardTable.vue`, find (line 63):
```html
            <div class="absolute -top-2.5 -right-2.5 size-7 rounded-full grid place-items-center font-display font-extrabold text-sm bg-slate-950 border-2 border-slate-900 shadow-lg" :class="MEDAL[c.rank].text">{{ c.rank }}</div>
```
Replace with:
```html
            <div class="absolute -top-2.5 -right-2.5 size-7 rounded-full grid place-items-center font-display font-bold text-sm bg-slate-950 border-2 border-slate-900 shadow-lg" :class="MEDAL[c.rank].text">{{ c.rank }}</div>
```

- [ ] **Step 2: Fix font-weight ceiling on the podium total-XP number**

In the same file, find (line 68):
```html
            <div class="font-display font-extrabold text-white tabular-nums text-sm">{{ (c.r.total_xp || 0).toLocaleString() }}<span class="text-[9px] text-slate-500 ml-0.5">XP</span></div>
```
Replace with:
```html
            <div class="font-display font-bold text-white tabular-nums text-sm">{{ (c.r.total_xp || 0).toLocaleString() }}<span class="text-[9px] text-slate-500 ml-0.5">XP</span></div>
```

- [ ] **Step 3: Recolor the "this is you" row highlight**

In the same file, find (line 78):
```html
          :class="r.user_id === meId ? 'border-emerald-400/50 bg-emerald-500/[0.12]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'">
```
Replace with:
```html
          :class="r.user_id === meId ? 'border-blue-400/50 bg-blue-500/[0.12]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'">
```

- [ ] **Step 4: Recolor the "(vos)" label — same highlight system as Step 3, must move together**

In the same file, find (line 88):
```html
            {{ name(r) }}<span v-if="r.user_id === meId" class="text-[10px] text-emerald-300 ml-1 font-bold">(vos)</span>
```
Replace with:
```html
            {{ name(r) }}<span v-if="r.user_id === meId" class="text-[10px] text-blue-300 ml-1 font-bold">(vos)</span>
```

- [ ] **Step 5: Recolor the active period-tab button**

In `src/components/leaderboard/PeriodTabs.vue`, find (line 17):
```html
      :class="['px-3 py-1.5 text-sm rounded-lg transition', modelValue===opt.value ? 'bg-emerald-500 text-white' : 'text-slate-200 hover:text-white']">
```
Replace with:
```html
      :class="['px-3 py-1.5 text-sm rounded-lg transition', modelValue===opt.value ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900' : 'text-slate-200 hover:text-white']">
```

- [ ] **Step 6: Verify the protected MEDAL and levelClass() maps are untouched**

Run: `grep -n "MEDAL = {" -A 5 src/components/leaderboard/LeaderboardTable.vue` and `grep -n "function levelClass" -A 7 src/components/leaderboard/LeaderboardTable.vue`
Expected: both blocks byte-identical to their pre-task state (gold/slate/orange medal rungs; red/orange/amber/emerald-cyan tier gradient) — zero diff, confirming this task didn't touch either map while recoloring the surrounding template.

- [ ] **Step 7: Verify no other emerald/cyan instance was missed in either file**

Run: `grep -n "emerald-\|cyan-" src/components/leaderboard/LeaderboardTable.vue src/components/leaderboard/PeriodTabs.vue`
Expected: matches ONLY inside the `levelClass()` function body (the protected tier map's own literal `emerald-500`/`cyan-500` strings, confirmed unchanged by Step 6) — nothing else.

- [ ] **Step 8: Verify the font-weight ceiling holds (whole-file sweep)**

Run: `grep -n "font-extrabold\|font-black" src/components/leaderboard/LeaderboardTable.vue src/components/leaderboard/PeriodTabs.vue`
Expected: zero matches. (Line 56's `font-extrabold` — the avatar-initial glyph — has no `.font-display` on the same element and is correctly out of scope; confirm it's still present and untouched, not accidentally changed by this task.)

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: exits 0, no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/leaderboard/LeaderboardTable.vue src/components/leaderboard/PeriodTabs.vue
git commit -m "feat(data-zone): migrate LeaderboardTable.vue + PeriodTabs.vue to Data accent"
```

---

## Confirmed zero-edit: GameFilter.vue

`src/components/leaderboard/GameFilter.vue` was read in full during plan-writing: a native `<select>` with dark-theme scoped CSS (`color-scheme: dark`, `option { background-color: #0b1220 }`) and zero emerald/cyan/violet classes anywhere. No task needed — same category as `AppLoader.vue`/`PowerupIcon.vue` in prior waves (confirmed neutral, not silently skipped).

## Self-Review

- **Spec coverage:** all 3 files with real color content (`Leaderboards.vue`, `LeaderboardTable.vue`, `PeriodTabs.vue`) have tasks; `GameFilter.vue` confirmed neutral, documented above. Matches the survey's per-file breakdown.
- **Placeholder scan:** no TBD/TODO, every step has literal Find/Replace code, every verification step has an exact command and expected output.
- **Type/interface consistency:** no script-block or prop/emit changes anywhere in this plan — n/a.
- **Font-weight ceiling:** swept both files fully (not just the plan's own named instances) during plan-writing via `grep -n "font-extrabold\|font-black\|font-display"` — exactly 2 real violations found and both are in Task 2 Steps 1-2; the one non-`.font-display` `font-extrabold` (line 56) is correctly excluded and explicitly called out so no implementer "fixes" it by mistake.
- **Protected-category check:** verified against the standing checklist (win/loss, possession, presence, reward/XP text, tier maps, medal/rank-gold) — the MEDAL map and levelClass() tier map are the two real hits, both named and protected in Global Constraints and re-verified in Task 2 Step 6.
