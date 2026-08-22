# Zona Juego — Survey / Scoping Document

Not an implementation plan — a reconnaissance pass before committing to sub-wave plans, following the same subagent-driven-development rollout pattern used for Hub Waves 1-3. Spec: `docs/superpowers/specs/2026-08-19-visual-redesign-design.md` ("Zona Juego" row: gold single-accent at rest, `.surface-solid` surfaces; scope = 14 games + GameShell + `/reto` + `/rewards` + level-up/achievement-unlock overlays).

## Total scope inventory

| Cluster | Files | Lines | Notes |
|---|---|---|---|
| Shared game infra | `GameShell.vue`, `GameSummaryPopup.vue` | 156 + 474 = 630 | Inherited by ALL 14 games — highest leverage, do first |
| 14 games (simple cluster, ~300-390 lines each) | `GuessPlayer`, `NationalityGame`, `PlayerPosition`, `WhoIs`, `ValueOrder`, `AgeOrder`, `HeightOrder`, `ShirtNumber` | 2,918 | Similarly shaped "immersive" quiz games |
| 14 games (complex cluster, ~400-605 lines each) | `OnceIdeal`, `FootballWordle`, `HigherOrLower`, `Connections`, `FootballGrid`, `StatChallenge` | 2,919 | Bigger, more custom UI per game |
| Celebration overlays | `LevelUpOverlay.vue`, `CosmeticUnlockOverlay.vue` | 280 + 254 = 534 | Spec explicitly exempts these from animation-pruning |
| `/reto` | `DailyChallenge.vue` | 313 | `ChallengeGameWrapper.vue` (309 lines) looked related but is dead code, see below |
| `/rewards` | `RewardCenter.vue` + `DailyStreakCalendar.vue` + `RewardCard.vue` + `MonthlyPass.vue` + `PowerupIcon.vue` (+`PassCosmetic.vue`, zero edits) | 447+198+94+404+46+43 = 1,232 | Heaviest emerald/cyan density of the whole surface |
| **Total** | ~24 files | **~8,860 lines** (~8,551 excluding the dead file) | ~2.5x Hub Wave 2's size — this is the biggest phase yet, needs multiple sub-waves |

## Per-cluster color assessment

**GameShell.vue (156 lines)** — mostly structural (flex/grid layout for the immersive game frame), very little color. One raw `rgba(52, 211, 153, 0.4)` (= emerald-400) on `.gs-back:hover` — **not a Tailwind class, a literal CSS value in a `<style scoped>` block**, so this needs a different Find/Replace mechanism than every Hub-wave task brief so far (which all targeted Tailwind utility class strings). Also `.gs-title` uses `font-weight: 800` with `font-family: var(--font-display, inherit)` — same font-weight-ceiling violation category as Wave 2's finding, but again expressed as a raw CSS property, not a `font-extrabold` class. **Flag for task-brief writers: Zona Juego's scoped `<style>` blocks need literal CSS Find/Replace, the Hub-wave briefs' Tailwind-class-only pattern won't directly transfer.**

**14 games (5,837 lines combined)** — low-to-moderate emerald/cyan density per file (0-8 hits each; `GuessPlayer.vue`, `PlayerPosition.vue`, `NationalityGame.vue` have 0-1 emerald/cyan hits and are already amber-heavy, i.e. closer to the Play accent already). Sampled `ValueOrder.vue` and `OnceIdeal.vue` in depth: the pattern is consistent and NOT a new semantic category — it's exactly the existing `--mb-success`/`--mb-danger` semantics already defined in Foundation ("acierto/victoria" green, "error" red), applied per-answer instead of per-session like Wave 1's win/loss cards. `border-emerald-500 bg-emerald-500/10` = correct-answer feedback, `border-red-500` = incorrect — **must stay, do not recolor**. Separately, plain decorative CTAs ("jugar de nuevo", "seguir", flat `bg-emerald-500` buttons with no win/loss conditional) ARE recolorable to gold. Expect roughly a 50/50 split between semantic-and-stays vs. decorative-and-recolors within each game file — this wave's task briefs will need the same kind of explicit per-instance judgment Hub Wave 3 needed for Pricing.vue's two checkmark categories, not a blind mapping sweep.

**GameSummaryPopup.vue (474 lines, rendered after EVERY game)** — high-value, high-risk shared file. Contains: (a) win/loss result styling (`won ? emerald : red`, semantic, stays — same pattern as Wave 1's `GameCard.vue`), (b) "+XP ganada" reward-number text (stays emerald per the established cross-zone rule matching `.xp-float`), (c) **one level-progress bar using the literal gradient `from-emerald-400 via-cyan-400 to-indigo-400`** — this is the EXACT SAME gradient stops that Hub Wave 2 already recolored (in `ProfileIdentityCard.vue`, now `from-indigo-400 via-violet-400 to-purple-400`). This is a genuinely separate instance in a different zone — it must get its OWN gold-appropriate treatment here, not be skipped because "Hub already handled this bar elsewhere." Flag explicitly in the task brief so an implementer doesn't either (a) leave it alone thinking it's already done, or (b) copy Hub's violet/purple treatment onto a Play-zone file by pattern-matching the wrong precedent.

**Celebration overlays (`LevelUpOverlay.vue`, `CosmeticUnlockOverlay.vue`, 534 lines)** — per the spec's Movimiento section, these are explicitly named as one of the few places allowed to keep rich, elaborate animation ("Momentos de celebración real... conservar la animación más rica... los ÚNICOS lugares donde se permite ese nivel de espectáculo"). Do NOT apply any animation-pruning here even if the eventual Zona Juego rollout includes a keyframe-consolidation pass elsewhere — these are the sanctioned exception, not a target.

**`/reto` (`DailyChallenge.vue`, 313 lines)** — moderate emerald/cyan/amber mix (12/12/13 hits), not yet assessed instance-by-instance but comparable density to the rewards cluster; likely a similar mix of decorative-chrome and reward-number-semantic as the games.

**`/rewards` cluster (1,232 lines across `RewardCenter.vue` + 4 real subcomponents)** — the heaviest color density in the whole Zona Juego scope (`RewardCenter.vue` alone: 16 emerald + 7 cyan hits; `MonthlyPass.vue`: 12 emerald + 3 cyan, but also 30 amber/gold hits — it's already substantially gold-styled as a battle-pass UI, meaning much of its restyling may be "align inconsistent gold shades to the Play token" rather than "recolor from emerald"). `PassCosmetic.vue` (43 lines) needs **zero edits** — confirmed by reading it directly: its entire palette is 100% delegated to `frameStyle()`/`bannerStyle()`/`rarity()` (data-driven services), same category as Wave 2's `ProfileHoverCard.vue`. This resolves the cross-zone concern Wave 3 flagged about `PassCosmetic.vue` being shared with the deferred `Tienda.vue` — since it has no literal color of its own, migrating (or not migrating) it here creates no conflict with Tienda's eventual currency-color decision.

## Cross-zone shared-component flags

- **`PassCosmetic.vue`** — shared between this phase and the still-deferred `Tienda.vue` (Hub Wave 3's exclusion). Resolved above: zero edits needed regardless of which zone touches it first, no conflict.
- **No other cross-zone sharing found** in this pass — `CurrencyIcon.vue` (Tienda's other shared component) is not used anywhere in the Zona Juego scope surveyed here.

## Dead code found

- **`src/components/game/ChallengeGameWrapper.vue` (309 lines)** — grepped for usages across `src/` and in `router.js`: zero references anywhere except its own file (self-referential `name:` declaration only). It sits right next to `DailyChallenge.vue` and looks related by name/location, but nothing imports or renders it. Recommend independent verification + deletion under the project's standing dead-code authorization before or during whichever sub-wave touches `/reto`.

## Proposed sub-wave breakdown (6 waves, ordered by leverage/risk)

1. **Play Wave 1 — Shared infra**: `GameShell.vue` + `GameSummaryPopup.vue` (630 lines). Do this first — it's inherited by all 14 games, so establishing the gold accent + surface pattern here once (and working out the scoped-CSS Find/Replace mechanism GameShell needs) de-risks every subsequent games wave, mirroring how Hub Wave 1 built `GameCard.vue` before the rest of Hub rolled out.
2. **Play Wave 2 — Simple games**: `GuessPlayer`, `NationalityGame`, `PlayerPosition`, `WhoIs`, `ValueOrder`, `AgeOrder`, `HeightOrder`, `ShirtNumber` (2,918 lines, 8 games). These are similarly shaped and likely share enough structural DNA that task briefs can reuse patterns across them.
3. **Play Wave 3 — Complex games**: `OnceIdeal`, `FootballWordle`, `HigherOrLower`, `Connections`, `FootballGrid`, `StatChallenge` (2,919 lines, 6 games). More bespoke UI each, expect more per-instance judgment calls.
4. **Play Wave 4 — Celebration overlays**: `LevelUpOverlay.vue` + `CosmeticUnlockOverlay.vue` (534 lines). Small but needs its own wave because of the animation-preservation exception — worth isolating so a task brief can carry that one rule cleanly instead of it getting lost inside a bigger wave.
5. **Play Wave 5 — `/reto`**: `DailyChallenge.vue` (313 lines), after independently confirming and deleting the adjacent dead `ChallengeGameWrapper.vue`.
6. **Play Wave 6 — `/rewards`**: `RewardCenter.vue` + `DailyStreakCalendar.vue` + `RewardCard.vue` + `MonthlyPass.vue` + `PowerupIcon.vue` (1,189 real lines, `PassCosmetic.vue` needs no task). Heaviest color density — saved for its own focused wave rather than folded into games work.

This ordering isn't sacred — a case could be made for doing `/rewards` earlier since it's structurally closer to the "static page" shape the last 3 Hub waves already have a proven playbook for, versus the games' live-gameplay-state complexity being genuinely new territory. Worth a quick gut-check with the owner on whether to front-load the familiar-shaped work or the highest-leverage shared infra first.

## Open question for the owner, not resolved here

Same category as Wave 3's Tienda deferral: does "gold" mean the exact same `--play-500/400/600` tokens for EVERY recolor target in this phase, or do some already-gold elements (e.g. `MonthlyPass.vue`'s existing 30 amber/gold hits) need their shade *aligned* to the new token rather than left alone because "it's already gold"? Sampling suggests some pre-existing amber usage may already be visually close but not using the actual `--play-*` CSS variables — this needs a decision during Play Wave 1 or a dedicated audit before Play Wave 6, not assumed either way.
