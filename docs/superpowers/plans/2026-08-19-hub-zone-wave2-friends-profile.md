# Hub Zone — Wave 2 (FriendsDock + Profile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Hub zone's design system (violet-indigo accent, `.surface-solid` surfaces, Space Grotesk weight ceiling) to Goaldemy's social/profile surface — `FriendsDock.vue` and the `/profile` page's reachable component tree — continuing the rollout Wave 1 started on `Landing.vue`/`PlayPoints.vue`.

**Architecture:** No new shared components this wave (unlike Wave 1's `GameCard.vue` extraction) — this is a pure recolor + two spec-sanctioned surface-class swaps across the files that are actually reachable by a route. A pre-implementation reachability audit (see "Scope note" below) found 7 files in `src/components/profile/` + `src/pages/profile/UserPublic.vue` that are dead code (imported by nothing, or imported only by the also-unrouted `UserPublic.vue`) — these are explicitly excluded from this wave's scope.

**Tech Stack:** Vue 3 (`<script setup>` and Options API mixed), Vue Router 4, Tailwind CSS v4. Foundation + Wave 1 tokens already merged to `main` (`--hub-300/400/500`, `.surface-solid`, `--mb-radius-*`, Space Grotesk, `GameCard.vue`). No test framework — verification is `npm run dev` + Playwright MCP live checks, same method as prior phases.

**Spec:** `docs/superpowers/specs/2026-08-19-visual-redesign-design.md`

## Scope note: dead code excluded from this wave

A grep-based reachability check (`rg` for each component's import across `src/`) found these files are **not reachable from any route** — `/u/:id` and `/profile` both resolve to `Profile.vue` per `src/router/router.js`, which does NOT import any of them:

- `src/pages/profile/UserPublic.vue` — not routed anywhere (imported by nothing).
- `src/components/profile/ProfileHeaderCard.vue` — imported only by the unrouted `UserPublic.vue`.
- `src/components/profile/ProgressCard.vue`, `TierBadge.vue`, `MaxStreaksCard.vue`, `XpByGameCard.vue`, `DailyStreaksCard.vue` — imported by nothing at all.

Recoloring unreachable code has zero user-visible benefit and isn't part of this plan. They're flagged here as a dead-code cleanup candidate for the project owner to action separately — this plan does not delete them (that's a different decision than a design-system migration).

The files below ARE the real, reachable tree rendered by `/profile`, `/u/:id`, and `/profile-edit`, and are this plan's actual scope: `FriendsDock.vue` (global), `Profile.vue`, `CommunityCard.vue`, `ProfileIdentityCard.vue`, `ProfileHoverCard.vue`, `LevelProgressionModal.vue`, `AchievementsCard.vue`, `FeaturedAchievementsModal.vue`, `LoadoutShowcase.vue`, `CosmeticsCollection.vue`, `XpDonutChart.vue`, `ConnectionsCard.vue`, `ProfileEdit.vue`.

`ProfileEdit.vue` itself needs no template edits — its only decorative surface is delegated entirely to `CosmeticsCollection.vue` (Task 5) via a named slot; the rest of its template is plain form markup using global `.input`/`.label`/`.select` classes and the shared `AppButton.vue`, none of which are Hub-specific. It is not a task in this plan.

`ProfileHoverCard.vue` needs no edits either — every color in it is driven by the cosmetics/tier services (`bannerStyle`, `frameStyle`, `iconBgStyle`/`iconThemeBg`, `getTierForLevel`) except one `'emerald'` fallback default, which is out of scope per the Global Constraints below. It's mentioned here for completeness, not as a task.

## Global Constraints

- **Color mapping (apply to every instance classified as "decorative brand chrome" below; do not apply anywhere else):**
  | Old (brand) | New (Hub accent) | Old (brand) | New (Hub accent) |
  |---|---|---|---|
  | `emerald-300` | `violet-300` | `cyan-300` | `purple-300` |
  | `emerald-400` | `violet-400` | `cyan-400` | `purple-400` |
  | `emerald-500` | `indigo-500` | `cyan-500` | `purple-500` |

- **What counts as "decorative brand chrome" (RECOLOR):** gradient CTA buttons, tab/selection-pill active states, generic progress-bar FILL gradients (XP/level/collection-% bars that are NOT driven by a tier-color lookup), decorative header/icon-tile background washes, hover-link/hover-text accents, focus rings, loading spinners, decorative section-divider bars that are literally emerald/cyan today.

- **What is semantic or content-driven and must NOT be recolored, left exactly as-is:**
  1. **Win/loss and possession/confirmation checkmarks or badges** — "owned", "equipped", "reached" indicators (e.g. `ring-2 ring-emerald-400` on an equipped cosmetic, `bg-emerald-500` "owned" checkmark, LevelProgressionModal's "reached" tier checkmark). These represent a *permanent* unlocked/possessed state, not a transient UI toggle.
  2. **Online-status and presence indicators** — `statusDot()` in FriendsDock (`playing`=cyan, `online`=emerald, `offline`=slate), the "en línea" count label, read-receipt checkmarks on messages.
  3. **Reward/XP-earned NUMBER text** (e.g. `+{{ points }} XP`, "¡No te queda ningún logro pendiente!" success message) — stays emerald everywhere it appears, matching the pre-existing, untouched, app-wide `.xp-float` toast component in `style.css` (also emerald, out of scope this wave). Recoloring only the profile page's XP numbers while `.xp-float` stays emerald would create a NEW inconsistency, which defeats the point of this redesign.
  4. **A transient multi-select TOGGLE checkmark is the one exception to rule 1** — `FeaturedAchievementsModal.vue`'s "this achievement is currently one of your 3 featured picks" checkmark is a pickable/un-pickable selection control (you can change your 3 picks anytime), not a permanent possession badge, so it follows the tab/selection-pill recolor rule instead. This is called out explicitly in Task 4 — don't generalize it to other checkmarks.
  5. **Any color keyed off a data-driven map** (`TIERS.color`, cosmetic `rarity()`, medal bronze/silver/gold/diamond rings, plan badges) — untouched regardless of which literal color a given key happens to resolve to today, including when that literal happens to be emerald or cyan (e.g. `LevelProgressionModal.vue`'s `TIER_TINT.emerald`/`TIER_TINT.cyan` entries, `ProfileHeaderCard`-style `accent.bar` maps). These are a separate, already-existing content system this wave does not touch.
  6. **The literal string `'emerald'` used as a prop default / fallback value** for `iconBg` (e.g. `iconBgKey: { type: String, default: 'emerald' }`, `iconBgStyle(eq?.iconBg || 'emerald')`, `CosmeticsCollection.vue`'s `DEFAULT_BG = 'emerald'` constant) — this is a cosmetic-content default (what an unequipped user's icon background looks like), not a CSS branding decision. Changing it would touch `services/cosmetics.js` and ripple into every other cosmetic UI across the whole app (shop, achievements, etc.), none of which are in this wave. Leave every instance of this default untouched.
  7. **Any color that was never emerald/cyan to begin with** — sky/blue ("Redes" section), amber/orange ("Mejores rachas", "Rachas diarias", achievement medals, PRO/prestige badges), red/rose (danger, disconnect), fuchsia (achievement rarity badges). The mapping table only touches literal emerald/cyan; everything else is out of scope by definition, no judgment call needed.

- **Surface migration — narrowly scoped, do not go further than these two exact patterns:**
  1. A container matching the spec's literally-named pattern — `bg-slate-900/60` or `/70` + `backdrop-blur-md` (an elevated "floating card") — migrates to `.surface-solid`, dropping the now-redundant `rounded-*`/`border`/`bg-*`/`backdrop-blur-md` classes it replaces. **Do not also keep a Tailwind `shadow-*` utility class alongside `.surface-solid`** — `.surface-solid` is declared unlayered in `style.css` and already sets its own `box-shadow`; stacking a Tailwind `shadow-2xl` utility on top risks the exact same unlayered-vs-`@layer utilities` collision that produced Wave 1's Important finding (inert win/loss glow). Drop any coexisting Tailwind shadow utility when applying `.surface-solid`.
  2. A literal, already-existing `class="card ..."` usage — the spec explicitly sanctions progressive `.card`→`.surface-solid` migration per zone, and this is a one-word swap with no restructuring. Every other padding/spacing class on the element stays untouched (`.surface-solid` doesn't set padding).
  - **Everything else stays exactly as it is** — raw two/three-stop gradient card backgrounds (`bg-gradient-to-br from-slate-900/80 to-slate-800/50`, etc.) are explicitly deferred to a future pass, consistent with Wave 1's own precedent (see that plan's Self-Review Notes). Do not invent a third surface pattern to migrate.

- **Font weight:** every `.font-display` element combined with `font-extrabold` or `font-black` drops to `font-bold` (Space Grotesk tops out at weight 700 — decided during the Foundation phase, already applied in Wave 1). Do not touch `.font-display` + `font-bold` (already correct) or `font-extrabold` NOT combined with `.font-display` (e.g. plain Inter-font glyphs like the ✓/✕ win/loss symbols, which Inter still supports at 800).

- Do not touch backend/RPC code or any `services/*.js` business logic — this wave is templates/styles only.
- Every task must leave `npm run dev` building with no new console errors.
- Reuse existing tokens/classes (`--hub-300/400/500`, `.surface-solid`, `--mb-radius-*`) — do not invent new design-system primitives in this wave.

---

## Task 1: Migrate `FriendsDock.vue` to the Hub design system

**Files:**
- Modify: `src/components/FriendsDock.vue`

**Interfaces:** none (standalone global component, no props/emits change).

- [ ] **Step 1: Search input focus ring**

Find:
```html
            <input v-model="query" type="text" placeholder="Buscar amigo…" class="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition" />
```
Replace with:
```html
            <input v-model="query" type="text" placeholder="Buscar amigo…" class="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/30 transition" />
```

- [ ] **Step 2: Own-message chat bubble accent**

Find:
```html
            <li v-for="m in messages" :key="m.id" :class="['w-fit max-w-[85%] rounded-2xl px-3.5 py-2 text-slate-100 border', isOwn(m) ? 'ml-auto bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-400/40' : 'bg-slate-800/80 border-white/15']">
```
Replace with:
```html
            <li v-for="m in messages" :key="m.id" :class="['w-fit max-w-[85%] rounded-2xl px-3.5 py-2 text-slate-100 border', isOwn(m) ? 'ml-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-violet-400/40' : 'bg-slate-800/80 border-white/15']">
```

Leave the read-receipt checkmarks below this (`text-emerald-400` for `✓✓`) untouched — confirmation-checkmark semantic, Global Constraints rule 1.

- [ ] **Step 3: Message input focus ring + send button gradient**

Find:
```html
          <div class="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-400/30 focus-within:border-emerald-400/30 transition">
            <input v-model="newMessage.content" type="text" placeholder="Escribí un mensaje…" class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-500 text-sm" @keydown.enter.exact.prevent="handleSubmit" />
            <button type="submit" class="shrink-0 h-8 w-8 grid place-items-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:brightness-110 transition active:scale-95">
```
Replace with:
```html
          <div class="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-violet-400/30 focus-within:border-violet-400/30 transition">
            <input v-model="newMessage.content" type="text" placeholder="Escribí un mensaje…" class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-500 text-sm" @keydown.enter.exact.prevent="handleSubmit" />
            <button type="submit" class="shrink-0 h-8 w-8 grid place-items-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:brightness-110 transition active:scale-95">
```

- [ ] **Step 4: Mobile FAB (Amigos toggle) gradient**

Find:
```html
        <button @click="toggleMobile" title="Amigos" class="relative h-14 w-14 rounded-full grid place-items-center bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-2xl shadow-emerald-500/40 border border-white/20 hover:brightness-110 transition active:scale-95">
```
Replace with:
```html
        <button @click="toggleMobile" title="Amigos" class="relative h-14 w-14 rounded-full grid place-items-center bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-2xl shadow-indigo-500/40 border border-white/20 hover:brightness-110 transition active:scale-95">
```

- [ ] **Step 5: Bug-report modal — textarea/input focus rings + submit button gradient**

Find:
```html
          <textarea v-model="bugMsg" rows="4" maxlength="2000" placeholder="¿Qué salió mal? ¿En qué parte?" class="w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition resize-none"></textarea>
          <input v-model="bugContact" type="text" maxlength="200" placeholder="Contacto (opcional): mail o @usuario" class="mt-2 w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition" />
          <div class="mt-3 flex justify-end gap-2">
            <button @click="bugOpen = false" class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition">Cancelar</button>
            <button @click="submitBug" :disabled="bugBusy" class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 active:scale-95 transition disabled:opacity-60">{{ bugBusy ? 'Enviando…' : 'Enviar reporte' }}</button>
```
Replace with:
```html
          <textarea v-model="bugMsg" rows="4" maxlength="2000" placeholder="¿Qué salió mal? ¿En qué parte?" class="w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/30 transition resize-none"></textarea>
          <input v-model="bugContact" type="text" maxlength="200" placeholder="Contacto (opcional): mail o @usuario" class="mt-2 w-full text-sm rounded-xl bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/30 transition" />
          <div class="mt-3 flex justify-end gap-2">
            <button @click="bugOpen = false" class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition">Cancelar</button>
            <button @click="submitBug" :disabled="bugBusy" class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 active:scale-95 transition disabled:opacity-60">{{ bugBusy ? 'Enviando…' : 'Enviar reporte' }}</button>
```

- [ ] **Step 6: Desktop rail card — migrate to `.surface-solid`**

Find:
```html
    <div class="hidden lg:flex fixed right-5 top-1/2 -translate-y-1/2 z-30 w-[58px] max-h-[calc(100dvh-140px)] flex-col items-center rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md shadow-2xl shadow-black/40 py-2">
```
Replace with:
```html
    <div class="hidden lg:flex fixed right-5 top-1/2 -translate-y-1/2 z-30 w-[58px] max-h-[calc(100dvh-140px)] flex-col items-center surface-solid py-2">
```

Per Global Constraints, `shadow-2xl shadow-black/40` is dropped, not kept alongside `.surface-solid` — `.surface-solid` already defines its own `box-shadow`.

- [ ] **Step 7: Verify no leftover brand-color references**

```bash
rg 'emerald|cyan' src/components/FriendsDock.vue
```
Expected: only the 3 semantic/status usages remain — `statusDot()` method (`bg-cyan-400`/`bg-emerald-400`), the "en línea" count (`text-emerald-400`), and the read-receipt checkmark (`text-emerald-400`). No other matches.

- [ ] **Step 8: Live verification**

With the dev server running, log in and confirm the friends rail/drawer render. Check: rail card background still looks like an elevated card (violet-tinted hover state where applicable), FAB button and send button are indigo→purple gradients (not emerald→cyan), chat bubble for your own messages is indigo/purple-tinted, status dots are unchanged (cyan=playing, emerald=online, slate=offline). No console errors. Paste actual observations.

- [ ] **Step 9: Commit**

```bash
git add src/components/FriendsDock.vue
git commit -m "feat(hub-zone): migrate FriendsDock.vue to Hub accent + surface-solid rail"
```

---

## Task 2: Migrate `Profile.vue` + `CommunityCard.vue` to the Hub design system

**Files:**
- Modify: `src/pages/profile/Profile.vue`
- Modify: `src/components/profile/CommunityCard.vue`

**Interfaces:** none.

- [ ] **Step 1: Favoritos accent bar**

Find (in `Profile.vue`):
```html
        <div v-if="user.favorite_player || user.favorite_team" class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 p-4">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-500"></span>
            <h3 class="font-display font-bold text-white">Favoritos</h3>
          </div>
```
Replace with:
```html
        <div v-if="user.favorite_player || user.favorite_team" class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/50 p-4">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-purple-500"></span>
            <h3 class="font-display font-bold text-white">Favoritos</h3>
          </div>
```

- [ ] **Step 2: Jugador/Equipo labels**

Find:
```html
              <div class="min-w-0 w-full"><p class="text-[9px] uppercase tracking-wider text-emerald-400/70 font-semibold">Jugador</p><p class="text-xs text-white font-medium truncate">{{ user.favorite_player }}</p></div>
```
Replace with:
```html
              <div class="min-w-0 w-full"><p class="text-[9px] uppercase tracking-wider text-violet-400/70 font-semibold">Jugador</p><p class="text-xs text-white font-medium truncate">{{ user.favorite_player }}</p></div>
```

Find:
```html
              <div class="min-w-0 w-full"><p class="text-[9px] uppercase tracking-wider text-cyan-400/70 font-semibold">Equipo</p><p class="text-xs text-white font-medium truncate">{{ user.favorite_team }}</p></div>
```
Replace with:
```html
              <div class="min-w-0 w-full"><p class="text-[9px] uppercase tracking-wider text-purple-400/70 font-semibold">Equipo</p><p class="text-xs text-white font-medium truncate">{{ user.favorite_team }}</p></div>
```

- [ ] **Step 3: Connect-action buttons (Mensaje, Conectar)**

Find:
```html
              <button @click="$router.push('/messages/' + user.id)" class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-emerald-400/30 text-white bg-emerald-500/20 hover:bg-emerald-500/30 transition">Mensaje</button>
```
Replace with:
```html
              <button @click="$router.push('/messages/' + user.id)" class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-violet-400/30 text-white bg-indigo-500/20 hover:bg-indigo-500/30 transition">Mensaje</button>
```

Find:
```html
              <button @click="onConnect" :disabled="connectDisabled" class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-emerald-400/30 bg-emerald-500/20 text-white hover:bg-emerald-500/30 transition shadow-lg hover:shadow-emerald-500/20">Conectar</button>
```
Replace with:
```html
              <button @click="onConnect" :disabled="connectDisabled" class="rounded-xl px-4 py-2.5 text-sm font-semibold border border-violet-400/30 bg-indigo-500/20 text-white hover:bg-indigo-500/30 transition shadow-lg hover:shadow-indigo-500/20">Conectar</button>
```

Leave "Desconectar" (red), "Cancelar solicitud" (amber), and "Responder" (amber) untouched — semantic danger/pending states, Global Constraints rule 7.

- [ ] **Step 4: `.card` → `.surface-solid` (two instances)**

Find:
```html
        <div v-if="hasStreaks" class="card p-6">
```
Replace with:
```html
        <div v-if="hasStreaks" class="surface-solid p-6">
```

Find:
```html
        <div v-if="dailyStreaksItems.some(r => r.best > 0)" class="card p-6">
```
Replace with:
```html
        <div v-if="dailyStreaksItems.some(r => r.best > 0)" class="surface-solid p-6">
```

Leave the "Mejores rachas" (amber/orange) and "Rachas diarias" (orange/red) content inside these two cards untouched — not emerald/cyan, out of scope per Global Constraints rule 7. Leave the "Redes" card's sky/blue accent bar untouched for the same reason.

- [ ] **Step 5: `CommunityCard.vue` — `.card` → `.surface-solid`**

Find (in `CommunityCard.vue`):
```html
  <div class="card p-6">
```
Replace with:
```html
  <div class="surface-solid p-6">
```

No other changes to `CommunityCard.vue` — it has no emerald/cyan usage.

- [ ] **Step 6: Verify no leftover brand-color references**

```bash
rg 'emerald|cyan' src/pages/profile/Profile.vue
```
Expected: matches only inside the "Mejores rachas"/"Rachas diarias" blocks are gone (they were never emerald/cyan) — confirm zero remaining `emerald`/`cyan` matches tied to Favoritos or the connect buttons. (The file will still show no matches at all, since none of Profile.vue's other sections used emerald/cyan to begin with.)

- [ ] **Step 7: Live verification**

Log in, navigate to `/profile`. Confirm: Favoritos card's accent bar and Jugador/Equipo labels are violet/purple, Conectar/Mensaje buttons (view another user's profile to see these — e.g. navigate to `/u/<some-other-user-id>` if you have a second test account, otherwise verify via computed style on the button element even if not clickable-tested) render indigo/violet, "Mejores rachas" and "Rachas diarias" cards still render with amber/orange styling unchanged, both now sit on the `.surface-solid` background (visually: solid `--mb-800` navy, no gradient, no blur — compare against an untouched card on the same page for contrast). No console errors. Paste actual observations.

- [ ] **Step 8: Commit**

```bash
git add src/pages/profile/Profile.vue src/components/profile/CommunityCard.vue
git commit -m "feat(hub-zone): migrate Profile.vue + CommunityCard.vue to Hub accent + surface-solid"
```

---

## Task 3: Migrate `ProfileIdentityCard.vue` + `LevelProgressionModal.vue` to the Hub design system

**Files:**
- Modify: `src/components/profile/ProfileIdentityCard.vue`
- Modify: `src/components/profile/LevelProgressionModal.vue`

**Interfaces:** none.

- [ ] **Step 1: `ProfileIdentityCard.vue` — level-progress bar gradient**

Find:
```html
        <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: progressPercent + '%' }"></div>
        </div>
```
Replace with:
```html
        <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 transition-all duration-700" :style="{ width: progressPercent + '%' }"></div>
        </div>
```

- [ ] **Step 2: `ProfileIdentityCard.vue` — rank/tier trailhead progress bar**

Find:
```html
          <div class="h-3 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (level >= 50 ? 100 : tierProgress) + '%' }"></div>
          </div>
```
Replace with:
```html
          <div class="h-3 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
            <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 transition-all duration-700" :style="{ width: (level >= 50 ? 100 : tierProgress) + '%' }"></div>
          </div>
```

- [ ] **Step 3: `ProfileIdentityCard.vue` — "Ver todos los rangos" hover text**

Find:
```html
      <div class="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-500 group-hover:text-emerald-300 transition">
```
Replace with:
```html
      <div class="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-500 group-hover:text-violet-300 transition">
```

Leave the `iconBgKey` prop default (`'emerald'`), the `RANK_STYLE` map (amber/slate/orange), and the plan badge (`planStyle` service) untouched — Global Constraints rules 5, 6, 7.

- [ ] **Step 4: `LevelProgressionModal.vue` — header background wash**

Find:
```html
          <div class="shrink-0 p-5 text-center border-b border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 relative">
            <h2 class="font-display text-xl font-extrabold text-white">Rangos y recompensas</h2>
```
Replace with:
```html
          <div class="shrink-0 p-5 text-center border-b border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 relative">
            <h2 class="font-display text-xl font-bold text-white">Rangos y recompensas</h2>
```

(The `font-extrabold` → `font-bold` change is the Space Grotesk weight-ceiling rule from Global Constraints — `.font-display` combined with `font-extrabold`.)

- [ ] **Step 5: `LevelProgressionModal.vue` — tier-name label weight**

Find:
```html
                    <p class="font-display font-extrabold text-base" :class="s.accent">{{ s.tier.label }}</p>
```
Replace with:
```html
                    <p class="font-display font-bold text-base" :class="s.accent">{{ s.tier.label }}</p>
```

- [ ] **Step 6: `LevelProgressionModal.vue` — footer close button gradient**

Find:
```html
            <button @click="emit('close')" class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-emerald-500/25">Cerrar</button>
```
Replace with:
```html
            <button @click="emit('close')" class="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-indigo-500/25">Cerrar</button>
```

Leave `TIER_TINT` (its `emerald`/`cyan` keys included — tier-color-driven map, Global Constraints rule 5) and the "reached" checkmark badge (`bg-emerald-500/20 border-emerald-400/40`, confirmation semantic, rule 1) untouched.

- [ ] **Step 7: Verify no leftover brand-color references**

```bash
rg 'from-emerald|to-cyan|via-cyan|text-emerald-300' src/components/profile/ProfileIdentityCard.vue
rg 'from-emerald-500|to-cyan-500|font-extrabold' src/components/profile/LevelProgressionModal.vue
```
First command: expected no output. Second command: expected no output for the gradient matches; `font-extrabold` should show zero remaining matches inside any `.font-display` context (any other `font-extrabold` left, e.g. plain body text, is fine and out of scope — check by eye that any remaining hit isn't paired with `font-display` on the same element).

- [ ] **Step 8: Live verification**

Log in, navigate to `/profile`. Confirm the level-progress bar (under the big level number) and the rank trailhead bar (in the "Rango" button) are now indigo→violet→purple gradients, not emerald→cyan→indigo. Click the rank button to open the rank progression modal — confirm its header wash and "Cerrar" button are indigo/purple, tier name labels still render (font-bold, not extrabold — spot-check via `getComputedStyle` if the visual difference is too subtle to eyeball). No console errors. Paste actual observations.

- [ ] **Step 9: Commit**

```bash
git add src/components/profile/ProfileIdentityCard.vue src/components/profile/LevelProgressionModal.vue
git commit -m "feat(hub-zone): migrate ProfileIdentityCard.vue + LevelProgressionModal.vue to Hub accent"
```

---

## Task 4: Migrate `AchievementsCard.vue` + `FeaturedAchievementsModal.vue` to the Hub design system

**Files:**
- Modify: `src/components/profile/AchievementsCard.vue`
- Modify: `src/components/profile/FeaturedAchievementsModal.vue`

**Interfaces:** none.

- [ ] **Step 1: `AchievementsCard.vue` — tab selected state**

Find:
```html
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap"
                  :class="selected === t.key ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200' : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'">
```
Replace with:
```html
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap"
                  :class="selected === t.key ? 'border-violet-400/50 bg-indigo-500/20 text-violet-200' : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'">
```

- [ ] **Step 2: `AchievementsCard.vue` — modal title weight**

Find:
```html
                <h3 class="font-display font-extrabold text-white text-lg">{{ currentCategoryLabel || 'Todos los logros' }}</h3>
```
Replace with:
```html
                <h3 class="font-display font-bold text-white text-lg">{{ currentCategoryLabel || 'Todos los logros' }}</h3>
```

Leave the header amber accent bar, the `+XP` text (`text-emerald-300`, appears twice), the "¡No te queda ningún logro pendiente!" success message (`text-emerald-400`), and the diamond-medal cyan/sky/blue gradient untouched — Global Constraints rules 3, 5, 7.

- [ ] **Step 3: `FeaturedAchievementsModal.vue` — counter badge**

Find:
```html
        <div class="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20">
          <span class="text-emerald-400 font-semibold">{{ selected.length }} / 3</span>
```
Replace with:
```html
        <div class="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-violet-400/20">
          <span class="text-violet-400 font-semibold">{{ selected.length }} / 3</span>
```

- [ ] **Step 4: `FeaturedAchievementsModal.vue` — selection card border/background/glow**

Find:
```html
                :class="isSelected(ach.code) 
                  ? 'border-emerald-400/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/20' 
                  : 'border-white/10 bg-slate-800/40 hover:border-white/20 hover:bg-slate-800/60'
                ">
```
Replace with:
```html
                :class="isSelected(ach.code) 
                  ? 'border-violet-400/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/20' 
                  : 'border-white/10 bg-slate-800/40 hover:border-white/20 hover:bg-slate-800/60'
                ">
```

- [ ] **Step 5: `FeaturedAchievementsModal.vue` — selection toggle checkmark**

Find:
```html
                <div v-if="isSelected(ach.code)" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 grid place-items-center">
```
Replace with:
```html
                <div v-if="isSelected(ach.code)" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 grid place-items-center">
```

Per Global Constraints rule 4, this checkmark is the one deliberate exception to the "possession checkmarks stay emerald" rule — it marks a transient "currently one of your 3 picks" toggle, not a permanent unlock, so it follows the selection-pill recolor instead.

- [ ] **Step 6: `FeaturedAchievementsModal.vue` — Save button**

Find:
```html
        <button 
          @click="save" 
          :disabled="!canSave"
          class="px-6 py-2 rounded-lg font-semibold transition"
          :class="canSave 
            ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20' 
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          ">
```
Replace with:
```html
        <button 
          @click="save" 
          :disabled="!canSave"
          class="px-6 py-2 rounded-lg font-semibold transition"
          :class="canSave 
            ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20' 
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          ">
```

Leave the `+{{ ach.points }} XP` text (`text-emerald-300`) untouched — reward-number semantic, Global Constraints rule 3.

- [ ] **Step 7: Verify no leftover brand-color references**

```bash
rg 'emerald' src/components/profile/AchievementsCard.vue
```
Expected: only the header amber bar is unaffected (not emerald to begin with — no match), the two `+XP` matches, and the "no pendientes" success message. No `border-emerald-400/50 bg-emerald-500/20` (tab) match should remain.

```bash
rg 'emerald' src/components/profile/FeaturedAchievementsModal.vue
```
Expected: only the `+{{ ach.points }} XP` match remains.

- [ ] **Step 8: Live verification**

Log in, navigate to `/profile`. Open "Ver todos los logros" — confirm category tab pills use violet/indigo when selected (not emerald). If you have achievements and can customize featured ones, open that modal (pencil icon on the Achievements card) — confirm the counter badge, selected-card highlight, selection checkmark, and Save button are all indigo/violet, and `+XP` text stays emerald. No console errors. Paste actual observations.

- [ ] **Step 9: Commit**

```bash
git add src/components/profile/AchievementsCard.vue src/components/profile/FeaturedAchievementsModal.vue
git commit -m "feat(hub-zone): migrate AchievementsCard.vue + FeaturedAchievementsModal.vue to Hub accent"
```

---

## Task 5: Migrate `LoadoutShowcase.vue` + `CosmeticsCollection.vue` to the Hub design system

**Files:**
- Modify: `src/components/profile/LoadoutShowcase.vue`
- Modify: `src/components/profile/CosmeticsCollection.vue`

**Interfaces:** none.

- [ ] **Step 1: `LoadoutShowcase.vue` — collection-progress count + bar**

Find:
```html
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-slate-300 font-semibold">Colección desbloqueada</span>
          <span class="text-emerald-300 font-bold tabular-nums">{{ ownedCount }}/{{ totalCount }}</span>
        </div>
        <div class="h-2.5 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-700" :style="{ width: progressPct + '%' }"></div>
        </div>
```
Replace with:
```html
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-slate-300 font-semibold">Colección desbloqueada</span>
          <span class="text-violet-300 font-bold tabular-nums">{{ ownedCount }}/{{ totalCount }}</span>
        </div>
        <div class="h-2.5 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
          <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-700" :style="{ width: progressPct + '%' }"></div>
        </div>
```

Leave the header amber accent bar and all `rarity()`/`frameStyle()`/`iconThemeBg()`-driven slot colors untouched — data-driven, Global Constraints rule 5.

- [ ] **Step 2: `CosmeticsCollection.vue` — tabs active-state gradient**

Find:
```html
      <button v-for="t in TABS" :key="t.key" @click="setTab(t.key)"
              class="flex-1 min-w-max rounded-lg px-3 py-2 text-sm font-semibold transition flex items-center justify-center gap-1.5"
              :class="activeTab === t.key ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'">
```
Replace with:
```html
      <button v-for="t in TABS" :key="t.key" @click="setTab(t.key)"
              class="flex-1 min-w-max rounded-lg px-3 py-2 text-sm font-semibold transition flex items-center justify-center gap-1.5"
              :class="activeTab === t.key ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'">
```

- [ ] **Step 3: `CosmeticsCollection.vue` — `.card` → `.surface-solid`**

Find:
```html
  <div class="card p-5 sm:p-6">
```
Replace with:
```html
  <div class="surface-solid p-5 sm:p-6">
```

Leave `DEFAULT_BG = 'emerald'` (Global Constraints rule 6), every "equipped"/"owned" ring and checkmark (icon, frame, banner, title slots — all Global Constraints rule 1), and the "Tuyos" section header checkmark+label (`bg-emerald-500/20 text-emerald-300`, `text-emerald-300` — possession semantic, rule 1) untouched.

- [ ] **Step 4: Verify no leftover brand-color references**

```bash
rg 'from-emerald-500 to-cyan-500|class="card' src/components/profile/CosmeticsCollection.vue
```
Expected: no output (the tabs gradient and the `.card` usage are both gone).

```bash
rg 'from-emerald-400 to-cyan-400|text-emerald-300' src/components/profile/LoadoutShowcase.vue
```
Expected: no output.

- [ ] **Step 5: Live verification**

Log in, navigate to `/profile-edit`. Confirm the cosmetics tab bar's active tab is indigo→purple (not emerald→cyan), and the panel now sits on a solid `.surface-solid` background (no gradient banding compared to before). Confirm equipped-item rings and owned checkmarks are still emerald (unchanged). On `/profile`, confirm the Loadout Showcase card's collection-progress bar and count are indigo/violet. No console errors. Paste actual observations.

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/LoadoutShowcase.vue src/components/profile/CosmeticsCollection.vue
git commit -m "feat(hub-zone): migrate LoadoutShowcase.vue + CosmeticsCollection.vue to Hub accent + surface-solid"
```

---

## Task 6: Migrate `XpDonutChart.vue` + `ConnectionsCard.vue` to the Hub design system

**Files:**
- Modify: `src/components/profile/XpDonutChart.vue`
- Modify: `src/components/profile/ConnectionsCard.vue`

**Interfaces:** none.

- [ ] **Step 1: `XpDonutChart.vue` — header accent bar**

Find:
```html
        <span class="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-500"></span>
```
Replace with:
```html
        <span class="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-purple-500"></span>
```

- [ ] **Step 2: `XpDonutChart.vue` — modal title weight**

Find:
```html
                <h3 class="font-display font-extrabold text-white text-lg">XP por juego</h3>
```
Replace with:
```html
                <h3 class="font-display font-bold text-white text-lg">XP por juego</h3>
```

- [ ] **Step 3: `XpDonutChart.vue` — per-game XP bar fill (main view)**

Find:
```html
            <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
              <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-700" :style="{ width: pct(g.xp) + '%' }"></div>
            </div>
```
Replace with:
```html
            <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
              <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-700" :style="{ width: pct(g.xp) + '%' }"></div>
            </div>
```

- [ ] **Step 4: `XpDonutChart.vue` — per-game XP bar fill (modal view)**

Find:
```html
                    <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
                      <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" :style="{ width: pct(g.xp) + '%' }"></div>
                    </div>
```
Replace with:
```html
                    <div class="h-2 rounded-full bg-black/40 overflow-hidden ring-1 ring-white/5">
                      <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400" :style="{ width: pct(g.xp) + '%' }"></div>
                    </div>
```

- [ ] **Step 5: `ConnectionsCard.vue` — `.card` → `.surface-solid`**

Find:
```html
  <div class="card p-6">
```
Replace with:
```html
  <div class="surface-solid p-6">
```

No other changes to `ConnectionsCard.vue` — its accent bar is already `from-violet-400 to-fuchsia-500`, not emerald/cyan, so it's out of scope by Global Constraints rule 7 (already coincidentally close to the Hub palette).

- [ ] **Step 6: Verify no leftover brand-color references**

```bash
rg 'emerald|cyan|font-extrabold|class="card' src/components/profile/XpDonutChart.vue
rg 'class="card' src/components/profile/ConnectionsCard.vue
```
Expected: no output from either command.

- [ ] **Step 7: Live verification**

Log in, navigate to `/profile`. Confirm the "XP por juego" card's header bar and per-game progress bars are indigo/purple (not emerald/cyan), and clicking "Ver todos los juegos" shows the same indigo/purple bars in the modal. Confirm the Connections card (if you have connections, or `connectionsLoading` state otherwise) now sits on a `.surface-solid` background. No console errors. Paste actual observations.

- [ ] **Step 8: Commit**

```bash
git add src/components/profile/XpDonutChart.vue src/components/profile/ConnectionsCard.vue
git commit -m "feat(hub-zone): migrate XpDonutChart.vue + ConnectionsCard.vue to Hub accent + surface-solid"
```

---

## Self-Review Notes

- **Spec coverage:** every reachable file under `/profile`, `/u/:id`, `/profile-edit`, and the global `FriendsDock` is covered by exactly one task (Tasks 1-6) ✓. Space Grotesk weight ceiling applied everywhere a `.font-display` + `font-extrabold` combination was found in-scope (Tasks 3, 4, 6) ✓. Two spec-sanctioned surface migrations applied (`.card`→`.surface-solid` in 4 files, the named `bg-slate-900/*-backdrop-blur-md` pattern in FriendsDock) ✓.
- **Dead code found and excluded, not deleted:** `UserPublic.vue`, `ProfileHeaderCard.vue`, `ProgressCard.vue`, `TierBadge.vue`, `MaxStreaksCard.vue`, `XpByGameCard.vue`, `DailyStreaksCard.vue` — confirmed via `rg` that none are imported by any routed page. Flagged in this document's "Scope note" for the owner as a separate cleanup candidate; this wave does not touch or delete them.
- **Explicitly deferred to a future wave, not this one:** broader `.card`/raw-gradient-background → `.surface-solid` migration for containers that don't match either of the two narrow patterns this wave allows (e.g. Profile.vue's Favoritos/Redes cards, AchievementsCard's and LoadoutShowcase's own root containers, which use two/three-stop gradients rather than the flat `bg-slate-900/*` pattern) — same deferral Wave 1 already established for Landing.vue/PlayPoints.vue, kept consistent here rather than re-litigated per file.
- **Semantic-color judgment calls, all stated once in Global Constraints rather than repeated per task:** possession/confirmation checkmarks (rule 1) vs. the one deliberate exception for `FeaturedAchievementsModal`'s transient selection toggle (rule 4) — this pair is the plan's least obvious call, flagged explicitly in both the Global Constraints and Task 4 so an implementer doesn't over-generalize either direction. Reward/XP-number color (rule 3) is left alone specifically to stay consistent with the untouched, app-wide `.xp-float` toast in `style.css` — recoloring it here while it stays emerald elsewhere would reintroduce exactly the inconsistency this whole redesign exists to remove.
- **Type/signature consistency:** no props, emits, or component interfaces change in this plan — every task is template/class-only, so there's nothing to cross-check between tasks (unlike Wave 1's `GameCard.vue` extraction, which had a real interface other tasks depended on).
