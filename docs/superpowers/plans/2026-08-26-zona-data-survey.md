# Zona Data — Survey / Scoping Document

Not an implementation plan — a reconnaissance pass before committing to sub-wave plans, following the same subagent-driven-development rollout pattern used for Zona Hub and Zona Juego. Spec: `docs/superpowers/specs/2026-08-19-visual-redesign-design.md` ("Data" row: pure-blue accent `--data-500/600/700`, `.surface-flat` — "Fondo `--mb-900`, borde 1px con tinte `--data-*` al 20-25% opacidad, sin sombra ni blur — prioriza densidad/legibilidad de tablas y brackets"). Scope per the spec's zone table: `/competiciones`, `/leagues/*`, `/team/*`, `/leaderboards`, `/teams`. This is the LAST zone of the whole redesign — no wave after this needs today's decisions to stay compatible with anything future.

## Total scope inventory

| Cluster | Files | Lines | Notes |
|---|---|---|---|
| Pages (5, confirmed via `router.js:52-77`) | `CompetitionsHub.vue`, `CompetitionPage.vue`, `TeamPage.vue`, `Teams.vue`, `Leaderboards.vue` | 124+428+879+398+160 = **1,989** | `/leagues` itself is a redirect to `/competiciones`, not a separate page. |
| League/bracket subcomponents (2) | `KnockoutBracket.vue`, `TournamentBracket.vue` | 320+162 = **482** | Both imported only by `CompetitionPage.vue` (`@/components/league/...`), no other consumer found. |
| Leaderboard subcomponents (3) | `LeaderboardTable.vue`, `PeriodTabs.vue`, `GameFilter.vue` | 96+23+28 = **147** | All imported only by `Leaderboards.vue`. |
| Shared utility (1) | `AppLoader.vue` | 20 | Imported by `Teams.vue`; likely used elsewhere in the app too (not checked) — treat as a cross-cutting primitive, not Zona Data's to touch unless it's Data-specific chrome. |
| **Total** | 11 files | **~2,638** | Comparable to Play Wave 2+3 combined, smaller than Hub Wave 2. |

`TeamPage.vue` was partially touched in the Foundation phase (16 static + 5 dynamic Bootstrap Icons → SVG, per project memory) — its icon set is already modern, but its COLOR scheme was never touched and still needs the Data-blue migration.

## Per-file color-density scan (emerald/cyan hit counts, mechanical grep)

| File | emerald-* | cyan-* | Assessment |
|---|---|---|---|
| `Leaderboards.vue` | 0 | 0 | Likely already neutral/delegates all color to `LeaderboardTable.vue` — verify, don't assume zero means nothing to do (could still have `.card`/surface work). |
| `Teams.vue` | 0 | 3 (cyan-300×2, cyan-500×1) | Light density, quick task. |
| `CompetitionsHub.vue` | 13 (emerald-400×6, emerald-300×5, emerald-500×2) | 0 | Moderate, all emerald — no monochrome-vs-two-hue decision needed here specifically. |
| `CompetitionPage.vue` | 14 | 16 | **Heaviest file in the zone** — both hues present in real quantity, plus it's the one with the standings table and hosts both bracket subcomponents. |
| `TeamPage.vue` | 2 | 4 | Lighter than expected for 879 lines — most of the file is likely layout/data-rendering, not brand chrome. |
| `LeaderboardTable.vue` | 6 (incl. emerald-200) | 1 | Small file, real density. |
| `PeriodTabs.vue` | 1 | 0 | Trivial. |
| `GameFilter.vue` | 0 | 0 | Trivial or already neutral. |
| `KnockoutBracket.vue` | 0 | 0 | **Uses zero Tailwind emerald/cyan classes at all** — its brand color, if any, lives in raw scoped CSS (see below), same mechanism Play Wave 1 discovered in `GameShell.vue`. Needs a targeted read of its `<style scoped>` block, not a class grep. |
| `TournamentBracket.vue` | 6 | 1 | Real density despite being the bracket's sibling component. |
| `AppLoader.vue` | 0 | 0 | Nothing to do, confirm it's spinner-only/neutral. |

**Follow-up needed before task-writing**: `KnockoutBracket.vue`'s `.kb-card`/`.kb-final`/`.kb-tbd`/connector-line rules use raw CSS (confirmed: `border: 1px solid rgba(255,255,255,0.1)` on `.kb-card`, a `--kb-line` custom property drives connector colors) — a full read of its `<style scoped>` block is required to find any embedded emerald/cyan `rgba(...)` literals the class-name grep above cannot see. Same mechanism-check every Play wave had to do for scoped CSS.

## New semantic-color categories found — genuinely different from anything in Hub or Play

1. **Goal-difference (DG) sign indicator** — `CompetitionPage.vue`'s standings table: `:class="team.goalConDiff > 0 ? 'text-green-400' : team.goalConDiff < 0 ? 'text-red-400' : 'text-slate-400'"`. Plain `green`/`red` (not `emerald`), a real sports-data semantic (positive/negative differential) — same "different color name AND semantic" double-protection pattern Play Wave 2/3/6 already established for `ShirtNumber.vue`/`StatChallenge.vue`'s `optionClass()`. Expect this pattern to recur for W/D/L form guides, live-score deltas, etc. — sweep every standings/stats table for it.

2. **Qualification-zone color bar** — same table, `<div class="w-1 h-5 rounded-full" :style="{ backgroundColor: team.qualColor || 'transparent' }">`. This is a **data-driven inline style bound to a backend field** (`team.qualColor`), not a Tailwind class at all — automatically out of scope for a class-based Find/Replace regardless of judgment (there's no static string to find). Flag it so a task brief doesn't waste time looking for a color class here; it may be worth a one-line note that this field's actual color values (wherever `qualColor` is computed/sourced) are themselves out of this redesign's reach (likely a service or even FotMob API data), same category as `GROUP_COLORS`/`RARITY_THEME`/`TIER_TINT` but one level more decoupled (data, not even a component-local map).

3. **Live-match indicator** — not directly found in this scan, but `CompetitionsHub.vue`/`CompetitionPage.vue` almost certainly surface live-match state (the spec's own Testing section flags "dos colores 'en vivo' distintos" as an open Hub-zone finding from Wave 1 — worth checking whether Zona Data's live indicators are a THIRD instance of that same inconsistency, or already consistent). Needs a dedicated read, not covered by this survey's grep pass.

4. **Bracket bye/TBD state** — `KnockoutBracket.vue`'s `.kb-tbd` class (`color: #475569` on `.kb-tbd .kb-name` — already a neutral slate, not brand color) marks an unfilled bracket slot. Likely stays untouched regardless (never was emerald/cyan), flagging only so a task brief doesn't misread "empty bracket slot" as needing an accent treatment.

## `.surface-flat` candidate assessment — this zone's headline surface decision, treat as first-class

This is the FIRST wave across the entire 9-waves-so-far redesign to actually need `.surface-flat` — Hub and Play only ever used `.surface-solid`. Two genuine candidates found:

1. **`CompetitionPage.vue`'s standings-table container** (line ~60): `class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800/40 to-slate-900 backdrop-blur shadow-2xl overflow-hidden"`. This is EXACTLY the kind of container the spec describes `.surface-flat` for ("prioriza densidad/legibilidad de tablas") — but it's a hand-rolled 3-stop gradient with blur+shadow, NOT the narrow `bg-slate-900/60-70 + backdrop-blur-md` 2-value pattern that Hub/Play's surface-migration rule was scoped to. Converting this would be a bigger move than any prior wave's surface work — genuinely broadening scope, not just applying the existing narrow rule. **This is a real decision point for whoever writes the plan**: either (a) hold the same narrow-pattern-only line every prior wave held and leave this untouched (consistent, low-risk, but arguably contradicts the spec's explicit intent for THIS zone, since `.surface-flat` would then never get used anywhere), or (b) treat Zona Data as the deliberate exception where `.surface-flat` gets adopted more broadly, since the spec singles out "tablas y brackets" by name and this is literally that. Recommend option (b) specifically for table/bracket containers (not a blanket broadening to every card in the zone) — but this needs an explicit ruling in the actual plan, don't default silently either way.

2. **`KnockoutBracket.vue`'s `.kb-card`** (and by extension `TournamentBracket.vue`'s likely-similar container, not yet read in detail) — currently `border: 1px solid rgba(255,255,255,0.1)` with (need to confirm) no shadow/blur already — this may be ALREADY structurally close to `.surface-flat`'s spec (thin border, no shadow/blur), just needs the border tint swapped from white to `--data-*` and confirmed no shadow/blur exists elsewhere in the rule. The literal spec name-check ("brackets") makes this the single most spec-aligned target in the whole zone.

`Teams.vue`, `CompetitionsHub.vue`, `Leaderboards.vue`, `TeamPage.vue` not yet checked for surface patterns — do this during plan-writing, not assumed here.

## Cross-zone shared-component check

- `AppLoader.vue` (`src/components/common/`) — generic loading spinner, used by `Teams.vue` here; likely used by many other pages across all 3 zones (not verified). If it has zone-specific brand color, it's a cross-cutting primitive in the same category as Hub's `AppButton.vue`/global `.input` — do NOT recolor it for Data alone, same deferral reasoning already established twice.
- No other cross-zone sharing found — Zona Data's own subcomponents (`KnockoutBracket`, `TournamentBracket`, `LeaderboardTable`, `PeriodTabs`, `GameFilter`) are each single-consumer within this zone, not shared with Hub or Play.
- Since this is the LAST zone, there's no forward-compatibility concern the way Hub Wave 3 had to think about future Zona Juego — any exclusion here is terminal, not deferred to a future zone.

## Dead code found

None found in this pass — all 11 files traced to a real route or a real single/known consumer. Not exhaustively reachability-checked the way prior waves' surveys did (e.g. no grep sweep for orphaned `src/pages/leagues/*` or `src/components/league/*` siblings beyond the 2 already found) — worth a quick confirmation pass before finalizing a plan, same standing dead-code authorization applies if anything turns up.

## Proposed sub-wave breakdown (3 waves, mirroring Hub's split, ordered by risk/leverage)

1. **Data Wave 1 — Competitions + brackets** (`CompetitionsHub.vue` + `CompetitionPage.vue` + `KnockoutBracket.vue` + `TournamentBracket.vue`, ~1,392 lines): the heaviest-density cluster, contains the new goal-difference semantic, the qualification-zone data-bound color, and BOTH `.surface-flat` candidates. Do this first — same "build the shared/complex piece first" logic Play Wave 1 used for `GameShell.vue`, since the surface-flat ruling made here sets precedent for the rest of the zone the same way Play Wave 1's monochrome-gold ruling did.
2. **Data Wave 2 — Leaderboards** (`Leaderboards.vue` + `LeaderboardTable.vue` + `PeriodTabs.vue` + `GameFilter.vue`, ~307 lines): smaller, more mechanical, reuses the Wave 1 `.surface-flat` ruling if applicable rather than re-deriving it.
3. **Data Wave 3 — Teams** (`Teams.vue` + `TeamPage.vue`, ~1,277 lines... note `TeamPage.vue` at 879 lines is large but low color-density per the grep scan above, so likely much of that length is data-rendering/layout, not recolor work): last, since `TeamPage.vue`'s low density suggests it's more about careful reading than heavy mechanical replacement.

Order isn't sacred — Wave 1's surface-flat ruling is the one piece worth front-loading regardless of final grouping, since every other file benefits from that decision already being made.
