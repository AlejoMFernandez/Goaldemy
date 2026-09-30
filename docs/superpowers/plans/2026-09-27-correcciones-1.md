# CORRECCIONES 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, same-session — owner already asked to "fix everything" directly, no per-task subagent review). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 16 concrete bugs/polish items Alejo found testing with a fresh account (entry/account flow, typography, dead-code cleanup, popups/overlays, level-up scene, sound queueing), then smoke-test, build, `graphify update .`, and commit to `feature/motion-09-otros-juegos` (no push).

**Architecture:** This is a Vue 3 + Vite SPA (no unit-test harness for UI behavior) — "tests" here are `npm run build` (compile correctness) + manual verification via the running dev server (and browser automation for screenshots where visual). Each task below is independently shippable; do them in order top-to-bottom since a few later ones touch files earlier ones also touch (LevelUpOverlay).

**Tech Stack:** Vue 3 (Options + `<script setup>` mix), vue-router, Supabase JS client, Tailwind utility classes + scoped component CSS, Web Audio API (`sounds.js`), custom `game-fx.js` FLIP-style animation helpers.

**Spec:** User's message in this conversation (16 numbered items, Spanish). No separate spec file — this plan doc is authoritative, built from direct code investigation of every referenced component.

## Global Constraints

- No new dependencies. No commented-out "// removed" cruft — delete dead code outright (owner has standing permission, confirm with grep first).
- Keep `--font-shout` as the CSS var name (already used everywhere); only its *value* changes (Anton → Barlow Condensed 800 italic caps).
- Don't touch already-correct accent-insensitive search code (`players.js`, `countries.js`, `global-search.js`, `PlayerSearch.vue`) — only fix the ones missing it.
- Don't push. Commit only, on `feature/motion-09-otros-juegos`.
- Brand name is always "FULVO" uppercase in any new user-facing copy.

## Review Focus

- Google OAuth back-button repro must be tested via actual browser back navigation (bfcache), not just code review — this is a browser-cache-state bug.
- Sound queue reproduction (item 16) needs the exact scenario Alejo gave: new account, Nacionalidad, 9/10 right + loss then a win with level-up + 3 achievements + 1 legendary icon — verify no two "big" sounds overlap.
- LevelUpOverlay's "Desbloqueaste" rework (item 15) changes state machine timing (`lp` phases) — must not break the `skip()` fast-forward path or the rank-cards act (untouched).
- Data-URI SVG backgrounds elsewhere in the codebase may share the unescaped-`#` bug found in GameSummaryPopup's balls row — only fixing the one flagged, but keep an eye out.
- Popup scroll fix must not clip the `.next` prize-card row or the CTA buttons on a 720p laptop viewport.

---

## Task 1 — AppSplash cleanup (item 1)

**File:** `src/components/common/AppSplash.vue`

- [ ] Remove `.sp-pitch` (the `.sp-mid` line + `.sp-ring` SVG circle) from the template and their CSS/keyframes (`sp-grow`, `sp-draw`, `sp-fade` for the ring dot).
- [ ] Tighten spacing: reduce `.sp-word`'s `top` offset (currently `calc(50% + min(25vmin,125px) + 14px)`) so FULVO sits closer to the crest now that the ring is gone — try `+ 4px` instead of `+ 14px`, and shrink `.sp-crest` margin implicitly via the reduced gap. Verify visually at the end.
- [ ] Remove now-dead `reduced-motion` overrides referencing `.sp-mid`/`.sp-ring`.

## Task 2 — Accent-insensitive search everywhere (item 2)

**Files:**
- Create: `src/services/text.js` — export `normalizeSearch(s)` (lowercase, NFD, strip diacritics, trim; same logic already duplicated in `PlayerSearch.vue`/`players.js`/`countries.js`/`global-search.js`).
- Modify: `src/components/common/SearchSelect.vue` (`items()` computed, line ~20-24) — use `normalizeSearch` on both query and `o.label`.
- Modify: `src/components/FriendsDock.vue:124`, `src/pages/Teams.vue:251-253`, `src/components/admin/AdminTeamsManagement.vue:150`, `src/components/admin/AdminBattlePass.vue:140` — swap `.toLowerCase().includes(q)` for `normalizeSearch(...).includes(normalizeSearch(q))`.
- Leave `PlayerSearch.vue`, `players.js`, `countries.js`, `global-search.js` as-is (already correct) — do not refactor working code.

- [ ] Write `src/services/text.js`.
- [ ] Wire it into `SearchSelect.vue` (this is what registration's "jugador/equipo favorito" uses — the exact repro in item 2).
- [ ] Wire it into the 4 other spots listed above.
- [ ] `npm run build` to confirm no import errors.

## Task 3 — Google OAuth back-button lockout (item 3)

**File:** `src/pages/auth/AuthPage.vue`

Root cause: `handleGoogle()` sets `loading = true` then redirects to Google. If the user hits browser Back, Chrome restores the page from **bfcache** with `loading` still `true` in memory (no fresh mount), so the submit/Google buttons stay disabled until a manual F5 remounts the component.

- [ ] In the `<script>` `methods`, add a `pageshow` listener in a new `mounted()` hook: `window.addEventListener('pageshow', this.onPageShow)`; remove it in `beforeUnmount`/`unmounted`.
- [ ] `onPageShow(e) { if (e.persisted) { this.loading = false; this.error = '' } }` — resets stuck state when the page is restored from bfcache.
- [ ] Manually verify: open `/login`, click "Iniciar sesión con Google", then press the browser Back button before completing Google's flow — form must be usable immediately (no F5 needed).

## Task 4 — Email confirmation return flow (item 4)

**Files:**
- Modify: `src/services/auth.js` — `register()` line ~141, change `emailRedirectTo: `${origin}/login`` to `` `${origin}/login?confirmed=1` ``.
- Modify: `src/pages/auth/AuthPage.vue` — on mount, if `this.$route.query.confirmed === '1'`, show `pushSuccessToast('¡Cuenta confirmada! Ya podés entrar')` once, then strip the query param via `router.replace`. Also broadcast to any other open tab via `BroadcastChannel('fulvo-auth')`.
- Modify: `src/pages/auth/VerifyEmail.vue` — listen on the same `BroadcastChannel('fulvo-auth')` for a `{type:'email-confirmed'}` message; on receipt, show the same toast/notice inline and offer/auto-navigate to `/login`.
- Fallback for browsers without `BroadcastChannel` (rare) — wrap in `try/catch`, feature-detect `'BroadcastChannel' in window`.

- [ ] Update `emailRedirectTo` in `auth.js`.
- [ ] Add confirm-toast + BroadcastChannel post in `AuthPage.vue`.
- [ ] Add BroadcastChannel listener in `VerifyEmail.vue`.
- [ ] Note for Alejo (surface in final summary, not code): Supabase Dashboard → Auth → URL Configuration → Redirect URLs must include `<site>/login` (already required today) — no change needed there since we're still redirecting to `/login`, just adding a query param.

## Task 5 — Font swap: Anton → Barlow Condensed 800 italic caps (item 5)

**Files:**
- Modify: `src/style.css` — `--font-shout` value (line 12) from `"Anton", "Impact", "Arial Narrow", sans-serif` to `"Barlow Condensed", "Arial Narrow", sans-serif`; add `font-weight: 800; font-style: italic;` is NOT possible via a CSS custom property alone (it only holds `font-family`), so instead add a **companion rule**: every place using `var(--font-shout)` also needs `font-weight:800; font-style:italic; letter-spacing:.01em` — audit each of the 20 usages (`grep -rn "font-shout"`) and add the two missing declarations where not already present (`font-weight:400` currently set in several — change those `400`s to `800` and add `font-style:italic`).
- Files with `var(--font-shout)` needing the weight/style fix (from earlier grep): `style.css`, `PlayPoints.vue`, `AchievementUnlockOverlay.vue`, `RarityReveal.vue` (×2), `GameSummaryPopup.vue` (×2), `TimedEndOverlay.vue`, `PrizeCard.vue`, `LevelUpOverlay.vue` (×4), `DailyEnvelope.vue` (×2), `GamePreviewModal.vue`, `prize-reveal.js` (inline style string), `KickoffOverlay.vue` (×2), `LevelProgressionModal.vue` (×2).
- Remove the `Anton` `@import` from `src/style.css` line 2 (keep Barlow Condensed 700/800 which is already imported) — drop the `family=Anton&` segment only.
- `docs/moodboards/*.html` are reference mockups, not shipped app code — leave untouched.

- [ ] Update the Google Fonts `@import` (drop Anton).
- [ ] Update `--font-shout` value.
- [ ] Grep every `font-family: var(--font-shout` usage and ensure `font-weight:800; font-style:italic;` is present (add or fix).
- [ ] Visually confirm "+550 XP" (LevelUpOverlay `.lvo-num .n`), "¡A tu alcance!" — wait, that one's `.pv-prize .card .pl` uses `--font-bug` not `--font-shout`, only fix what actually uses `--font-shout`. Re-check "¡A tu alcance!" span class in GamePreviewModal.vue: it's plain text, no explicit font — verify at runtime; if it inherits Inter, that's correct already and NOT part of this task (only actual `--font-shout` users are in scope, per item 5's own list of examples — verify each really uses the shout font and only touch those).
- [ ] `npm run build`.

## Task 6 — Remove confetti (item 6)

**Files:**
- Delete: `src/services/confetti.js`.
- Modify (remove import + calls): `src/services/game-celebrations.js`, `src/services/nationality.js`, `src/services/guess-player-mcq.js`, `src/services/player-position.js`, `src/pages/games/HeightOrder.vue`, `src/pages/games/AgeOrder.vue`, `src/pages/games/ValueOrder.vue`, `src/components/rewards/AchievementUnlockOverlay.vue`, `src/components/rewards/CosmeticUnlockOverlay.vue`, `src/components/rewards/ProWelcomeOverlay.vue`.

- [ ] `grep -rln "services/confetti\|celebrateGold\|celebrateLevelUp\|celebrateWin\|celebrateAchievement\|triggerConfetti" src` for the authoritative call-site list.
- [ ] Remove each import line and each call line (don't leave empty `if` blocks — clean up surrounding logic; these were fire-and-forget calls with no return value used elsewhere, so removal is safe).
- [ ] Delete `src/services/confetti.js`.
- [ ] `npm run build`.

## Task 7 — Remove leftover XP badge + dead-component audit (item 7)

**Files:**
- Delete: `src/services/ui-effects.js` (only export is `spawnXpBadge`).
- Modify (remove import + call): `src/services/nationality.js`, `src/services/guess-player-mcq.js`, `src/services/player-position.js`, `src/pages/games/AgeOrder.vue`, `src/pages/games/HeightOrder.vue`, `src/pages/games/ValueOrder.vue`.
- Dead-component audit: grep each `.vue` under `src/components/` for zero non-declaration references (`grep -rl "ComponentName" src --include=*.vue --include=*.js | grep -v "components/ComponentName.vue"`) — candidates called out by name in the brief: `CircularTimer`, `StreakBadge`, and any pre-rewrite celebration components. Report the list to Alejo before deleting anything not 100%-confirmed-unused (standing permission covers *confirmed* dead code, but confirm with grep each time, no guessing).

- [ ] Remove all `spawnXpBadge` call sites + imports.
- [ ] Delete `ui-effects.js`.
- [ ] Grep for `CircularTimer`, `StreakBadge`, and list every `.vue` file under `src/components/` with 0 importers (excluding itself and route-level pages) — build the candidate-deletion list.
- [ ] Delete confirmed-zero-reference files; leave anything ambiguous and flag it in the final summary instead of guessing.
- [ ] `npm run build`.

## Task 8 — Loss popup balls: fix invisible "hit" balls (item 8)

**File:** `src/components/game/GameSummaryPopup.vue`

Root cause: `.short i` background is a `data:image/svg+xml` URI containing **unescaped `#`** characters (`url(#fulvo-ball-clip)`, `fill="#111827"` etc.) — the `#` prematurely terminates the data URI when parsed as a background-image URL, so the "hit" balls render with no background at all (invisible), while the "missing" balls (`.short i.no`, pure CSS dashed border, no data URI) render fine — exactly the symptom reported.

- [ ] Replace `.short i` background with a dependency-free CSS radial-gradient filled circle (no data URI): `background: radial-gradient(circle at 35% 30%, #fff, #cbd5e1 60%, #94a3b8); box-shadow: inset -2px -2px 2px rgba(15,23,42,.35);`.
- [ ] Leave `.short i.no` (dashed red outline for misses) unchanged.
- [ ] Verify in a lost game: hit balls now render as filled light-gray spheres, misses stay dashed-red-outline.

## Task 9 — Next-reward copy + PrizeCard hover/tap zoom (item 9)

**Files:**
- Create: `src/components/rewards/PrizePeek.vue` — wraps a small `<PrizeCard>` trigger; on `@mouseenter` (only when `matchMedia('(hover:hover)').matches`) shows a floating enlarged preview near the card; on `@click` toggles a centered `Teleport`-to-body lightbox with `<PrizeCard size="l">` and a `@click.self` backdrop to close (covers both "hover en desktop" and "tap en celular").
- Modify: `src/components/game/GameSummaryPopup.vue` — `.next` block (~line 355-361): replace `<PrizeCard :prize="nextPrize.prize" :size="46" />` with `<PrizePeek :prize="nextPrize.prize" :size="46" />`; change the copy to name the reward type using `PRIZE_TYPE_LABEL[nextPrize.prize.kind]` lowercased: `te espera el <b>{{ typeLabel }}</b> "<b>{{ nextPrize.prize.name }}</b>"` (all kinds reaching this text are masculine in Spanish: ícono/borde/banner/título/rango/juego, so "el" is always correct).
- Modify: `src/components/game/GamePreviewModal.vue` — same `PrizePeek` swap for the `.pv-prize .card` block; its label text ("Premio NV X" / "¡A tu alcance!") doesn't name the reward today either — leave the "¡A tu alcance!" state text as-is (it's about reachability, not identity) but the surrounding `<span class="pl">Premio NV {{ nextPrize.level }}</span>` state could optionally also gain the type — out of scope unless time allows, item 9's example text is specifically the GameSummaryPopup one.
- Import `PRIZE_TYPE_LABEL` from `@/services/prize-card` in both files.

- [ ] Build `PrizePeek.vue`.
- [ ] Wire into `GameSummaryPopup.vue` with the new copy.
- [ ] Wire into `GamePreviewModal.vue`.
- [ ] Verify: hover on desktop enlarges the card; tap on mobile (simulate via devtools touch emulation) opens the lightbox.

## Task 10 — Popup scroll on short viewports (item 10)

**Files:** `src/components/game/GameSummaryPopup.vue` (`.sm`), `src/components/game/GamePreviewModal.vue` (`.pv`).

- [ ] `.sm { max-height: calc(100dvh - 32px); overflow-y: auto; }` (32px = the wrap's 16px padding ×2) — buttons live inside `.sm`, so they scroll into reach automatically.
- [ ] `.pv { max-height: calc(100dvh - 32px); overflow-y: auto; }` at the base rule (outside the existing `@media max-width:560px` block, which already has its own `max-height:94vh` for the mobile bottom-sheet variant — don't touch that one, only add the desktop/laptop case).
- [ ] Verify at a 1366×720 (13" laptop) viewport with devtools: both popups fully scrollable, CTA reachable.

## Task 11 — AchievementUnlockOverlay: match LevelUpOverlay's blur (item 11)

**File:** `src/components/rewards/AchievementUnlockOverlay.vue`

`.ach-dim` currently only fades a flat `#02030a` background (no blur). `LevelUpOverlay.vue`'s `.lvo-bg` additionally has `backdrop-filter: blur(10px) saturate(.6) brightness(.6)`.

- [ ] Add `-webkit-backdrop-filter: blur(10px) saturate(.6) brightness(.6); backdrop-filter: blur(10px) saturate(.6) brightness(.6);` to `.ach-dim`.
- [ ] Verify legendary vs rare achievement scenes both show the blurred/darkened background behind, matching level-up's look.

## Task 12 — Fix broken medal flight (item 12)

**File:** `src/components/rewards/AchievementUnlockOverlay.vue` (`flyToAvatar()`, ~line 158-209).

Two concrete bugs found:
1. The medal can be captured mid `ach-float` idle-bob (`translateY(-6px) rotate(-2deg)`), then `.ach.flying .ach-coin { animation:none !important }` snaps it back to neutral the instant flight starts → visible jerk.
2. The ornate coin chrome (dotted ring `::before`, radial-gradient sphere background, box-shadow) scales down to ~40px avatar-icon size along with the tile — at that size it reads as smudged/broken rather than a clean icon, and it lingers at `opacity:.15` instead of fully fading.

- [ ] In `flyToAvatar()`, before reading `startRect`, force-stop any running animation and reflow: `iconEl.style.animation = 'none'; void iconEl.offsetHeight;`.
- [ ] Add `.ach.flying .ach-coin::before { display:none; } .ach.flying .ach-coin { box-shadow:none; background:transparent; }` so only the clean `AchievementTile` glyph travels, not the decorative coin chrome.
- [ ] Change the final flight opacity from `hasAnchor ? 0.15 : 0` to `0` (full fade — the avatar's own `avatar-receive` bounce animation is the payoff, no lingering ghost).
- [ ] Verify: unlock a legendary/epic achievement, claim it, watch the flight to the avatar — should be a clean, jerk-free shrink-and-fade, not a snap + smudge.

## Task 13 — Game-entry transition: poster zoom instead of flat yellow (item 13)

**Files:** `src/App.vue` (`.route-curtain`, `pickTransition()`).

Root cause: `.route-curtain` is a flat gold radial-gradient (`#fde68a → #f59e0b → #b45309`) clip-path wipe — same color for every game, no artwork — which reads as "a flat yellow screen" instead of "that game's poster growing."

- [ ] In `pickTransition()`, when `toGame && !fromGame`, extract the game slug from `to.path` and dynamically `import('./services/game-art')` (already warm in the module cache from `GamePoster.vue` on the index page) to read `GAME_POSTER_META[slug]` (c1/c2) and `GAME_ART[slug]`.
- [ ] Store `curtainArt` (the art HTML) and `curtainColors` (`{c1,c2}`) in `data()`; pass them into the template.
- [ ] Update `.route-curtain` CSS: background uses `radial-gradient(120% 90% at 50% 40%, var(--c1) 0%, var(--c2) 100%)` (fallback to the current gold if no per-game colors resolved, e.g. navigating to a game whose slug isn't in the map) instead of the hardcoded gold stops; add an inner `<span class="route-curtain-art" v-html="curtainArt">` scaled/centered, fading in as the clip-path expands.
- [ ] Since the dynamic import is async but `pickTransition` runs synchronously in `beforeEach`, do a best-effort: keep a small in-memory cache object at module scope (`let gameArtCache = null`) populated on first resolve so subsequent navigations are synchronous; first-ever game navigation in a session may still show the gold fallback (acceptable — GamePoster.vue on the index page will have already triggered the import in virtually all real navigations since users see the index before clicking a card).
- [ ] Verify on desktop AND mobile: entering a game now shows that game's poster colors/art zooming to fill the screen, not a flat yellow flash.

## Task 14 — LevelUpOverlay: remove the XP bar from the level scene (item 14)

**File:** `src/components/rewards/LevelUpOverlay.vue`

- [ ] Remove the `<div v-if="lp >= 1 && lp < 3" class="lvo-xbar-wrap">...</div>` block (the bar + `×N` combo badge) from Act 2's template — the level scene now shows only `¡Subiste de nivel!` → the "Nivel N" number pop (`.lvo-num`) → (if multi-level) the `N → M` range chip → "Desbloqueaste" cards → Continuar.
- [ ] In `fillBar()`/the `runLevel()` loop, drop the `fillBar(dur)` timer call and the `barW`/`barAnim` state writes (keep the `pum()` calls — the number-pop + sparks + sound stay, only the visual bar goes) — the timing (`t += dur + ...`) can collapse to a fixed short delay between pum beats instead of tying to a fake bar-fill duration; keep it feeling paced (~350-450ms per intermediate level) rather than instant.
- [ ] Remove now-unused `barW`, `barAnim`, `barEl` refs and their CSS (`.lvo-xbar-wrap`, `.lvo-xbar`, keyframe none needed) — keep `.lvo-combo` (still used, now anchored near `.lvo-num` instead of the bar; adjust its `position:absolute` anchor point since its old `right:-14px;top:-30px` was relative to the bar wrapper — re-anchor relative to `.lvo-num`).
- [ ] `npm run build`; verify the XP bar is gone from LevelUpOverlay but still present/unchanged in GameSummaryPopup's `.lvl` bar (that one stays — item 14 only asked to remove it from *this* scene, since "queda solo en el popup final del juego").

## Task 15 — LevelUpOverlay: one-by-one RarityReveal for "Desbloqueaste", commons included (item 15)

**Files:** `src/components/rewards/LevelUpOverlay.vue`, `src/components/rewards/RarityReveal.vue`.

Current: all `cardPrizes` render at once in a grid (`lvo-cards`), flipped in a staggered cascade by `revealPrizes()`; commons get a 250ms wait + flip sound only, no flourish, no hold, no per-card gating.

Wanted: one prize card visible at a time (`RarityReveal`), tap to advance, "Ver todo" to skip all; commons get their own flourish (rise + light sweep + 12 sparks + "pop" sound) and hold ≥1.5s before being advanceable.

- [ ] `RarityReveal.vue`: give `common` real motion instead of `shake:0, parts:0`. Add to the `R.common` config: keep `shake:0` (no tremble — that's rare+), but on flip play a light-sweep CSS class + `burst(12, 110)` sparks (raise `R.common.parts` to `12`) + a new `'pop'` sound. Add a `minHold` field per rarity (`common:1500, rare:1500, epic:1800, legendary:2200`) and after the existing `T(() => { revealed=true; emit('revealed') }, t+700)`, don't let the parent advance before `t + minHold` — simplest: emit `revealed` at `t+700` as today (controls the holographic tilt becoming active) but add a second emit `readyToAdvance` at `t + R.value.minHold` that `LevelUpOverlay` waits for before enabling tap-to-continue.
- [ ] `sounds.js`: add `pop: '/sounds/pop.mp3'` to `SOUND_FILES`, and a `case 'pop':` in `_oscillatorFallback` (small `makeOsc(1046.5,'sine',0.4,0.08)` + `makeOsc(1318.5,'sine',0.35,0.1,0.04)` — a light two-note "pop").
- [ ] `LevelUpOverlay.vue`: replace the `<div class="lvo-cards">` grid + `revealPrizes()` orchestration (in `runLevel()`, the block starting `if (!cardPrizes.value.length) {...} else { cancelReveal = revealPrizes(...) }`) with a step-through: new refs `unlockIndex = ref(0)`, `canAdvance = ref(false)`. Render **one** `<RarityReveal :key="unlockIndex" :prize="cardPrizes[unlockIndex]" @revealed="() => {}" @ready-to-advance="canAdvance = true" />` at a time, a small dot-progress row (`i / N`), a tap-anywhere-on-card `@click="advanceUnlock"` (no-op until `canAdvance`), and a "Ver todo" button that jumps straight to `lp = 3.5` (chips) state, marking all remaining as seen.
- [ ] `advanceUnlock()`: if `!canAdvance` return; `canAdvance.value=false; unlockIndex.value++`; if `unlockIndex.value >= cardPrizes.value.length`, proceed to the XP/ayudas chips + `lp = 4` (mirrors what `onDone` used to do).
- [ ] Keep the rank-cards act (`rankCards`/`runRank()`/the "Al llegar ganás" grid) untouched — item 15 is specifically about "Desbloqueaste" (the level act), not the rank act.
- [ ] `skip()` (background-tap fast-forward) must still work: jump `unlockIndex` to the end and set `lp = 4` directly, same as "Ver todo".
- [ ] Verify: level up with 2+ unlockable prizes including at least one common — each shows full-screen-ish one at a time with its own flourish, tap advances, "Ver todo" skips straight to the chips/Continuar state.

## Task 16 — Sound queue: no overlapping "big" sounds (item 16)

**Files:** `src/services/sounds.js`, `src/components/game/GameSummaryPopup.vue`, `src/components/rewards/AchievementUnlockOverlay.vue`, `src/components/rewards/LevelUpOverlay.vue`, `src/components/rewards/CosmeticUnlockOverlay.vue`.

Root cause: `soundManager.play(name)` fires immediately and independently everywhere; each overlay's own internal timers are individually paced, but nothing coordinates *across* overlays — if the level-up scene's timers and the achievement scene's timers both land in the same real-world moment (e.g. right after GameSummaryPopup closes and both queues drain "at once"), their sounds stack.

The queue-*visibility* ordering already exists and is correct (`notificationsState.achievementActive`/`levelUpActive` gate `showNext()` in each overlay so only one **scene** is ever on screen — resumen → logros → nivel → cosméticos). The bug is purely **audio**: nothing stops two scenes' sounds from both landing in the same instant during a transition handoff (e.g. the outgoing scene's last "coin"/"claim" sound overlapping the incoming scene's first "riser"/"pumSmall").

- [ ] Add a tiny "big sound" gate to `soundManager`: a `_bigLock` timestamp; `playBig(name)` variant used only for the "large" cues (`whistle`, `pum`, `goal`, `cardLegendary`, `cardEpic`, `medalStamp`, `levelUp`) that, if called again within ~250ms of the previous `playBig`, delays the new call by the remaining lock time via `setTimeout` instead of firing immediately (small internal queue of length 1 — the newest big sound always eventually plays, just not simultaneously).
- [ ] Swap the "big" calls in `GameSummaryPopup.vue` (`whistle`/`lose`, `levelUp`/`pumSmall`), `AchievementUnlockOverlay.vue` (`riser`/`riserLong`, `medalStamp`, `achievement`/`cardLegendary`), `LevelUpOverlay.vue` (`goal`, `forge`, `pum`/`pumSmall`) to `soundManager.playBig(...)`; leave small/ambient ones (`blip`, `coin`, `tick`, `notify`, `swoosh`) on plain `.play()`.
- [ ] Confirm the "fácil" in-match achievement toast (`drainEasy()` in `AchievementUnlockOverlay.vue`, already uses `soundManager.play('notify')`) stays a plain soft ding — item 16 explicitly wants this untouched ("solo un 'ding' suave").
- [ ] Manual repro per the brief: fresh account, Nacionalidad, 9 rights + 3 wrongs then a win that triggers level-up + 3 achievements + 1 legendary icon — confirm sounds play in order, never stacked.

---

## Final steps (after all 16 tasks)

- [ ] `npm run build` — must succeed clean.
- [ ] Manual smoke test via dev server + browser automation: splash, register flow (accent search), Google back-button, email confirm toast, font swap spot-check, a full game round (loss popup balls, win popup scroll, level-up scene, achievement flight, sound ordering), game-entry transition. Screenshot each visual point for Alejo.
- [ ] `graphify update .`
- [ ] `git add -A && git commit` on `feature/motion-09-otros-juegos` (no push) — commit message summarizing the 16 fixes.
