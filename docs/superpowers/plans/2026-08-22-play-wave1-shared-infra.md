# Play Wave 1 — Shared Game Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Play zone's design system (gold single-accent, Space Grotesk weight ceiling) to the two shared components inherited by all 14 games — `src/components/game/GameShell.vue` and `src/components/game/GameSummaryPopup.vue` — establishing the Play-zone recolor vocabulary the remaining 5 Play waves (simple games, complex games, celebration overlays, `/reto`, `/rewards`) should reuse rather than reinvent.

**Architecture:** No new shared component — pure recolor across 2 files with genuinely different mechanisms. `GameShell.vue`'s only brand-color usage lives in a raw scoped `<style>` block (literal CSS declarations, not Tailwind classes) — its Find/Replace targets CSS property values, not class strings. `GameSummaryPopup.vue` uses Tailwind utility classes throughout, same mechanism as every Hub-zone wave. This wave also makes the wave's foundational vocabulary decision (monochrome gold vs. a Hub-style two-hue blend) — see Global Constraints.

**Tech Stack:** Vue 3 (Options API in `GameShell.vue`, Composition API `setup()` in `GameSummaryPopup.vue`), Tailwind CSS v4. Foundation + all 3 Hub-zone waves already merged to `main` (`--mb-radius-*`, `--play-400/500/600` tokens already defined in `style.css` from Foundation, unused until now). No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not, per every prior wave).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- **Play-zone accent vocabulary (NEW this wave — read carefully, this precedent governs 5 more waves):** tokens `--play-400: #fcd34d` (= Tailwind `amber-300`'s hex, NOT `amber-400`'s — same token-naming drift as Hub's `--hub-500`≠`indigo-500`, established during Foundation), `--play-500: #f59e0b` (= `amber-500`), `--play-600: #d97706` (= `amber-600`). Always use `amber-300`/`amber-500`/`amber-600` Tailwind class names to hit these exact token values — `amber-400` is NOT one of this zone's tokens, do not use it.

- **Ruling: Play zone is monochrome gold, not a two-hue blend.** The spec calls this zone's accent "Dorado (**único** acento en reposo)" — a single accent — unlike Hub's `--hub-500/400/300` violet+purple two-hue system (`from-indigo-500 to-purple-500`-style gradients). Where old code used a multi-hue decorative gradient, the Play-zone replacement uses ONE hue (amber) at varying lightness: `from-amber-300 via-amber-500 to-amber-600` for a 3-stop bar, `from-amber-500 to-amber-600` for a 2-stop CTA gradient. Never introduce a second hue (no amber-to-something-else blends) in Play-zone decorative chrome — that would be re-importing Hub's two-hue pattern into the wrong zone.

- **Color mapping** (apply ONLY to the specific decorative-chrome instances named in each task below — this file's emerald usage is mostly semantic, see the exclusions list, so there is no blanket "map every emerald" rule this wave): the level-progress bar's 3-stop gradient and the two button gradients/outlines named in Task 2.

- **What must NOT be recolored, left exactly as-is (longer and more consequential than the mapping itself in this wave):**
  1. **Win/loss result semantics** — ANY color tied to `GameSummaryPopup.vue`'s `won` computed boolean (the result banner background/border, the icon badge background, the icon color, the "¡VICTORIA!"/"¡DERROTA!" title color) stays emerald-for-win / red-for-loss exactly as today, **including the win banner's `to-cyan-500/10` gradient stop**. This is the same cross-zone win/loss constant Hub Wave 1 established on `GameCard.vue` (`--mb-success`/`--mb-danger`) — a semantic constant that doesn't change per zone, not a brand-accent decision this wave gets to make.
  2. **Reward/XP-earned number semantics** — the "XP ganada" stat card (background, border, label, number) and the "+{{ totalXp }} XP" badge stay emerald exactly as today, matching the untouched cross-zone `.xp-float` toast rule already established in every Hub wave.
  3. **The share button's post-share confirmation state** (`shared ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300...' : '...'`) — this is a transient "operation succeeded" signal (resets automatically after 2.2s, see the `setTimeout` in the `<script>` block), the same cross-zone `--mb-success` semantic as win/loss feedback, not brand-accent chrome. Only the button's DEFAULT (not-yet-shared) gradient is decorative chrome and recolors — the `shared ? ...` branch is untouched.
  4. **Every pre-existing yellow/amber usage NOT named in Task 2's steps** (the 3 result stars, the "RECORD" streak label, the level-up arrow icon + "¡Subiste de nivel!" text, the PRO-bonus badge, the achievement-unlocked cards, the difficulty badges) — these already express the cross-zone `--mb-prestige` gold semantic Foundation defined for exactly this category ("PRO, rachas, medallas — ya existía, se mantiene cross-zona"), not decorative Play-zone brand chrome that merely happens to be gold-colored. **This wave does NOT do a shade-normalization pass across this pre-existing amber/yellow** — same as every Hub wave's rule for pre-existing amber: never touched, full stop, regardless of exact shade. Leave every `yellow-*`/`amber-*` class not explicitly named in Task 2 byte-for-byte as it is today.
  5. **Font-weight rule applies orthogonally to color** — `.font-display` + `font-extrabold`/`font-black` → `font-bold` (Space Grotesk ships only weights 600/700, decided in Foundation, applied in every Hub wave) applies REGARDLESS of whether the element's color is being recolored or is a protected semantic color. Example: the win/loss title keeps its emerald/red color exactly, but still drops from `font-extrabold` to `font-bold`.

- **Surface migration**: neither file has a literal `class="card"` usage or the `bg-slate-900/60-70 + backdrop-blur-md` sanctioned pattern (verified by reading both files fully) — no surface-class task this wave.

- Do not touch `<script>`-block logic, animation timing/sequencing (the phased reveal sequence, XP-count-up animation, achievement-queue draining), or the resize-measurement logic in `GameShell.vue` — templates/styles only, same constraint as every prior wave.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse `--play-400/500/600` (already defined in `style.css` from Foundation, unused until this wave) — do not invent new Play-zone tokens.

---

## Task 1: Migrate `GameShell.vue`'s raw CSS to the Play design system

**Files:**
- Modify: `src/components/game/GameShell.vue`

**Interfaces:** none (standalone shared shell, no props/emits change).

- [ ] **Step 1: Back-button hover border color**

Find:
```css
.gs-back:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(52, 211, 153, 0.4);
}
```
Replace with:
```css
.gs-back:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(252, 211, 77, 0.4);
}
```
`rgba(252, 211, 77, 0.4)` is Tailwind `amber-300` (= `--play-400`) at the same 40% alpha the original emerald-400 used — a literal CSS value, not a Tailwind class, so this is a plain string replacement in the `<style scoped>` block, not a `class="..."` edit.

- [ ] **Step 2: Game-title font-weight ceiling**

Find:
```css
.gs-title {
  font-family: var(--font-display, inherit);
  font-weight: 800;
  color: #fff;
```
Replace with:
```css
.gs-title {
  font-family: var(--font-display, inherit);
  font-weight: 700;
  color: #fff;
```

- [ ] **Step 3: Verify no leftover targets**

```bash
rg 'rgba\(52, 211, 153|font-weight: 800' src/components/game/GameShell.vue
```
Expected: zero matches.

- [ ] **Step 4: Live verification**

With the dev server running, navigate to any `/games/*` route. Confirm: the "Volver" back button's hover state now shows a gold-tinted border (hover with the mouse, or inspect `getComputedStyle` on `.gs-back:hover` if hover-triggering is awkward in an automated check) — not the old green tint. Note: `font-weight: 800` on a font that only ships weight 700 was already being faux-bolded by the browser, so the title heading may show **zero visible difference** after this change — that's expected and correct, not a verification failure; confirm via `getComputedStyle` that the declared weight is now 700, not that the render looks different. No console errors. Paste actual observations.

- [ ] **Step 5: Commit**

```bash
git add src/components/game/GameShell.vue
git commit -m "feat(play-zone): migrate GameShell.vue to Play accent"
```

---

## Task 2: Migrate `GameSummaryPopup.vue` to the Play design system

**Files:**
- Modify: `src/components/game/GameSummaryPopup.vue`

**Interfaces:** none.

- [ ] **Step 1: Level-progress bar gradient**

Find:
```html
                <div
                  class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400"
                  :style="{ width: xpBarWidth + '%', transition: 'width 1.2s var(--ease-out-expo)' }"
                ></div>
```
Replace with:
```html
                <div
                  class="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-500 to-amber-600"
                  :style="{ width: xpBarWidth + '%', transition: 'width 1.2s var(--ease-out-expo)' }"
                ></div>
```
This is the ONLY genuinely decorative multi-hue gradient in the file (a generic level-completion progress fill, not tied to win/loss or XP-reward semantics). **Important:** this exact old string (`from-emerald-400 via-cyan-400 to-indigo-400`) also appeared, before this redesign, in a completely different file — `ProfileIdentityCard.vue`, a Hub-zone file already migrated in Wave 2 (now `from-indigo-400 via-violet-400 to-purple-400` on `main`). Do not skip this instance thinking "this gradient was already fixed" (it wasn't — that was a different file), and do not copy Hub's violet/purple replacement here — this file is Play zone, it gets the monochrome gold treatment above.

- [ ] **Step 2: Win/loss title — font-weight only, color stays**

Find:
```html
              <h2
                :class="['font-display text-2xl font-extrabold leading-tight', won ? 'text-emerald-400' : 'text-red-400']"
```
Replace with:
```html
              <h2
                :class="['font-display text-2xl font-bold leading-tight', won ? 'text-emerald-400' : 'text-red-400']"
```
Only the weight changes. The win/loss conditional color (`text-emerald-400`/`text-red-400`) is a protected cross-zone semantic — leave it exactly as-is per Global Constraints rule 1.

- [ ] **Step 3: Corrects-count font-weight**

Find:
```html
                <span class="font-display text-3xl font-extrabold text-white">{{ animatedCorrects }}</span>
```
Replace with:
```html
                <span class="font-display text-3xl font-bold text-white">{{ animatedCorrects }}</span>
```

- [ ] **Step 4: Share button — default gradient only, "shared" confirmation state stays**

Find:
```html
                :class="[
                  'w-full rounded-xl py-2.5 text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg',
                  shared
                    ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 shadow-emerald-500/10'
                    : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white shadow-emerald-500/25'
                ]"
```
Replace with:
```html
                :class="[
                  'w-full rounded-xl py-2.5 text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg',
                  shared
                    ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 shadow-emerald-500/10'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-white shadow-amber-500/25'
                ]"
```
Only the `: '...'` (default, not-yet-shared) branch changes, per Global Constraints rule 3. The `shared ? '...'` branch (post-share confirmation) is a protected cross-zone success signal — leave it emerald exactly as-is.

- [ ] **Step 5: "Volver a juegos" button**

Find:
```html
                <router-link
                  :to="backPath"
                  class="flex-1 rounded-xl border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 py-2.5 text-sm font-bold transition text-center"
                >
                  Volver a juegos
                </router-link>
```
Replace with:
```html
                <router-link
                  :to="backPath"
                  class="flex-1 rounded-xl border border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2.5 text-sm font-bold transition text-center"
                >
                  Volver a juegos
                </router-link>
```

- [ ] **Step 6: Verify the 3 recolor targets landed and nothing else changed**

```bash
rg 'from-emerald-400 via-cyan-400|from-emerald-500 to-cyan-500|border-emerald-400/30 bg-emerald-500/10' src/components/game/GameSummaryPopup.vue
```
Expected: zero matches (all 3 decorative-chrome instances converted).

```bash
rg 'emerald' src/components/game/GameSummaryPopup.vue
```
Expected: matches only in the win/loss banner/icon/title (result banner, icon badge, icon color, title color), the XP-earned stat card + its badge, and the share button's `shared ? ...` branch — count them; none of the 3 recolored instances (progress bar, default share gradient, "Volver a juegos") should still show `emerald`.

- [ ] **Step 7: Live verification**

With the dev server running, trigger a game-summary popup (play any `/games/*` route to completion — both a win and a loss if feasible, to check both banner states; or force `show=true`/`won=true`/`won=false` via Vue devtools if faster). Confirm: the level-progress bar (in the "Nivel" card) is now a gold gradient (amber-300→amber-500→amber-600), not green→cyan→indigo. Confirm the win/loss banner, icon, title color, and the XP-earned stat card are all STILL emerald in the win case (and the loss banner is still red/orange). Click "Compartir mi resultado" — confirm the default button is now gold, and after clicking (the "copied" confirmation state) it turns emerald with a checkmark, unchanged. Confirm "Volver a juegos" is now gold-outlined. No console errors. Paste actual observations.

- [ ] **Step 8: Commit**

```bash
git add src/components/game/GameSummaryPopup.vue
git commit -m "feat(play-zone): migrate GameSummaryPopup.vue to Play accent"
```

---

## Self-Review Notes

- **Spec coverage:** both named files in this wave's scope are covered — `GameShell.vue` (Task 1, 2 CSS-literal changes) and `GameSummaryPopup.vue` (Task 2, 5 changes: 1 gradient recolor + 2 button recolors + 2 font-weight fixes). The Play-zone accent vocabulary (monochrome gold, exact token-to-Tailwind-class mapping) is established explicitly in Global Constraints for the 5 remaining Play waves to reuse.
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code, including the raw-CSS blocks in Task 1 (not just Tailwind class strings).
- **Type/signature consistency:** no props, emits, or component interfaces change in this plan — template/style-only, like every prior wave. Task 1 and Task 2 touch fully disjoint files with no shared interface.
- **Semantic-color judgment calls, stated once here rather than repeated per task:** this wave required MORE exclusion reasoning than recoloring — of `GameSummaryPopup.vue`'s ~11 emerald/cyan hits, only 3 are genuinely decorative (recolor) and the rest are one of three protected semantic categories (win/loss, XP-reward, transient success-confirmation). The file's substantial pre-existing yellow/amber usage (stars, RECORD, level-up, PRO badge, achievements) was deliberately NOT touched or shade-normalized — ruled as already expressing the cross-zone `--mb-prestige` semantic, not decorative Play-zone chrome, and shade-normalizing untouched-but-technically-off-token amber is explicitly out of scope for this wave (same treatment Hub gave pre-existing amber throughout all 3 waves).
- **The wave's foundational vocabulary decision** (monochrome gold, not a Hub-style two-hue blend) is recorded in Global Constraints with its reasoning (spec's "único acento" wording) so it doesn't need to be re-derived or re-litigated in Play Waves 2-6.
