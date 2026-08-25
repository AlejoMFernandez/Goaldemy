# Play Wave 4 — Celebration Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Play zone's design system (monochrome gold, Space Grotesk weight ceiling) to the two celebration overlays — `src/components/rewards/LevelUpOverlay.vue` and `src/components/rewards/CosmeticUnlockOverlay.vue` — continuing the rollout Play Waves 1-3 completed on shared infra + all 14 games.

**Architecture:** No new shared component. Pure recolor + font-weight fixes across 2 files, both global Teleport-based overlays rendered once at the app root (`App.vue:121-122`), not tied to any single page or game. **These two files are the spec's explicitly sanctioned exception to animation restraint** — see Global Constraints below. Both files have small, disjoint sets of decorative emerald/cyan chrome; most of their color usage is either tier/rarity-driven data (out of scope) or a genuinely new color family (fuchsia/yellow) that was never part of the emerald/cyan mapping to begin with.

**Tech Stack:** Vue 3 (`<script setup>` in `LevelUpOverlay.vue`, Options API `setup()` in `CosmeticUnlockOverlay.vue`), Tailwind CSS v4. Foundation + all 3 Hub waves + Play Waves 1-3 already merged to `main`. No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Global Constraints

- **Animation preservation — read this before touching either file.** The spec's Movimiento section names celebration moments explicitly: *"Momentos de celebración real (level-up, racha, logro desbloqueado) → conservar la animación más rica (ej. `scale-spring` + `glow-pulse`), pero como los ÚNICOS lugares donde se permite ese nivel de espectáculo."* These two files ARE that sanctioned exception. **Do not prune, simplify, consolidate, or remove any keyframe, `style="animation: ..."` inline attribute, or `<Transition>`/`.overlay-fade-*` CSS in either file** — not even ones that look like they duplicate animation vocabulary used elsewhere in the app. Every step below that touches a line carrying an `animation:` inline style or a `<style scoped>` keyframe block preserves it byte-for-byte; only literal color values are ever swapped, never the animation's structure, timing, or existence. This exception does NOT extend to font-weight — the font-weight ceiling rule (below) applies here exactly as it does everywhere else; "keep the spectacle" is about not pruning animation, not about tolerating an incorrect weight on an animated number.

- **Color mapping** (apply ONLY to the specific decorative-chrome instances named in each task below): `emerald-400`→`amber-300`, `emerald-500`→`amber-500`, `emerald-300`→`amber-300` (same rung — `amber-300` isn't reserved, so no step-down needed for this rung the way `amber-400` requires one). **Never use `amber-400`** anywhere — it's the rung reserved for `--mb-prestige`/`--accent-gold` (a semantic reservation, not a hex-identity claim). These overlays are *literally* about leveling up and earning prestige, which makes `amber-400` feel thematically tempting — resist that association; it is a specific reserved Tailwind class, not a synonym for "this moment feels special." The correct decorative rung for what was `emerald-400`/`emerald-300` is always `amber-300`.

- **Filled/solid gold CTAs need `text-slate-900` for WCAG AA**, not `text-white` — established Play Wave 1 fix, required on the one filled `bg-amber-500`-family button this wave introduces (`CosmeticUnlockOverlay.vue`'s primary "Continuar/Siguiente/Listo" button).

- **Font weight**: every `.font-display` element combined with `font-extrabold`/`font-black` → `font-bold` (Space Grotesk ships only weights 600/700). This wave has exactly 5 instances: 3 in `LevelUpOverlay.vue` (the rank-act new-tier label, the old-level number, the new-level number) and 2 in `CosmeticUnlockOverlay.vue` (the plain-text cosmetic-name fallback for `title`-type items, the main cosmetic-name heading). Apply the weight change ONLY — colors on these elements are untouched regardless of whether they're in-scope-and-recolored or out-of-scope-and-protected elsewhere in the same line. `font-extrabold` NOT paired with `.font-display` stays untouched — confirmed one such instance in `CosmeticUnlockOverlay.vue`'s rarity-label badge (`text-xs font-extrabold uppercase tracking-wider`, no `.font-display` class), left alone below.

- **What must NOT be recolored, left exactly as-is (longer and more consequential than the mapping in this wave):**
  1. **Reward/XP-earned number semantics** — `LevelUpOverlay.vue`'s non-milestone "+{{ xpBonus }} XP" badge (`bg-emerald-500/15 border border-emerald-500/25 text-emerald-400`) is genuinely using the app's established emerald reward-number convention (matching the cross-zone `.xp-float` rule already protected in every prior wave) — unlike Play Wave 3's `OnceIdeal.vue`, where the equivalent text was cyan and demonstrably never followed that shared convention. This one *does* follow it. Stays untouched.
  2. **Possession/confirmation state** — `CosmeticUnlockOverlay.vue`'s "Equipar" button, when the current item is already equipped in this session (`isEquipped ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : ...`), is the same permanent-possession-badge semantic every prior wave protected (Global Constraint rule 1 since Hub Wave 2). Stays untouched.
  3. **Rarity-driven categorical color system** — `CosmeticUnlockOverlay.vue`'s `RARITY_THEME` object (`<script>` block: `common`=slate, `rare`=sky, `epic`=fuchsia, `legendary`=amber, each with its own `glow`/`text`/`ringBorder`/`confetti` values) is a data-driven map keyed by cosmetic rarity, the same category as Hub Wave 2's `TIER_TINT` and Play Wave 3's `GROUP_COLORS`/stat-category boxes — untouched regardless of which literal color each rarity happens to resolve to, and doubly out of scope since it's `<script>`-block content in a templates/styles-only wave.
  4. **`CosmeticIcon.vue`'s `rank_emerald`/`rank_cyan` cosmetic content keys** — this is a shared subcomponent both overlays can render (via `PassCosmetic.vue`/`CosmeticIcon.vue`) whose `KNOWN` icon-key set includes literal collectible icon names like `rank_emerald`, `rank_cyan`, `rank_bronze`, `rank_gold`, alongside `ball`/`boot`/`trophy`/`phoenix`/etc. — these are cosmetic-catalog content identifiers, not brand-chrome classes, and this file is not in this wave's file list at all. Not touched, not even inspected further.
  5. **Fuchsia and yellow chrome** — `LevelUpOverlay.vue`'s entire "Acto 1 · Ascenso de Rango" sequence (old/new tier crest reveal, chevron, glow, "Continuar" button — all `fuchsia-*`), the milestone XP badge (`from-fuchsia-500/20 to-amber-500/20 border-fuchsia-500/30 text-fuchsia-300`), and the non-milestone level-number/icon color (`text-yellow-400`) were never emerald or cyan to begin with — out of scope by definition, same as every prior wave's rule for colors that were never part of the mapping. This is NOT a judgment call to make per-instance; these colors simply don't match the mapping's source set.
  6. **`newTierColor`** (a computed prop resolving `tierAccentText(newTier.value?.color)`, applied to the rank-act's new-tier label and body text) — driven by the `tiers.js` service, a data-driven categorical system exactly like rule 3 above. Untouched.

- **Surface migration**: neither file has a literal `class="card ..."` usage or the `bg-slate-900/60-70 + backdrop-blur-md` sanctioned pattern (both use `bg-black/85 backdrop-blur-md` as the full-screen scrim, a different construct — a Teleport-to-body overlay backdrop, not an elevated card surface) — confirmed by reading both files fully. No surface-class task this wave.

- Do not touch `<script>`-block logic (the phased-reveal timer sequences, queue-draining watchers, confetti/sound triggers, `RARITY_THEME`) anywhere in this wave — templates/styles only, same constraint as every prior wave, with the animation-preservation rule above as this wave's additional, stricter emphasis on top of it.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse `--play-400/500/600` via the `amber-300`/`amber-500`/`amber-600` Tailwind classes — do not invent new Play-zone tokens or introduce a second hue.

---

## Task 1: Migrate `LevelUpOverlay.vue` to the Play design system

**Files:**
- Modify: `src/components/rewards/LevelUpOverlay.vue`

**Interfaces:** none (global overlay, no props/emits change). Rendered unconditionally at `App.vue:121`.

- [ ] **Step 1: "Nuevo juego desbloqueado" label**

Find:
```html
            <p class="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">Nuevo juego desbloqueado</p>
```
Replace with:
```html
            <p class="text-[10px] uppercase tracking-wider text-amber-300 font-semibold mb-2">Nuevo juego desbloqueado</p>
```
This is a decorative section label highlighting a game unlock, not an XP-number — distinct from the protected reward-badge in Global Constraints rule 1. Recolors.

- [ ] **Step 2: Game-unlock card border/background**

Find:
```html
                class="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5"
```
Replace with:
```html
                class="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5"
```
The `:style="`animation: slide-up 0.35s ease ${0.08 * ri}s both`"` attribute on this same element is untouched — preserve it exactly, only the two color classes above change.

- [ ] **Step 3: "Lo que viene" progress-rail conquered segment**

Find:
```html
              <div class="absolute top-[22px] left-3 h-[3px] w-10 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-400/0"></div>
```
Replace with:
```html
              <div class="absolute top-[22px] left-3 h-[3px] w-10 rounded-full bg-gradient-to-r from-amber-300 to-amber-300/0"></div>
```

- [ ] **Step 4: Locked-item tooltip "unlocks at level" text**

Find:
```html
                          <div class="text-[11px] font-semibold text-emerald-300 mt-0.5">Se desbloquea en nivel {{ r.level }}</div>
```
Replace with:
```html
                          <div class="text-[11px] font-semibold text-amber-300 mt-0.5">Se desbloquea en nivel {{ r.level }}</div>
```

- [ ] **Step 5: Rank-act new-tier label — font-weight only**

Find:
```html
              <span class="relative text-xl font-display font-extrabold mt-2" :class="newTierColor">{{ newTier?.label }}</span>
```
Replace with:
```html
              <span class="relative text-xl font-display font-bold mt-2" :class="newTierColor">{{ newTier?.label }}</span>
```
Only the weight changes — `newTierColor` (a data-driven tier-color computed prop, Global Constraints rule 6) stays exactly as-is. This element also sits inside a block with `:style="rp >= 3 ? 'animation: scale-spring 0.6s var(--ease-bounce) both' : 'opacity:0'"` one level up — untouched, not part of this step's edit.

- [ ] **Step 6: Old-level number — font-weight only**

Find:
```html
              <span class="text-5xl font-display font-extrabold text-slate-500 line-through decoration-2">{{ current.oldLevel }}</span>
```
Replace with:
```html
              <span class="text-5xl font-display font-bold text-slate-500 line-through decoration-2">{{ current.oldLevel }}</span>
```

- [ ] **Step 7: New-level number — font-weight only, animation untouched**

Find:
```html
              <span class="text-7xl font-display font-extrabold text-yellow-400"
                :style="lp >= 1 ? 'animation: level-morph 0.6s var(--ease-bounce) both' : ''">{{ current.newLevel }}</span>
```
Replace with:
```html
              <span class="text-7xl font-display font-bold text-yellow-400"
                :style="lp >= 1 ? 'animation: level-morph 0.6s var(--ease-bounce) both' : ''">{{ current.newLevel }}</span>
```
Only the weight changes — `text-yellow-400` (never emerald/cyan, Global Constraints rule 5) and the `level-morph` animation (preserved verbatim, Global Constraints animation-preservation rule) both stay exactly as-is.

- [ ] **Step 8: Verify no leftover brand-color references, and animations intact**

```bash
rg 'border-emerald-500/20 bg-emerald-500|from-emerald-400 to-emerald-400/0|text-emerald-300 mt-0.5|font-extrabold' src/components/rewards/LevelUpOverlay.vue
```
Expected: zero matches for all four patterns.

```bash
rg -n 'emerald' src/components/rewards/LevelUpOverlay.vue
```
Expected: exactly one matching line remaining — the non-milestone XP badge's `'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400'` ternary branch (Global Constraints rule 1, protected). Do NOT expect zero matches from this broader sweep — that one instance staying is correct, not a leftover.

```bash
rg 'animation: (scale-spring|evolution-flash|tracking-reveal|level-morph|slide-up)' src/components/rewards/LevelUpOverlay.vue
```
Expected: the same set of animation references present before this task (5 distinct animation names across the file, some appearing more than once) — confirms nothing was pruned. Cross-check the count against `git show HEAD:src/components/rewards/LevelUpOverlay.vue | rg 'animation:'` (pre-change) to confirm the counts match exactly.

- [ ] **Step 9: Live verification**

With the dev server running, trigger a level-up overlay (this fires automatically after a game session that awards a level — may require Vue devtools to force `notificationsState.levelUpQueue` directly if a real level-up isn't easily reachable; if so, say this explicitly in your report and rely on diff/grep verification as primary evidence instead of fabricating a live observation). If reachable: confirm the "Nuevo juego desbloqueado" section (if a game unlock is part of the current level's rewards) shows a gold label and gold-bordered card, the "Lo que viene" rail's conquered segment is gold, and hovering a locked upcoming item shows a gold "Se desbloquea en nivel X" line in the tooltip. Confirm the rank-ascension act (Acto 1, if a tier change is part of this level-up) still shows fuchsia chrome unchanged, and the level-morph number animation still plays (bounce/scale, not just an instant number swap). No console errors. Paste actual observations, or an honest explanation of what you verified via diff/grep instead.

- [ ] **Step 10: Commit**

```bash
git add src/components/rewards/LevelUpOverlay.vue
git commit -m "feat(play-zone): migrate LevelUpOverlay.vue to Play accent"
```

---

## Task 2: Migrate `CosmeticUnlockOverlay.vue` to the Play design system

**Files:**
- Modify: `src/components/rewards/CosmeticUnlockOverlay.vue`

**Interfaces:** none. Rendered unconditionally at `App.vue:122`. This is the last task of the plan.

- [ ] **Step 1: Primary CTA button — recolor + WCAG AA fix, animation untouched**

Find:
```html
            <button @click="primary"
                    class="rounded-2xl px-8 py-3.5 font-display font-bold text-base text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/25 transition-all duration-200"
                    style="animation: claim-pulse 2s ease-in-out infinite">
              {{ index < total - 1 ? 'Siguiente' : (total > 1 ? 'Listo' : 'Continuar') }}
            </button>
```
Replace with:
```html
            <button @click="primary"
                    class="rounded-2xl px-8 py-3.5 font-display font-bold text-base text-slate-900 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 shadow-lg shadow-amber-500/25 transition-all duration-200"
                    style="animation: claim-pulse 2s ease-in-out infinite">
              {{ index < total - 1 ? 'Siguiente' : (total > 1 ? 'Listo' : 'Continuar') }}
            </button>
```
`text-white`→`text-slate-900` is the WCAG AA fix established in Play Wave 1 for filled gold CTAs. The `style="animation: claim-pulse 2s ease-in-out infinite"` line is copied verbatim, unchanged — this is the animation-preservation rule in practice: only the two color-bearing class tokens (`text-white`/`from-emerald-500 to-cyan-500`/`shadow-emerald-500/25`) change, the animation attribute is untouched.

Leave the "Equipar" button's `isEquipped` branch (`border-emerald-400/40 bg-emerald-500/10 text-emerald-300`) completely untouched — possession/confirmation semantic, Global Constraints rule 2.

- [ ] **Step 2: Cosmetic-name fallback title (non-icon/frame/banner types, e.g. `title` cosmetics) — font-weight only**

Find:
```html
                <div v-else class="px-3"><div class="font-display font-extrabold text-xl" :class="theme.text">{{ current.name }}</div></div>
```
Replace with:
```html
                <div v-else class="px-3"><div class="font-display font-bold text-xl" :class="theme.text">{{ current.name }}</div></div>
```
Only the weight changes — `theme.text` (rarity-driven, `RARITY_THEME`, Global Constraints rule 3) stays exactly as-is.

- [ ] **Step 3: Main cosmetic-name heading — font-weight only**

Find:
```html
            <h2 class="font-display text-3xl font-extrabold text-white mb-2">{{ current.name }}</h2>
```
Replace with:
```html
            <h2 class="font-display text-3xl font-bold text-white mb-2">{{ current.name }}</h2>
```

Leave the rarity-label badge (`text-xs font-extrabold uppercase tracking-wider`, line ~159) completely untouched — not paired with `.font-display`, out of the font-weight rule's scope, Global Constraints header paragraph. Leave `RARITY_THEME`, the `isEquipped` "Equipar" branch, and every `theme.glow`/`theme.ringBorder`/`theme.text`/`theme.confetti` usage throughout the template completely untouched.

- [ ] **Step 4: Verify no leftover brand-color references, and animations intact**

```bash
rg 'from-emerald-500 to-cyan-500|text-white bg-gradient-to-r|font-extrabold' src/components/rewards/CosmeticUnlockOverlay.vue
```
Expected: zero matches for all three patterns.

```bash
rg -n 'emerald' src/components/rewards/CosmeticUnlockOverlay.vue
```
Expected: exactly one matching line remaining — the "Equipar" button's `isEquipped` branch (`border-emerald-400/40 bg-emerald-500/10 text-emerald-300`) — confirming the only recolor target was correctly changed and the only protected instance was correctly left alone.

```bash
rg 'animation: (scale-spring|glow-pulse|claim-pulse)' src/components/rewards/CosmeticUnlockOverlay.vue
```
Expected: the same animation references present before this task — confirms nothing was pruned. Cross-check against `git show HEAD:src/components/rewards/CosmeticUnlockOverlay.vue | rg 'animation:'` to confirm the counts match.

- [ ] **Step 5: Live verification**

With the dev server running, trigger a cosmetic-unlock overlay (fires after unlocking/earning a cosmetic — may require Vue devtools to force `notificationsState.cosmeticQueue` directly if not otherwise reachable; if so, say this explicitly and rely on diff/grep verification as primary evidence). If reachable: confirm the primary "Continuar/Siguiente/Listo" button is now a gold gradient with dark (not white) text, and its pulse animation still plays continuously (not a one-shot or missing animation). Confirm the "Equipar" button still shows emerald once an item is equipped (unchanged). Confirm the cosmetic-name heading and any plain-text (`title`-type) cosmetic name still render, at `font-bold` not `font-extrabold` (spot-check via `getComputedStyle` if the visual difference is subtle). No console errors. Paste actual observations, or an honest explanation of what you verified via diff/grep instead.

- [ ] **Step 6: Commit**

```bash
git add src/components/rewards/CosmeticUnlockOverlay.vue
git commit -m "feat(play-zone): migrate CosmeticUnlockOverlay.vue to Play accent"
```

---

## Self-Review Notes

- **Spec coverage:** both named files in this wave's scope are covered — `LevelUpOverlay.vue` (Task 1, 7 changes: 4 decorative recolors + 3 font-weight fixes) and `CosmeticUnlockOverlay.vue` (Task 2, 3 changes: 1 decorative recolor+WCAG fix + 2 font-weight fixes). The animation-preservation exception from the spec's Movimiento section is stated once in Global Constraints with its exact source wording, and each step that touches an animated element explicitly calls out that the animation attribute is untouched, rather than leaving it implicit.
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code.
- **Type/signature consistency:** no props, emits, or component interfaces change anywhere in this plan — template/class-only, like every prior wave. Both tasks touch fully disjoint files with no shared interface (both are independently Teleport-rendered from `App.vue`, neither imports the other).
- **Reachability confirmed:** both files are rendered unconditionally at `App.vue:121-122`, not gated behind any route — global overlays, not page-specific. `CosmeticIcon.vue`/`RarityGem.vue` (subcomponents `CosmeticUnlockOverlay.vue` imports) were checked for emerald/cyan usage: `RarityGem.vue` has none; `CosmeticIcon.vue` has `rank_emerald`/`rank_cyan` as literal cosmetic-catalog content-key names (alongside `rank_bronze`/`rank_gold`/`ball`/`trophy`/etc.), not brand-chrome classes, and neither file is in this wave's scope — noted in Global Constraints rule 4 rather than silently ignored.
- **Semantic-color judgment calls, stated once here rather than repeated per task:** the wave's least obvious call is `LevelUpOverlay.vue`'s "+XP" badge — it looks similar to Play Wave 3's `OnceIdeal.vue` cyan-XP-text precedent (where the ruling was "recolor, it never used the shared convention"), but this file's badge genuinely IS using the app's standard emerald reward convention (unlike `OnceIdeal.vue`'s outlier cyan), so the ruling here is the opposite — stays protected. Both rulings are correct precisely because they're checking the same underlying question (does this text actually participate in the shared `.xp-float` convention?) and getting different, file-specific answers — flagged explicitly in Global Constraints rule 1 so this isn't mistaken for an inconsistency.
- **Fuchsia/yellow scoping:** a large fraction of `LevelUpOverlay.vue`'s visual chrome (the entire rank-ascension act, the milestone XP badge, the non-milestone level-number color) is fuchsia or yellow, never emerald/cyan — explicitly enumerated in Global Constraints rule 5 as out of scope by definition, not a judgment call requiring per-instance reasoning the way Play Wave 3's categorical-color and directional-convention rulings did.
