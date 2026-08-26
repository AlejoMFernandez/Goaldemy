# Data Wave 3 — Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `src/pages/Teams.vue` and `src/pages/TeamPage.vue` from their remaining cyan/emerald/violet decorative chrome to the Data-zone's monochrome-blue accent. **This is the LAST wave of the entire "Midnight Broadcast" 3-zone redesign** — Hub and Play are both fully merged, and Data Waves 1-2 (Competitions/brackets, Leaderboards) are merged. Once this wave lands, the whole initiative is complete.

**Architecture:** Pure template recolor, no `<script>` changes, no props/emits changes. Reuses Data Wave 1/2's established vocabulary in full (color mapping, filled-CTA idiom) — one narrow new application of the idiom (Task 2's tab button), no new surface-migration ruling (see Global Constraints), and closes out one carry-forward item from Data Wave 2's final review.

**Tech Stack:** Vue 3 (Options API in `Teams.vue`, `<script setup>` in `TeamPage.vue`), Tailwind CSS v4, Vite.

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md` (Data zone: pure-blue accent, `.surface-flat`). Precedent plans: `docs/superpowers/plans/2026-08-26-data-wave1-competitions-brackets.md` (vocabulary origin), `docs/superpowers/plans/2026-08-26-data-wave2-leaderboards.md` (most recent reuse + the carry-forward item this wave closes).

## Global Constraints

- **Data-zone color mapping (from Data Wave 1, reuse verbatim):** `emerald-300`/`cyan-300`/`violet-300`→`blue-300`, `emerald-400`/`cyan-400`/`violet-400`→`blue-400`, `emerald-500`/`cyan-500`/`violet-500`→`blue-500`. Monochrome — every hue collapses to the same rung. Preserve whatever opacity/alpha suffix (`/10`, `/25`, `/80`, etc.) the original class already carries — swap only the color name, never the alpha.
- **Filled/solid CTA idiom (from Data Wave 1, reuse verbatim):** `bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900` — WCAG-verified 7.02:1 / 4.85:1, both clear AA for normal-weight text up to `text-sm`. Do not use a flat `-600` solid fill with white text — Data Wave 1 already proved that range fails AA at the darker end, and this wave has one real instance of that exact anti-pattern to fix (Task 2, Step 1).
- **`.surface-flat` — NO new application this wave, ruling explained below, do not re-litigate:** Data Wave 1 named 4 genuine table/bracket containers; Data Wave 2 extended it once, narrowly, to a literal ranked list. This wave's two files were read in full during plan-writing. `TeamPage.vue`'s "Squad" tab (`teamData.squad.squad`, a compact player-row list) is structurally similar to Wave 2's ranked-list exception, but **this wave does NOT extend `.surface-flat` to it** — every one of `TeamPage.vue`'s ~11 tab-content containers uses the identical `bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10` treatment (a consistent in-file design language across Overview/Fixtures/Lineup/Squad/Stats/Peña), and giving only the Squad container `.surface-flat` (different radius, no blur, no shadow) would make ONE tab look structurally different from the other five when a user switches between them — a worse in-file inconsistency than the aesthetic gain. Neither file's containers match either sanctioned narrow surface-migration pattern anyway (not a literal `.card`, not the `bg-slate-900/60-70 + backdrop-blur-md` 2-value pattern — both files use `slate-800/50` + `backdrop-blur-sm`, different on both axes). Hold the line; if a future pass wants to unify `TeamPage.vue`'s surface language, that's a dedicated decision, not a byproduct of this recolor wave.
- **Mandatory carry-forward item from Data Wave 2's final review**: `TeamPage.vue:434` has a still-violet "this is you" row highlight (`m.userId === meId ? 'bg-violet-500/10 border border-violet-400/25' : ''`) on the Peña tab's ranked member list — structurally the same feature Data Wave 2 already migrated in `LeaderboardTable.vue`. This MUST be recolored in this wave (Task 2, Step 8) — do not miss it a second time.
- **Font-weight ceiling:** `.font-display` + `font-extrabold`/`font-black` → `font-bold`. Swept both files in full during plan-writing (`grep -n "font-extrabold\|font-black\|font-display"`): `Teams.vue` has zero hits of any kind. `TeamPage.vue` has exactly one `font-black` (line 270, the tactical-pitch shirt-number glyph) — confirmed it and its entire ancestor chain up to the tab-content wrapper carry no `.font-display` class, so no inherited `font-family` reaches it either; it renders Inter at 800, which Inter supports natively. **Correctly out of scope, do not touch it.**
- **Protected/never-recolor categories confirmed present in this wave's files (verify zero diff on each):**
  - **`playerPosColor()` categorical position map** (`TeamPage.vue`, script `playerPosColor()` function + its template Legend, lineup tab) — a real 4-member categorical system: GK=`amber-500/80`, DEF=`blue-500/80`, MF=`violet-500/80`, FW=`rose-500/80`, rendered both on the tactical-pitch player circles and in the Legend strip below it. **`violet-500/80` here is NOT decorative chrome — it is one distinct member of a fixed 4-color legend.** Recoloring it to blue would make MF and DEF render as the exact same color on the pitch, a real functional regression (two different positions become visually indistinguishable), not just an aesthetic slip. Leave both the function (script) and the Legend markup (template) completely untouched.
  - Win/loss/draw colors throughout `TeamPage.vue` (header quick-stats `text-green-500`/`text-gray-400`/`text-red-500`; recent-form result badges `bg-green-500/20 text-green-500` W / `bg-gray-500/20 text-gray-400` D / `bg-red-500/20 text-red-500` L; league-position W/D/L numbers) — plain `green`/`gray`/`red`, not `emerald`, the same doubly-protected win/loss semantic established since Hub Wave 1.
  - Live-match indicator (`TeamPage.vue`, Fixtures tab, "EN VIVO" pulse-dot + red score) — same cross-app live semantic protected in every Data wave so far.
  - Player-rating amber badge (`TeamPage.vue`, lineup tab, `text-amber-400 border-amber-400/20`) — achievement/rating-gold convention, never touched.
  - `Teams.vue`'s `transferValue` `text-green-400` — a positive-value/financial indicator, plain `green` not `emerald`, doubly-protected same as the goal-difference pattern from Data Wave 1.
  - Tactical-pitch background `style="background:oklch(0.27 0.07 155)"` (`TeamPage.vue`, lineup tab) — real-world representational color (football pitch green), same category as Play Wave 3's pitch background, never a mapping target.
  - `Teams.vue`'s already-correct `blue-400`/`blue-500` hover accents (card border/shadow hover, group-hover text) — already the right hue, not part of this task's edits, left as-is (not "protected" in the semantic sense, just already done).
  - `AppLoader.vue` (imported by `Teams.vue`) — cross-cutting shared primitive used across zones, correctly out of scope, same deferral as every prior wave.
- Do not touch `<script>`-block logic anywhere in this wave — templates only.
- Every task must leave `npm run build` clean with no new errors.

---

## Task 1: Migrate `Teams.vue`

**Files:**
- Modify: `src/pages/Teams.vue:32` (league-filter select focus ring), `:95` (grid-view league-name caption), `:138` (list-view league-name caption)

**Interfaces:** None — template/class-only changes, no props/emits/script changes.

**Note on scope:** `Teams.vue` already uses `blue-600`/`blue-500`/`blue-400` extensively for its view-mode toggle buttons (lines 46, 60), player shirt-number badges (line 170), and card hover accents (lines 84, 93, 159, 165) — none of that is `emerald`/`cyan`/`violet`, so none of it is a mapping target and none of it is touched by this task. (The view-toggle buttons and shirt-number badge use a flat `bg-blue-600 text-white` fill that is the same shape of pattern Data Wave 1 proved fails WCAG AA for the `-500→-600` range — likely also failing here — but this predates the redesign entirely and recoloring it would be scope creep beyond the emerald/cyan/violet mapping this wave is chartered to close out. Flagged below under Deferred, not fixed in this task.)

- [ ] **Step 1: Recolor the league-filter select's focus ring**

In `src/pages/Teams.vue`, find (line 32):
```html
                        <select
                            v-model="selectedLeague"
                            class="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
```
Replace with:
```html
                        <select
                            v-model="selectedLeague"
                            class="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
```

- [ ] **Step 2: Recolor the grid-view league-name caption**

In the same file, find (line 95, 28 spaces of leading indent):
```html
                            <p class="text-xs text-cyan-300 mt-1">{{ getTeamLeagueName(team.id) || 'Liga sin asignar' }}</p>
```
Replace with:
```html
                            <p class="text-xs text-blue-300 mt-1">{{ getTeamLeagueName(team.id) || 'Liga sin asignar' }}</p>
```

- [ ] **Step 3: Recolor the list-view league-name caption**

In the same file, find (line 138, 32 spaces of leading indent — one level deeper than Step 2's line, NOT byte-identical to it, match this line's own indentation):
```html
                                <p class="text-xs text-cyan-300 mt-1">{{ getTeamLeagueName(team.id) || 'Liga sin asignar' }}</p>
```
Replace with:
```html
                                <p class="text-xs text-blue-300 mt-1">{{ getTeamLeagueName(team.id) || 'Liga sin asignar' }}</p>
```

- [ ] **Step 4: Verify no other cyan/emerald/violet instance was missed**

Run: `grep -n "cyan-\|emerald-\|violet-" src/pages/Teams.vue`
Expected: zero matches.

- [ ] **Step 5: Verify the font-weight ceiling holds**

Run: `grep -n "font-extrabold\|font-black" src/pages/Teams.vue`
Expected: zero matches (confirmed zero during plan-writing; this step just re-confirms nothing regressed).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: exits 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Teams.vue
git commit -m "feat(data-zone): migrate Teams.vue to Data accent"
```

---

## Task 2: Migrate `TeamPage.vue`

**Files:**
- Modify: `src/pages/TeamPage.vue:84` (tab active-state, filled-CTA idiom), `:185` (league-position number), `:210` (stadium icon), `:240` (lineup formation text), `:307` (squad group-header accent bar), `:339` (squad-row goals stat), `:418` (Peña tab icon), `:434` (Peña "this is you" row highlight — **mandatory carry-forward from Data Wave 2**), `:440` (Peña XP text)

**Interfaces:** None — template-only changes, no `<script setup>` changes, no props/emits changes. Imports and renders the already-migrated `PeriodTabs.vue` (Data Wave 2) with no prop changes needed — its `v-model="peniaPeriod"` usage is untouched.

**Ruling this task closes out**: Data Wave 2's final review found that its own supporting evidence for the `meId` "this is you" ruling was incomplete — it missed this exact file. The same ruling still applies here: this highlight is a selection/current-context accent (not a protected win/loss/possession/presence/reward-XP/tier category), verified again by reading the surrounding row template (`:431-441`) — the only other styled elements in the row are the rank number (`amber-400`/`slate-500`, protected top-3-gold, untouched), the avatar, and the display name, none of which ride on the `meId` conditional. Recolors as a selection accent, same as `LeaderboardTable.vue:78`.

- [ ] **Step 1: Recolor the tab active-state to the filled-CTA idiom**

In `src/pages/TeamPage.vue`, find (line 84):
```html
            :class="activeTab === tab.id 
              ? 'bg-cyan-600/90 text-white' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'"
```
Replace with:
```html
            :class="activeTab === tab.id 
              ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-slate-900' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'"
```
(This is a real `cyan`-family instance, not a bare rung-swap — `bg-cyan-600/90 text-white` is a flat dark solid fill with white text, the same anti-pattern Data Wave 1 proved fails WCAG AA. Use the established idiom instead of a naive `cyan-600`→`blue-600` swap, which would just recreate the same accessibility failure in a new hue.)

- [ ] **Step 2: Recolor the league-position number**

In the same file, find (line 185):
```html
                <div class="text-5xl font-bold text-cyan-400 mb-2">{{ tablePosition.idx }}</div>
```
Replace with:
```html
                <div class="text-5xl font-bold text-blue-400 mb-2">{{ tablePosition.idx }}</div>
```

- [ ] **Step 3: Recolor the stadium icon**

In the same file, find (line 210):
```html
                <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
```
Replace with (only the class attribute's color token changes, the `viewBox`/`path` stay identical):
```html
                <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
```

- [ ] **Step 4: Recolor the lineup formation text**

In the same file, find (line 240):
```html
              <span class="text-sm text-slate-400">Formación: <span class="text-cyan-400 font-bold">{{ lastLineup.formation }}</span></span>
```
Replace with:
```html
              <span class="text-sm text-slate-400">Formación: <span class="text-blue-400 font-bold">{{ lastLineup.formation }}</span></span>
```

- [ ] **Step 5: Recolor the squad group-header accent bar**

In the same file, find (line 307):
```html
                  <span class="w-0.5 h-4 rounded-full bg-emerald-500 flex-shrink-0"></span>
```
Replace with:
```html
                  <span class="w-0.5 h-4 rounded-full bg-blue-500 flex-shrink-0"></span>
```

- [ ] **Step 6: Recolor the squad-row goals stat**

In the same file, find (line 339):
```html
                    <span v-if="player.goals > 0" class="text-[11px] text-emerald-400 font-semibold">⚽{{ player.goals }}</span>
```
Replace with:
```html
                    <span v-if="player.goals > 0" class="text-[11px] text-blue-400 font-semibold">⚽{{ player.goals }}</span>
```
(The adjacent assists span on the next line, `text-[11px] text-blue-400 font-semibold">🅰️{{ player.assists }}`, is already blue — do not touch it, it needs no change. This mirrors Data Wave 1's `CompetitionPage.vue` precedent, where both the Goleadores and Asistidores stat numbers were recolored to the same blue rung.)

- [ ] **Step 7: Recolor the Peña tab icon**

In the same file, find (line 418):
```html
              <svg class="w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg>
```
Replace with (only the class attribute's color token changes):
```html
              <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg>
```

- [ ] **Step 8: Recolor the Peña "this is you" row highlight — mandatory carry-forward from Data Wave 2**

In the same file, find (line 434):
```html
              :class="m.userId === meId ? 'bg-violet-500/10 border border-violet-400/25' : ''"
```
Replace with:
```html
              :class="m.userId === meId ? 'bg-blue-500/10 border border-blue-400/25' : ''"
```
(Alpha values `/10` and `/25` are preserved exactly as this file already had them — this is a rung-swap, not an adoption of `LeaderboardTable.vue`'s own different alpha values from Data Wave 2.)

- [ ] **Step 9: Recolor the Peña XP text**

In the same file, find (line 440):
```html
              <span class="text-sm font-bold text-violet-300 tabular-nums shrink-0">{{ m.xp.toLocaleString('es-AR') }} XP</span>
```
Replace with:
```html
              <span class="text-sm font-bold text-blue-300 tabular-nums shrink-0">{{ m.xp.toLocaleString('es-AR') }} XP</span>
```

- [ ] **Step 10: Verify no other cyan/emerald/violet instance was missed OUTSIDE the protected position map**

Run: `grep -n "cyan-\|emerald-\|violet-" src/pages/TeamPage.vue`
Expected: exactly 2 matches remaining, both inside the protected `playerPosColor()` categorical map — one in the template Legend (`bg-violet-500/80`, the "MED" legend dot) and one in the `<script setup>` function itself (`return 'bg-violet-500/80' // MF`). If either of these two is missing (i.e. fewer than 2 matches), or if any match is NOT one of these two specific lines, stop and investigate — do not "fix" the categorical map, and do not assume extra matches are fine without checking what they are.

- [ ] **Step 11: Verify the protected categorical position map and win/loss colors are untouched**

Run: `grep -n "playerPosColor\|bg-amber-500/80\|bg-rose-500/80" src/pages/TeamPage.vue` and separately `grep -n "text-green-500\|text-red-500\|bg-green-500/20\|bg-red-500/20" src/pages/TeamPage.vue`
Expected: both commands return output identical to the file's pre-task state (the 4-member position legend's amber/blue/violet/rose members all present, the win/loss/draw color scheme in the header stats and recent-form badges all present) — confirming this task's edits didn't collaterally touch either protected system.

- [ ] **Step 12: Verify the font-weight ceiling holds**

Run: `grep -n "font-extrabold\|font-black" src/pages/TeamPage.vue`
Expected: exactly one match, line 270 (`font-black`, the tactical-pitch shirt-number glyph) — confirmed pre-existing and out of scope (no `.font-display` on that element or its ancestors) during plan-writing; this step re-confirms it's still there and nothing new was introduced.

- [ ] **Step 13: Build**

Run: `npm run build`
Expected: exits 0, no errors.

- [ ] **Step 14: Commit**

```bash
git add src/pages/TeamPage.vue
git commit -m "feat(data-zone): migrate TeamPage.vue to Data accent, closing the meId carry-forward from Data Wave 2"
```

---

## Deferred, not actioned this wave (documented, not silently dropped)

- **`Teams.vue`'s Grid/Lista view-toggle buttons (lines 46, 60) and player shirt-number badge (line 170)** use a flat `bg-blue-600 text-white` fill — the same shape of pattern (`-600` solid + white text) Data Wave 1 proved fails WCAG AA for the `-500→-600` range. These are pre-existing, never `emerald`/`cyan`/`violet` to begin with, so out of this wave's mapping-driven mandate; not fixed here to avoid scope creep beyond the family migration. Worth a dedicated accessibility pass across the app's pre-existing (non-redesign-originated) solid-fill buttons, not just this file.
- **`TeamPage.vue`'s Stats tab** uses 3 different hues for its 3 top-player lists — Goleadores=`yellow-400`, Asistidores=`blue-400` (already correct), Mejor Valorados=`orange-400`. Data Wave 1's `CompetitionPage.vue` established a precedent of recoloring both a Goleadores AND an Asistidores stat number to the same blue rung (not keeping them differentiated). This file's `yellow-400`/`orange-400` are not `emerald`/`cyan`/`violet` so mechanically out of this wave's scope, but the 3-hue split may read as inconsistent with `CompetitionPage.vue`'s unified-blue treatment of the same semantic (top scorers/assists lists) elsewhere in the same zone. Not touched this wave; flag for the owner if the inconsistency is visible enough to matter once live.
- **`TeamPage.vue`'s squad table and its ~10 sibling tab-content containers** were considered for `.surface-flat` (see Global Constraints) and deliberately excluded — not a miss, a ruling.

## Self-Review

- **Spec coverage:** both files with real cyan/emerald/violet content (`Teams.vue`, `TeamPage.vue`) have tasks. The mandatory Data Wave 2 carry-forward (`TeamPage.vue:434`) is Task 2 Step 8, explicitly labeled.
- **Placeholder scan:** no TBD/TODO; every step has literal Find/Replace code; every verification step has an exact command and expected output.
- **Type/interface consistency:** no script-block or prop/emit changes anywhere in this plan — n/a.
- **Font-weight ceiling:** both files swept in full during plan-writing (`grep -n "font-extrabold\|font-black\|font-display"`) — zero hits in `Teams.vue`, one correctly-out-of-scope hit in `TeamPage.vue` (line 270, no `.font-display` ancestor), both re-verified as task steps.
- **Protected-category check:** the NEW category this wave introduces — `playerPosColor()`'s 4-member categorical position map — is named explicitly in Global Constraints and re-verified in Task 2 Step 11, alongside the now-familiar win/loss/live/rating-gold/financial-positive categories already established in Data Waves 1-2.
- **This is the final wave of the whole 3-zone redesign.** Once Task 1 and Task 2 are both reviewed clean and the final whole-branch review passes, the entire "Midnight Broadcast" initiative (Hub, Play, Data — all zones) is complete.
