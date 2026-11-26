<script setup>
/**
 * BIENVENIDA (v4) — 4 pasos, se muestra una sola vez (services/onboarding.js):
 *  1. Los juegos (pósters reales).        3. Tu vestuario (borde, banner, título).
 *  2. XP y rangos (escudos reales).        4. Vitrina de cosméticos REALES del catálogo.
 * CTA: jugar el primer juego sin registrarse (Adiviná el jugador admite invitado)
 * o "Ya tengo cuenta". Datos: tiers.js, games.js y la tabla pública `cosmetics`.
 */
import { RARITY } from '../services/rarity'
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { supabase } from '../services/supabase'
import { TIERS } from '../services/tiers'
import { DAILY_GAMES } from '../services/game-modes'
import { friendlyNameForSlug } from '../services/games'
import { GAME_POSTER_META } from '../services/game-art'
import { rarity, frameStyle, isSceneFrame, titleClass } from '../services/cosmetics'
import { RASTER_ICON_KEYS } from '../services/cosmetic-icon-keys'
import { markWelcomeSeen } from '../services/onboarding'
import { tap } from '../services/haptics'
import { shellState } from '../components/shell/shell-state'
import GamePoster from '../components/game/GamePoster.vue'
import CosmeticIcon from '../components/rewards/CosmeticIcon.vue'
import AvatarFrame from '../components/common/AvatarFrame.vue'
import BannerScene from '../components/common/BannerScene.vue'

const router = useRouter()
const step = ref(1)
const dir = ref(1)
const STEPS = 4
function go(n) {
  const v = Math.max(1, Math.min(STEPS, n))
  if (v === step.value) return
  tap()
  dir.value = v > step.value ? 1 : -1
  step.value = v
}
function next() { step.value === STEPS ? start() : go(step.value + 1) }

const logged = computed(() => !!shellState.user?.id)
const FIRST_GAME = 'guess-player' // juego que se puede jugar sin cuenta
function start() {
  tap()
  markWelcomeSeen()
  router.push(logged.value ? '/play/points' : `/games/${FIRST_GAME}?mode=challenge`)
}

// ── Paso 1: pósters ──
const FAN = ['higher-or-lower', FIRST_GAME, 'football-grid']
const fan = FAN.map((slug, i) => ({ slug, name: friendlyNameForSlug(slug), sub: GAME_POSTER_META[slug]?.sub || '', pos: ['l', 'c', 'r'][i] }))
const moreGames = Math.max(0, DAILY_GAMES.length - FAN.length)

// ── Paso 2: rangos ──
const tierL = TIERS[0], tierC = TIERS[1], tierR = TIERS[2]
const maxLevel = TIERS[TIERS.length - 1].maxLevel

// ── Pasos 3 y 4: catálogo real de cosméticos (tabla pública) ──
const RANK = { legendary: 4, epic: 3, rare: 2, common: 1 }
const RASTER = RASTER_ICON_KEYS
const catalog = ref([])
const catLoaded = ref(false)
onMounted(async () => {
  markWelcomeSeen()
  try {
    const { data, error } = await supabase.from('cosmetics').select('code, type, name, rarity, style_key, unlock_level, premium_only, active')
    if (!error) catalog.value = (data || []).filter(c => c.active !== false && !c.premium_only)
  } catch { /* sin catálogo: se muestran los íconos sin nombre */ }
  catLoaded.value = true
})
const byRarity = (a, b) => (RANK[b.rarity] || 0) - (RANK[a.rarity] || 0) || (a.unlock_level || 0) - (b.unlock_level || 0)
const vitrina = computed(() => {
  const icons = catalog.value.filter(c => c.type === 'icon' && RASTER.has(c.style_key)).sort(byRarity)
  const seen = new Set()
  const out = []
  for (const c of icons) { if (!seen.has(c.style_key)) { seen.add(c.style_key); out.push(c) } if (out.length === 8) break }
  if (out.length) return out
  return catLoaded.value ? ['crown', 'goat', 'phoenix', 'trophy', 'bolt', 'flame', 'boot', 'gloves'].map(k => ({ code: k, style_key: k, name: '', rarity: '' })) : []
})
const pickTop = (type, filter = () => true) => catalog.value.filter(c => c.type === type && filter(c)).sort(byRarity)[0] || null
// Vitrina: los bordes del vestuario nuevo primero (los de rango van en El camino)
const showFrame = computed(() => pickTop('frame', c => isSceneFrame(c.style_key)) || pickTop('frame', c => !!c.style_key && !!frameStyle(c.style_key).wrap && !String(c.style_key).startsWith('medal_')))
const showBanner = computed(() => pickTop('banner', c => !!c.style_key))
const showTitle = computed(() => pickTop('title'))
const showIcon = computed(() => vitrina.value[0] || null)
const rarities = ['common', 'rare', 'epic', 'legendary'].map(k => ({ k, label: rarity(k).label }))
const RCOLOR = Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, r.c]))

const COPY = {
  1: { t: `${DAILY_GAMES.length} juegos de fútbol, todos los días`, s: 'Adiviná jugadores, ordená planteles y armá tu once. Un intento por juego: se renuevan a las 00:00.', glow: 'rgba(16,185,129,0.22)' },
  2: { t: 'Sumá XP y subí de rango', s: `Cada partido te da XP. De ${TIERS[0].label} a ${TIERS[TIERS.length - 1].label}: ${maxLevel} niveles y ${TIERS.length} rangos, cada uno con su escudo.`, glow: 'rgba(245,158,11,0.2)' },
  3: { t: 'Armá tu vestuario', s: 'Íconos, bordes, banners y títulos para que tu perfil se vea como vos querés. Se ganan jugando.', glow: 'rgba(168,85,247,0.22)' },
  4: { t: 'Ganá íconos, bordes y banners jugando', s: 'Cada nivel, misión y sobre del día suma premios para tu vitrina. Cuanto más raro, más se luce.', glow: 'rgba(251,191,36,0.2)' },
}
const copy = computed(() => COPY[step.value])
const CHIPS = [
  { label: 'XP', icon: 'M13 2L4 14h7l-1 8 9-12h-7z', bg: 'linear-gradient(135deg,#34d399,#22d3ee)', on: (s) => s === 1 },
  { label: `${TIERS.length} rangos`, icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', bg: 'linear-gradient(135deg,#fcd34d,#f59e0b)', on: (s) => s === 2 },
  { label: 'Cosméticos', icon: 'M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-.5 2-2 3-4 3s-3.5-1-4-3z', bg: 'linear-gradient(135deg,#c084fc,#818cf8)', on: (s) => s >= 3 },
]

// Deslizar para cambiar de paso
let x0 = null
function onTouchStart(e) { x0 = e.touches?.[0]?.clientX ?? null }
function onTouchEnd(e) {
  if (x0 == null) return
  const dx = (e.changedTouches?.[0]?.clientX ?? x0) - x0
  x0 = null
  if (Math.abs(dx) > 50) go(step.value + (dx < 0 ? 1 : -1))
}
</script>

<template>
  <section class="bv" :style="{ '--glow': copy.glow }" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
    <div class="bv-bg" aria-hidden="true"></div>
    <svg class="bv-pitch" width="390" height="330" viewBox="0 0 390 330" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2"><circle cx="195" cy="170" r="120"/><path d="M0 170h390"/><circle cx="195" cy="170" r="4" fill="rgba(255,255,255,0.08)"/></g></svg>

    <header class="bv-head">
      <button type="button" class="bv-prev" aria-label="Paso anterior" :disabled="step === 1" @click="go(step - 1)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <div class="flex-1 flex gap-1.5" role="tablist" :aria-label="`Paso ${step} de ${STEPS}`">
        <button v-for="n in STEPS" :key="n" type="button" role="tab" class="bv-dot" :aria-selected="n === step" :aria-label="`Paso ${n} de ${STEPS}`" @click="go(n)">
          <span :class="n < step ? 'is-done' : (n === step ? 'is-on' : '')"></span>
        </button>
      </div>
      <button type="button" class="bv-next" @click="next">{{ step === STEPS ? 'Listo' : 'Siguiente' }}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </header>

    <!-- Ilustración por paso -->
    <div class="bv-art" aria-hidden="true">
      <Transition :name="dir > 0 ? 'bv-fwd' : 'bv-back'" mode="out-in">
        <div v-if="step === 1" key="1" class="bv-scene">
          <div v-for="f in fan" :key="f.slug" class="bv-card" :class="'is-' + f.pos">
            <GamePoster :slug="f.slug" :name="f.name" :sub="f.sub" />
          </div>
          <span class="bv-pill">+{{ moreGames }} JUEGOS MÁS · 1 INTENTO POR DÍA</span>
        </div>

        <div v-else-if="step === 2" key="2" class="bv-scene">
          <div class="bv-ranks">
            <img :src="tierL.image" :alt="tierL.label" class="bv-crest" width="58" height="67" />
            <span class="bv-medal"><img :src="tierC.image" :alt="tierC.label" width="70" height="82" /></span>
            <img :src="tierR.image" :alt="tierR.label" class="bv-crest is-locked" width="58" height="67" />
          </div>
          <div class="bv-ladder">
            <span class="bv-ladder-bar"><span></span></span>
            <span class="bv-ladder-l"><span>{{ tierL.label }}</span><span class="text-amber-200">{{ tierC.label }}</span><span>{{ tierR.label }}</span></span>
          </div>
          <span class="bv-xp bv-float">+XP</span>
        </div>

        <div v-else-if="step === 3" key="3" class="bv-scene">
          <BannerScene class="bv-banner" :style-key="showBanner?.style_key || 'pitch'" />
          <span class="bv-avatar">
            <AvatarFrame :frame-key="showFrame?.style_key || 'gold'" :size="112" :level="shellState.stats?.level || 1" :streak="Number(shellState.stats?.streak) || 0">
              <span class="bv-avatar-in">
                <CosmeticIcon v-if="showIcon" :icon-key="showIcon.style_key" :size="98" />
              </span>
            </AvatarFrame>
          </span>
          <span v-if="showTitle" class="bv-title" :class="titleClass(showTitle.rarity)">{{ showTitle.name }}</span>
          <div class="bv-rarities">
            <span v-for="r in rarities" :key="r.k" :style="{ color: RCOLOR[r.k], borderColor: RCOLOR[r.k] }">{{ r.label }}</span>
          </div>
        </div>

        <div v-else key="4" class="bv-scene">
          <BannerScene class="bv-showcase" :style-key="showBanner?.style_key || 'night'">
            <span class="bv-sc-av">
              <AvatarFrame :frame-key="showFrame?.style_key || 'gold'" :size="76" :level="shellState.stats?.level || 1" :streak="Number(shellState.stats?.streak) || 0">
                <span class="bv-sc-in"><CosmeticIcon v-if="showIcon" :icon-key="showIcon.style_key" :size="66" /></span>
              </AvatarFrame>
            </span>
            <div class="bv-sc-tags">
              <span v-if="showFrame" class="bv-tag" :style="{ borderColor: RCOLOR[showFrame.rarity] || '#a855f7', color: RCOLOR[showFrame.rarity] || '#d8b4fe' }">BORDE {{ showFrame.name }} · {{ rarity(showFrame.rarity).label }}</span>
              <span v-if="showBanner" class="bv-tag" :style="{ borderColor: RCOLOR[showBanner.rarity] || '#60a5fa', color: RCOLOR[showBanner.rarity] || '#bfdbfe' }">BANNER {{ showBanner.name }} · {{ rarity(showBanner.rarity).label }}</span>
            </div>
          </BannerScene>
          <div class="bv-vitrina" role="list" aria-label="Íconos que podés ganar">
            <div v-for="(v, i) in vitrina" :key="v.code" role="listitem" class="bv-v" :style="{ animationDelay: i * 45 + 'ms' }">
              <span class="bv-v-ic" :class="v.rarity === 'legendary' ? 'is-leg' : ''" :style="{ boxShadow: `0 0 0 2px ${RCOLOR[v.rarity] || '#475569'}` }">
                <CosmeticIcon :icon-key="v.style_key" :size="62" />
                <span v-if="v.unlock_level > 1" class="bv-v-lock">NV {{ v.unlock_level }}</span>
              </span>
              <span v-if="v.name" class="bv-v-n">{{ v.name }}</span>
              <span v-if="v.rarity" class="bv-v-r" :style="{ color: RCOLOR[v.rarity] }">{{ rarity(v.rarity).label }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Texto -->
    <div class="bv-copy">
      <Transition name="bv-txt" mode="out-in">
        <div :key="step" class="flex flex-col gap-2.5">
          <h1 class="bv-h1">{{ copy.t }}</h1>
          <p class="bv-p">{{ copy.s }}</p>
        </div>
      </Transition>
      <span class="bv-kicker">Lo que vas a ganar</span>
      <div class="flex flex-wrap gap-2">
        <span v-for="c in CHIPS" :key="c.label" class="bv-chip" :class="c.on(step) ? 'is-on' : ''">
          <span class="bv-chip-ic" :style="{ background: c.bg }"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0b1220" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="c.icon"/></svg></span>{{ c.label }}
        </span>
      </div>
    </div>

    <!-- CTA -->
    <div class="bv-cta">
      <button type="button" class="bv-play" @click="start">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1c1206" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>{{ logged ? 'A JUGAR' : 'JUGAR MI PRIMER JUEGO' }}
      </button>
      <template v-if="!logged">
        <span class="text-xs text-slate-500">Sin registrarte. Tu progreso se guarda después.</span>
        <RouterLink to="/login" class="bv-login" @click="markWelcomeSeen()">Ya tengo cuenta</RouterLink>
      </template>
    </div>
  </section>
</template>

<style scoped>
.bv {
  position: relative; min-height: 100dvh; max-width: 30rem; margin: 0 auto; overflow: hidden; display: flex; flex-direction: column;
  padding: 0 0 calc(18px + env(safe-area-inset-bottom, 0px)); color: #f1f5f9;
}
.bv-bg { position: absolute; inset: 0; background: radial-gradient(60% 34% at 50% 30%, var(--glow), transparent 72%); transition: background .4s ease; pointer-events: none; }
.bv-pitch { position: absolute; left: 50%; top: 70px; transform: translateX(-50%); pointer-events: none; }
.bv-head { position: relative; z-index: 2; height: 64px; box-sizing: border-box; padding: 10px 10px 0; display: flex; align-items: center; gap: 8px; }
.bv-prev { width: 44px; height: 44px; flex-shrink: 0; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.05); color: #fff; display: grid; place-items: center; }
.bv-prev:disabled { opacity: .35; }
.bv-dot { flex: 1; height: 44px; display: flex; align-items: center; }
.bv-dot > span { width: 100%; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.14); transition: background .25s ease; }
.bv-dot > span.is-done { background: #fbbf24; }
.bv-dot > span.is-on { background: linear-gradient(90deg, #fcd34d, #f59e0b); }
.bv-next { min-height: 44px; padding: 0 10px 0 12px; border-radius: 14px; background: rgba(255,255,255,0.05); color: #e2e8f0; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 2px; }
.bv-art { position: relative; height: 320px; margin-top: 12px; flex-shrink: 0; }
.bv-scene { position: absolute; inset: 0; }
/* paso 1 */
.bv-card { position: absolute; width: 128px; top: 70px; border-radius: 13px; transform-origin: 50% 100%; box-shadow: 0 16px 30px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.06); }
.bv-card.is-l { left: calc(50% - 153px); transform: rotate(-14deg); z-index: 1; }
.bv-card.is-r { left: calc(50% + 25px); transform: rotate(14deg); z-index: 1; }
.bv-card.is-c { left: calc(50% - 64px); top: 40px; z-index: 2; box-shadow: 0 16px 30px rgba(0,0,0,0.55), 0 0 0 2px rgba(251,191,36,0.7); }
.bv-pill { position: absolute; left: 50%; top: 268px; transform: translateX(-50%); padding: 5px 12px; border-radius: 999px; background: rgba(15,23,42,0.85); border: 1px solid rgba(255,255,255,0.12); font-family: var(--font-shout); font-weight: 800; font-size: 14px; letter-spacing: .5px; color: #cbd5e1; white-space: nowrap; z-index: 3; }
/* paso 2 */
.bv-ranks { position: absolute; left: 0; right: 0; top: 40px; height: 170px; display: flex; align-items: flex-end; justify-content: center; gap: 22px; }
.bv-crest { width: 58px; height: 67px; margin-bottom: 4px; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.5)); }
.bv-crest.is-locked { opacity: .45; filter: grayscale(1); }
.bv-medal { width: 120px; height: 120px; border-radius: 50%; padding: 4px; box-sizing: border-box; background: conic-gradient(from 200deg, #fde68a, #b45309, #fde68a, #92400e, #fde68a); box-shadow: 0 14px 34px rgba(245,158,11,0.35); display: flex; }
.bv-medal img { width: 100%; height: 100%; border-radius: 50%; padding: 14px 18px; box-sizing: border-box; object-fit: contain; background: radial-gradient(circle at 50% 38%, #3b2a10, #140d05 80%); }
.bv-ladder { position: absolute; left: 50px; right: 50px; top: 232px; display: flex; flex-direction: column; gap: 6px; }
.bv-ladder-bar { height: 16px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; display: block; }
.bv-ladder-bar > span { display: block; width: 62%; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); animation: bv-fill 1s cubic-bezier(.2,.8,.2,1) both; }
@keyframes bv-fill { from { width: 0; } }
.bv-ladder-l { display: flex; justify-content: space-between; font-family: var(--font-shout); font-weight: 800; font-size: 14px; color: #94a3b8; text-transform: uppercase; }
.bv-xp { position: absolute; left: calc(50% + 53px); top: 26px; padding: 4px 10px; border-radius: 999px; background: linear-gradient(90deg, #34d399, #22d3ee); color: #052e16; font-family: var(--font-shout); font-weight: 800; font-size: 16px; box-shadow: 0 6px 16px rgba(34,211,238,0.35); }
.bv-float { animation: bv-float 3.2s ease-in-out infinite; }
@keyframes bv-float { 50% { transform: translateY(-6px); } }
/* paso 3 */
.bv-banner { position: absolute; left: 40px; right: 40px; top: 20px; height: 120px; border-radius: 18px; border: 3px solid #a16207; box-sizing: border-box; }
.bv-avatar { position: absolute; left: 50%; top: 96px; margin-left: -56px; width: 112px; height: 112px; border-radius: 50%; display: flex; box-shadow: 0 12px 30px rgba(0,0,0,0.55); }
.bv-avatar-in { width: 100%; height: 100%; border-radius: 50%; border: 3px solid #0b1220; box-sizing: border-box; overflow: hidden; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #7c2d12, #431407); }
.bv-title { position: absolute; left: 0; right: 0; margin: 0 auto; width: max-content; top: 226px; font-size: 17px; white-space: nowrap; }
.bv-rarities { position: absolute; left: 0; right: 0; top: 268px; display: flex; justify-content: center; gap: 6px; }
.bv-rarities > span { padding: 3px 9px; border-radius: 999px; border: 1px solid; font-size: 11px; font-weight: 700; }
/* paso 4 */
.bv-showcase { position: absolute; left: 22px; right: 22px; top: 0; height: 104px; border-radius: 18px; overflow: hidden; border: 2px solid #60a5fa; box-shadow: 0 12px 28px rgba(0,0,0,0.45); }
.bv-sc-av { position: absolute; left: 14px; top: 14px; width: 76px; height: 76px; border-radius: 50%; display: flex; z-index: 2; }
.bv-sc-in { width: 100%; height: 100%; border-radius: 50%; border: 2px solid #0b1220; box-sizing: border-box; overflow: hidden; display: grid; place-items: center; background: #111a2e; }
.bv-sc-tags { position: absolute; z-index: 2; left: 104px; right: 10px; top: 14px; bottom: 10px; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.bv-tag { align-self: flex-start; max-width: 100%; padding: 2px 7px; border-radius: 6px; background: rgba(0,0,0,0.5); border: 1px solid; font-size: 10px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv-vitrina { position: absolute; left: 22px; right: 22px; top: 118px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 8px; }
.bv-v { display: flex; flex-direction: column; align-items: center; gap: 3px; animation: bv-pop .35s ease-out both; }
@keyframes bv-pop { from { opacity: 0; transform: translateY(10px) scale(.92); } }
.bv-v-ic { position: relative; width: 62px; height: 62px; border-radius: 14px; background: #111a2e; display: grid; place-items: center; overflow: visible; }
.bv-v-ic :deep(> *) { border-radius: 14px; overflow: hidden; }
.bv-v-ic.is-leg { animation: bv-leg 2.4s ease-in-out infinite; }
@keyframes bv-leg { 50% { filter: drop-shadow(0 0 10px rgba(251,191,36,.6)); } }
.bv-v-lock { position: absolute; right: -6px; top: -6px; height: 18px; padding: 0 5px; border-radius: 6px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1px solid #c7d2fe; font-family: var(--font-shout); font-weight: 800; font-size: 11px; line-height: 16px; color: #fff; }
.bv-v-n { font-size: 11px; font-weight: 700; color: #e2e8f0; white-space: nowrap; max-width: 76px; overflow: hidden; text-overflow: ellipsis; }
.bv-v-r { font-size: 9.5px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; margin-top: -3px; }
/* texto + CTA */
.bv-copy { position: relative; z-index: 2; padding: 18px 22px 0; display: flex; flex-direction: column; gap: 10px; }
.bv-h1 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 30px; line-height: 1.08; letter-spacing: -0.4px; }
.bv-p { margin: 0; font-size: 15px; line-height: 1.45; color: #94a3b8; min-height: 3em; }
.bv-kicker { margin-top: 8px; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #64748b; }
.bv-chip { height: 36px; padding: 0 12px 0 5px; box-sizing: border-box; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #cbd5e1; transition: all .25s ease; }
.bv-chip.is-on { background: rgba(251,191,36,0.14); border-color: rgba(251,191,36,0.55); color: #fde68a; }
.bv-chip-ic { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; }
.bv-cta { position: relative; z-index: 2; margin-top: auto; padding: 16px 18px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.bv-play {
  width: 100%; min-height: 58px; border-radius: 16px; background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%); border-bottom: 4px solid #b45309; color: #1c1206;
  display: flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 24px; letter-spacing: 1px;
  animation: bv-pulse 2s ease-in-out infinite;
}
.bv-play:active { transform: translateY(2px); border-bottom-width: 2px; }
@keyframes bv-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,.45); } 50% { box-shadow: 0 0 0 8px rgba(251,191,36,0); } }
.bv-login { min-height: 44px; padding: 0 12px; display: flex; align-items: center; font-size: 14px; font-weight: 700; color: #fbbf24; }
.bv-fwd-enter-active, .bv-fwd-leave-active, .bv-back-enter-active, .bv-back-leave-active { transition: opacity .22s ease, transform .22s ease; }
.bv-fwd-enter-from { opacity: 0; transform: translateX(28px); } .bv-fwd-leave-to { opacity: 0; transform: translateX(-28px); }
.bv-back-enter-from { opacity: 0; transform: translateX(-28px); } .bv-back-leave-to { opacity: 0; transform: translateX(28px); }
.bv-txt-enter-active, .bv-txt-leave-active { transition: opacity .18s ease, transform .18s ease; }
.bv-txt-enter-from { opacity: 0; transform: translateY(8px); } .bv-txt-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .bv-float, .bv-play, .bv-v, .bv-v-ic.is-leg, .bv-ladder-bar > span { animation: none; }
  .bv-fwd-enter-from, .bv-fwd-leave-to, .bv-back-enter-from, .bv-back-leave-to, .bv-txt-enter-from { transform: none; }
  .bv-bg, .bv-chip, .bv-dot > span { transition: none; }
}
</style>
