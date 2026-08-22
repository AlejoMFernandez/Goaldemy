# Hub Zone — Wave 3 (Pricing + Tienda + Notifications + Messages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Hub zone's design system (violet-indigo accent, `.surface-solid` surfaces, Space Grotesk weight ceiling) to Goaldemy's monetization and messaging surface — `Pricing.vue`, `Tienda.vue`, `Notifications.vue`, `DirectMessages.vue`, `DirectChat.vue` — continuing the rollout Wave 1 started on `Landing.vue`/`PlayPoints.vue` and Wave 2 continued on `FriendsDock.vue`/`Profile.vue`.

**Architecture:** No new shared component. Smaller in scope than it first looks: a pre-implementation color-provenance audit (see "Scope note" below) found that most of `Tienda.vue`'s color usage is either currency-identity (shared cross-zone, not brand chrome) or possession-state (semantic), and `PlanCard.vue`'s entire tier-driven palette already routes through a data service that never used emerald/cyan to begin with — both are excluded from this wave's task list, not because they were skipped, but because applying the existing Global Constraints to them correctly yields zero changes. The actual work is 3 tasks: `Pricing.vue`'s own template, `Notifications.vue` + the shared `AppH1.vue`, and `DirectMessages.vue` + `DirectChat.vue`.

**Tech Stack:** Vue 3 (`<script setup>` and Options API mixed), Vue Router 4, Tailwind CSS v4. Foundation + Wave 1 + Wave 2 tokens already merged to `main` (`--hub-300/400/500`, `.surface-solid`, `--mb-radius-*`, Space Grotesk, `GameCard.vue`). No test framework — verification is `npm run dev`/`npm run build` + live checks (Playwright MCP if available; HTTP/build/diff-level verification as the established fallback if not — see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Scope note: color-provenance audit findings (read before touching anything)

A pre-implementation audit traced every emerald/cyan color usage in the 5 named files plus their subcomponents (`PlanCard.vue`, `ShopCard.vue`, `CurrencyIcon.vue`, `PassCosmetic.vue`, `AppH1.vue`) back to its actual meaning, not just its literal Tailwind class name. This produced two exclusions and one addition beyond the 5 originally-named files:

**Excluded — `src/components/pricing/PlanCard.vue` (no task, no changes):** its entire visual identity (`border`, `badge`, `cta`, `accent`, `dot`, `glow` per plan tier) comes from `src/services/plans-ui.js`'s `planStyle(slug)` function — a data-driven map, exactly the same category as `TIER_TINT` in Wave 2's `LevelProgressionModal.vue` (Global Constraint rule 5: data-driven maps stay untouched regardless of which literal color they resolve to). Read the file: `legend` uses amber, `pro` uses fuchsia→violet, `free` uses slate/white — **it never used emerald or cyan at all**, so the standard recolor mapping has nothing to touch. The only genuinely-emerald element in the whole file is the `bg-emerald-500 text-black` "Tu plan" badge, which is a confirmation-of-current-state indicator (this IS the plan you're subscribed to right now) — the same category as Wave 2's "reached"/"owned" checkmarks (Global Constraint rule 1), not decorative chrome. Ruling: excluded.

**Excluded — `src/pages/Tienda.vue` + `src/components/shop/ShopCard.vue` + `src/components/shop/CurrencyIcon.vue` + `src/components/rewards/PassCosmetic.vue` (no task, no changes):** every emerald/cyan hit in these 4 files is either (a) the "Fichas" (soft currency) identity color — the wallet chip, its hover explainer, the buy-button gradient, and `CurrencyIcon.vue`'s hand-drawn SVG artwork for the Fichas coin all use the same emerald→cyan gradient as ONE coherent visual identity for that specific in-game currency, parallel to how "Balón de Oro" (hard currency) has its own amber identity that was never emerald/cyan to begin with and is correctly out of scope either way — or (b) the "Ya lo tenés" owned-state badge on `ShopCard.vue` (possession semantic, rule 1). Grepping confirmed `CurrencyIcon.vue` and `PassCosmetic.vue` are used well beyond Hub-zone pages — `StatChallenge.vue`, `OnceIdeal.vue` (games), `LevelUpOverlay.vue`, `MonthlyPass.vue` (rewards/pass-center) are all future "Zona Juego" territory (gold accent, not yet planned), plus `AdminBattlePass.vue`. Recoloring the Fichas identity to Hub violet now would (1) make the currency's own icon and its "buy" button visually disagree with each other if only one changed, and (2) preemptively lock in a cross-zone currency-color decision that isn't this wave's call to make — the exact same reasoning Wave 2 used to defer `AppButton.vue` and the global `.input` focus ring rather than recolor a shared cross-zone primitive from inside a single-zone wave. Ruling: excluded, flagged here (not a separate ticket) as a currency-identity color decision the owner may want to make explicitly in a future cross-zone pass, the same way Wave 1 flagged the dual "live"-indicator colors for the owner's sign-off.

**Discovered but NOT in this plan's scope — `src/pages/social/GlobalChat.vue`:** the audit's reachability check (grepping every file this wave's components import, per the same method Wave 2 used to find its 7 dead files) turned up that `GlobalChat.vue` is imported by nothing and has no route in `router.js` — it appears to be dead code, same category as the 7 profile components Wave 2 found and the project owner has since deleted. It is NOT one of this wave's 5 named files, so this plan does not investigate or touch it further — flagging its existence is as far as this plan's scope goes; a future pass (or the owner directly) can verify and delete it under the same standing dead-code authorization used for Wave 2's cleanup.

**In scope, 1 file added beyond the original 5 — `src/components/common/AppH1.vue`:** a 3-line shared heading component used by `Notifications.vue`, `DirectMessages.vue`, and `DirectChat.vue` (all 3 in this wave), and also by `GlobalChat.vue` (dead, above) and 4 auth pages (`Register.vue`, `Login.vue`, `VerifyEmail.vue`, `ResetPassword.vue` — which the spec already says "heredan la identidad Hub por defecto"). It has no emerald/cyan color of its own (its gradient is `from-white to-slate-300`), so there is no cross-zone color risk in touching it — but it IS a `.font-display` + `font-extrabold` combo, which the font-weight-ceiling rule (Global Constraint below) requires fixing. Because the font-weight rule is zone-agnostic (Space Grotesk's missing 800 weight is a font-loading fact, not a per-zone color decision), fixing this file is safe regardless of which zone every one of its consumers eventually belongs to, unlike the currency-color case above. Folded into Task 2 below (dispatched together with `Notifications.vue`, since that's this wave's first task that touches a file importing it) rather than given its own task, since it's a single one-line change.

## Global Constraints

- **Color mapping** (apply ONLY to instances classified as decorative brand chrome — see the "what must NOT be recolored" list, which is longer and more consequential than the mapping table itself in this particular wave): `emerald-400`→`violet-400`, `emerald-500`→`indigo-500`, `cyan-400`→`purple-400`, `cyan-500`→`purple-500`. Established vocabulary from Wave 1/2 (reuse, don't invent variants): solid CTAs/buttons → `from-indigo-500 to-purple-500`; icon/text accents → `violet-400`/`violet-300`; borders/rings → `border-violet-400/*`; own-message chat bubbles → `bg-gradient-to-br from-indigo-500/* to-purple-500/* border-violet-400/*` (exact pattern already used in Wave 2's `FriendsDock.vue`, reused verbatim in this wave's `DirectChat.vue` task since it's the same feature rendered in two places).

- **What must NOT be recolored, left exactly as-is:**
  1. **Possession/confirmation state indicators** — a badge or checkmark confirming "this is the plan/item/state that is currently yours" (e.g. `PlanCard.vue`'s "Tu plan" badge, `ShopCard.vue`'s "Ya lo tenés" badge, read-receipt checkmarks on chat messages). Distinguish this from a **static content checkmark** that means the same thing for every viewer regardless of their own account state (e.g. `Pricing.vue`'s comparison-table checkmark next to "9 modos de juego" — every plan includes this, it's not tied to what the current user owns) — those DO recolor, they're decorative iconography, not a per-user state indicator. When you hit an ambiguous checkmark not named explicitly in a task below, ask: does its color depend on THIS user's specific account state, or is it the same for everyone? User-state-dependent → stays. Same-for-everyone → recolors.
  2. **Currency-identity color** — anything conveying "this is Fichas" or "this is Balón de Oro" (the wallet chips, `CurrencyIcon.vue`'s artwork, currency-conditional button styling in `Tienda.vue`). Already fully excluded from this wave per the Scope note above — no task touches these, and no task should introduce a new touch to them either.
  3. **Any color driven by a data/tier lookup service** (`planStyle()` in `plans-ui.js`, `rarity()`/`frameStyle()`/`bannerStyle()` in `cosmetics.js`) — untouched regardless of which literal color it resolves to today.
  4. **Danger/pending-state semantics** — red/rose (e.g. a "reject" action), amber (a pending/awaiting-response state). Never touched by the emerald/cyan mapping since they were never emerald/cyan.
  5. **Anything never emerald/cyan to begin with** — amber/gold (PRO/prestige), fuchsia/violet (pro-tier plan color, already coincidentally close to Hub), sky/blue (an unrelated accent), slate (neutral/free-tier).

- **Surface migration — narrowly scoped, exactly the sanctioned pattern**: a literal existing `class="card ..."` → `class="surface-solid ..."` (one-word swap, nothing else on the element changes). This wave has exactly 2 such instances (`DirectMessages.vue`, `DirectChat.vue`), both `class="card p-0 overflow-hidden"`. No file in this wave has the other sanctioned pattern (`bg-slate-900/60-70 + backdrop-blur-md`) — do not invent a match where the shade/blur doesn't line up exactly (e.g. `ShopCard.vue`'s `bg-slate-800/60` is a different shade with no blur — not a match, correctly excluded above).

- **Font weight**: every `.font-display` element combined with `font-extrabold` or `font-black` drops to `font-bold` (Space Grotesk tops out at weight 700 — decided in Foundation, applied in Wave 1 and Wave 2). This wave has exactly 2 such instances: `AppH1.vue` (shared, Task 2) and `Pricing.vue`'s confirmation-modal title (Task 1). Do not touch `font-extrabold` that is NOT paired with `.font-display` (e.g. `Pricing.vue`'s plain `<h1 class="text-3xl sm:text-4xl font-extrabold mb-3">` hero heading, or its modal price text `text-2xl font-extrabold text-white` — neither uses `.font-display`, both stay).

- **Verification fallback**: Playwright MCP has been unreliable/disconnected for stretches of this session. Try it first for live visual checks; if unavailable, fall back to `npm run dev` (reuse the already-running instance if one exists) + HTTP-200 checks on the routes touched + careful line-level diff correctness — this fallback was used successfully for all of Wave 2 and is not itself a defect to flag.

- Do not touch backend/RPC/checkout logic — `Pricing.vue` in particular drives real Mercado Pago checkout state; this wave is templates/styles only, same constraint as every prior wave.
- Every task must leave `npm run dev`/`npm run build` clean with no new console errors.
- Reuse existing tokens/classes (`--hub-300/400/500`, `.surface-solid`) — do not invent new design-system primitives.

---

## Task 1: Migrate `Pricing.vue` to the Hub design system

**Files:**
- Modify: `src/pages/Pricing.vue`

**Interfaces:** none (standalone page, no props/emits change). Does not touch `src/components/pricing/PlanCard.vue` — see Scope note, that file needs zero changes.

- [ ] **Step 1: Hero background wash**

Find:
```html
      <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent"></div>
```
Replace with:
```html
      <div class="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent"></div>
```

- [ ] **Step 2: Comparison-table static-row checkmark**

Find:
```html
                <template v-if="row.static">
                  <svg class="w-5 h-5 text-emerald-400 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                </template>
```
Replace with:
```html
                <template v-if="row.static">
                  <svg class="w-5 h-5 text-violet-400 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                </template>
```

Leave the `proOnly` template branch just below untouched — it uses `planStyle(plan.slug).accent` (data-driven, Global Constraint rule 3).

- [ ] **Step 3: Confirmation-modal plan title font weight**

Find:
```html
                  <div class="font-display font-extrabold text-white text-lg leading-tight">Plan {{ confirmPlan.name }}</div>
```
Replace with:
```html
                  <div class="font-display font-bold text-white text-lg leading-tight">Plan {{ confirmPlan.name }}</div>
```

- [ ] **Step 4: "Usa otro e-mail" checkbox accent**

Find:
```html
                <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" v-model="useOtherEmail" class="accent-emerald-500 w-4 h-4 rounded" />
                  Mi cuenta de Mercado Pago usa otro e-mail
                </label>
```
Replace with:
```html
                <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" v-model="useOtherEmail" class="accent-indigo-500 w-4 h-4 rounded" />
                  Mi cuenta de Mercado Pago usa otro e-mail
                </label>
```

- [ ] **Step 5: Billing-email input focus ring**

Find:
```html
                      class="w-full rounded-xl border bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400/60"
```
Replace with:
```html
                      class="w-full rounded-xl border bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-violet-400/60"
```

This is a page-specific input, not the shared global `.input` class (that one stays emerald app-wide per Wave 2's precedent, deliberately deferred as a cross-zone primitive) — this is a one-off inline-styled input local to `Pricing.vue`'s confirmation modal, so it's fair game the same way `FriendsDock.vue`'s inline chat/search inputs were recolored in Wave 2 despite the global `.input` class staying untouched.

- [ ] **Step 6: Verify no leftover brand-color references**

```bash
rg 'emerald|cyan' src/pages/Pricing.vue
```
Expected: zero matches. (There were exactly 5 emerald hits before this task — hero wash, table checkmark, modal title context, checkbox accent, input focus ring — all 5 addressed above; nothing else in the file used emerald or cyan.)

- [ ] **Step 7: Live verification**

With the dev server running, navigate to `/pricing`. Confirm: the hero's subtle background wash reads as a faint indigo tint (very subtle at 5% opacity, may need to compare against Wave 1's Landing.vue hero for reference), the comparison table's "static" rows (9 modos de juego, Sistema de XP y niveles, Ranking global) show violet checkmarks, the `proOnly` rows still show `planStyle`-driven fuchsia/amber checks unchanged. Open a plan's subscribe confirmation modal (click "Suscribirme" on a non-free, non-current plan) — confirm the plan-name title still renders correctly (font-bold, not extrabold — spot-check via `getComputedStyle` if visually subtle), the "Ya lo tenés"-equivalent "Tu plan" badge elsewhere on the page (if visible) is still emerald, and the "usa otro e-mail" checkbox + its revealed email input now show violet/indigo accents when interacted with. No console errors. Paste actual observations.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Pricing.vue
git commit -m "feat(hub-zone): migrate Pricing.vue to Hub accent"
```

---

## Task 2: Migrate `Notifications.vue` + `AppH1.vue` to the Hub design system

**Files:**
- Modify: `src/pages/social/Notifications.vue`
- Modify: `src/components/common/AppH1.vue`

**Interfaces:** none. `AppH1.vue` takes no props (just a default slot) — this task changes no interface, only its internal font-weight class.

- [ ] **Step 1: `AppH1.vue` — font-weight ceiling**

Find:
```html
    <h1 class="font-display text-3xl md:text-4xl mb-4 font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300"><slot /></h1>
```
Replace with:
```html
    <h1 class="font-display text-3xl md:text-4xl mb-4 font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300"><slot /></h1>
```

This is a shared component also used by `DirectMessages.vue`/`DirectChat.vue` (Task 3, later in this same wave), `GlobalChat.vue` (dead code, not routed — unaffected either way), and 4 auth pages (`Register.vue`, `Login.vue`, `VerifyEmail.vue`, `ResetPassword.vue` — outside this wave's named scope, but this specific fix is safe for them too since it's a zone-agnostic font-loading fact, not a color/zone decision).

- [ ] **Step 2: `Notifications.vue` — accept-request button**

Find:
```html
              <button @click="onAccept(n.connection.id)" :disabled="busy[n.connection.id]" title="Aceptar" class="inline-flex items-center justify-center rounded-full border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10 w-8 h-8">
```
Replace with:
```html
              <button @click="onAccept(n.connection.id)" :disabled="busy[n.connection.id]" title="Aceptar" class="inline-flex items-center justify-center rounded-full border border-violet-400/40 text-violet-300 hover:bg-violet-400/10 w-8 h-8">
```

Leave the very next button (`onReject`, red/rose border-red-400/40 text-red-300) untouched — danger semantic, Global Constraint rule 4. Leave the unread-notification stripe (`bg-sky-400`) untouched — never emerald/cyan, rule 5.

- [ ] **Step 3: Verify no leftover brand-color references**

```bash
rg 'emerald|cyan' src/pages/social/Notifications.vue
rg 'emerald|cyan|font-extrabold' src/components/common/AppH1.vue
```
Both expected: zero matches.

- [ ] **Step 4: Live verification**

With the dev server running, navigate to `/notifications` (needs an incoming connection request to see the accept/reject buttons — if the logged-in test account has none pending, note this honestly rather than fabricating a check, and instead verify via the diff + a DOM/computed-style inspection of the button's class list if you can find any request, or confirm via `curl`/HTTP-200 that the page renders without error either way). Confirm the page's `<h1>Notificaciones</h1>` heading (via `AppH1`) still displays correctly and, if you can inspect computed font-weight, confirm it's 700 not 800/900. No console errors. Paste actual observations.

- [ ] **Step 5: Commit**

```bash
git add src/pages/social/Notifications.vue src/components/common/AppH1.vue
git commit -m "feat(hub-zone): migrate Notifications.vue + AppH1.vue to Hub accent"
```

---

## Task 3: Migrate `DirectMessages.vue` + `DirectChat.vue` to the Hub design system

**Files:**
- Modify: `src/pages/social/DirectMessages.vue`
- Modify: `src/pages/social/DirectChat.vue`

**Interfaces:** none. Both already import `AppH1.vue` (fixed in Task 2 — no changes needed here, that fix is already live by the time this task runs since tasks execute in order).

- [ ] **Step 1: `DirectMessages.vue` — surface migration**

Find:
```html
    <section class="card p-0 overflow-hidden">
```
Replace with:
```html
    <section class="surface-solid p-0 overflow-hidden">
```

- [ ] **Step 2: `DirectMessages.vue` — unread-count badge**

Find:
```html
              <div v-if="t.unread > 0" class="shrink-0 ml-2 rounded-full bg-emerald-500 text-white text-[11px] px-2 py-0.5">
```
Replace with:
```html
              <div v-if="t.unread > 0" class="shrink-0 ml-2 rounded-full bg-indigo-500 text-white text-[11px] px-2 py-0.5">
```

- [ ] **Step 3: `DirectChat.vue` — surface migration**

Find:
```html
    <section class="card p-0 overflow-hidden">
```
Replace with:
```html
    <section class="surface-solid p-0 overflow-hidden">
```

(Identical find-string to Step 1, but this is a different file — `src/pages/social/DirectChat.vue`, not `DirectMessages.vue`. Do not skip this step because it looks like the same edit; both files need it independently.)

- [ ] **Step 4: `DirectChat.vue` — own-message bubble tint**

Find:
```html
              :class="[
                'w-fit max-w-[90%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-slate-100 shadow-sm border',
                isOwn(m) ? 'ml-auto bg-emerald-500/15 border-emerald-400/30' : 'bg-white/5 border-white/10'
              ]"
```
Replace with:
```html
              :class="[
                'w-fit max-w-[90%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-slate-100 shadow-sm border',
                isOwn(m) ? 'ml-auto bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border-violet-400/30' : 'bg-white/5 border-white/10'
              ]"
```

This mirrors Wave 2's `FriendsDock.vue` own-message bubble treatment exactly (`bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-violet-400/40`, same feature rendered in the sidebar dock vs. this full page — opacity values here are 15% not 20% to match this file's pre-existing 15%, don't change the opacity level itself, only the hue).

- [ ] **Step 5: `DirectChat.vue` — send button**

Find:
```html
              <button type="submit" class="shrink-0 rounded-full bg-emerald-500 hover:brightness-110 text-white h-10 w-10 grid place-items-center">
```
Replace with:
```html
              <button type="submit" class="shrink-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 text-white h-10 w-10 grid place-items-center">
```

Leave the read-receipt checkmark icons untouched (the `text-emerald-500` "read" double-check, the `text-slate-400` "sent" single-check, the `text-red-400` "failed" icon, the `text-slate-400/70` "pending" clock icon) — possession/confirmation-state semantics, Global Constraint rule 1, exact same category as `FriendsDock.vue`'s read-receipts in Wave 2.

- [ ] **Step 6: Verify no leftover brand-color references**

```bash
rg 'emerald|cyan|class="card' src/pages/social/DirectMessages.vue
rg 'emerald|cyan|class="card' src/pages/social/DirectChat.vue
```
`DirectMessages.vue` expected: zero matches. `DirectChat.vue` expected: exactly one remaining `emerald` match — the read-receipt checkmark (`text-emerald-500` inside the `m.read` branch) — and zero `class="card` matches in either file.

- [ ] **Step 7: Live verification**

With the dev server running, navigate to `/messages` — confirm the conversation-list card now sits on a `.surface-solid` background (flat navy, no gradient) and any unread badge is indigo, not emerald. Open a conversation (`/messages/:peerId` — use any existing conversation on the logged-in test account, or send a message to yourself/a friend if none exist) — confirm the chat panel is also `.surface-solid`, your own sent messages show an indigo/purple-tinted bubble (not emerald), the send button is an indigo→purple gradient, and read-receipt checkmarks are unchanged (emerald when read). No console errors. Paste actual observations.

- [ ] **Step 8: Commit**

```bash
git add src/pages/social/DirectMessages.vue src/pages/social/DirectChat.vue
git commit -m "feat(hub-zone): migrate DirectMessages.vue + DirectChat.vue to Hub accent + surface-solid"
```

---

## Self-Review Notes

- **Spec coverage:** all 5 originally-named files are accounted for — 3 get real edits (`Pricing.vue`, `Notifications.vue`, `DirectMessages.vue`+`DirectChat.vue` across Tasks 1-3), 1 correctly needs zero edits under the existing Global Constraints (`Tienda.vue`, plus its `ShopCard.vue` subcomponent), with the reasoning fully documented in the Scope note rather than silently dropped. `PlanCard.vue` (an implied subcomponent of `Pricing.vue`) also correctly needs zero edits, same treatment. `AppH1.vue` was added to scope with explicit justification (zone-agnostic font-weight fix, not a color decision) rather than left as an unexplained scope expansion.
- **Placeholder scan:** no "TBD"/"handle appropriately"/"similar to Task N" — every step has literal Find/Replace code.
- **Type/signature consistency:** no props, emits, or component interfaces change anywhere in this plan — template/class-only, like Wave 2. Nothing for later tasks to depend on that earlier tasks define.
- **Semantic-color judgment calls, stated once here rather than repeated per task:** the "possession-badge vs. static-content-checkmark" distinction (Global Constraint rule 1) is this wave's least obvious call and is the reason `Pricing.vue`'s two checkmark-looking elements get opposite treatment (comparison-table checkmark recolors, "Tu plan" badge doesn't) — flagged explicitly in Task 1's steps so the distinction isn't lost. The currency-identity exclusion (rule 2) is the wave's biggest scope decision and is why this plan is 3 tasks instead of a Wave-2-sized 6+ — documented at length in the Scope note specifically so a reviewer doesn't mistake "no task for Tienda.vue" for an oversight.
- **Discovered, explicitly out of this plan's scope:** `GlobalChat.vue` appears to be dead code (unreachable, same pattern as Wave 2's 7 deleted profile files) — flagged in the Scope note, not investigated further or added as a task, since it wasn't one of this wave's named files.
