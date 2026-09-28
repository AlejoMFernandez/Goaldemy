<script>
import { ref, watch, nextTick } from 'vue'
import { notificationsState, shiftAchievementQueue, setAchievementActive } from '@/stores/notifications'
import { soundManager } from '@/services/sounds'
import { achievementIcon } from '@/services/achievement-icons'
import { getAchievementUnlockPercentages } from '@/services/achievements'
import { sparks, center, reducedMotion } from '@/services/game-fx'
import AchievementTile from './AchievementTile.vue'

export default {
  name: 'AchievementUnlockOverlay',
  components: { AchievementTile },
  setup() {
    const current = ref(null)
    const phase = ref(0)
    const claimed = ref(false)
    const particles = ref([])
    const flying = ref(false)
    const flightStyle = ref(null)
    const iconWrapRef = ref(null)
    // Logros FÁCILES (moodboard 02): cartel arriba que no bloquea, en el momento,
    // aunque se esté jugando. Los demás esperan y usan la escena central.
    const toasts = ref([])
    const legendary = ref(false)
    let phaseTimers = []

    function isEasy(item) { return (achievementIcon(item?.code)?.rarity || 'common') === 'common' }
    function drainEasy() {
      const q = notificationsState.achievementQueue
      for (let i = q.length - 1; i >= 0; i--) {
        if (!isEasy(q[i])) continue
        const [item] = q.splice(i, 1)
        const id = item.id || Math.random().toString(36).slice(2)
        toasts.value.push({ ...item, id })
        soundManager.play('notify')
        setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3600)
      }
    }

    // Cola de escena grande (rara+): como mucho 2 por tanda (los de mayor
    // rareza) para no saturar con muchas escenas seguidas. El resto se agrupa
    // en una sola tarjeta "+N logros" con un único sonido.
    const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 }
    function rarityRank(item) { return RARITY_RANK[achievementIcon(item?.code)?.rarity] ?? 0 }
    const grouped = ref([])
    const groupExpanded = ref(false)
    let groupClearTimer = null
    let settleTimer = null

    function capBigSceneQueue() {
      const q = notificationsState.achievementQueue
      if (q.length <= 2) return
      const overflow = [...q].sort((a, b) => rarityRank(b) - rarityRank(a)).slice(2)
      for (const item of overflow) {
        const idx = q.findIndex(x => x.id === item.id)
        if (idx !== -1) q.splice(idx, 1)
      }
      if (!overflow.length) return
      groupExpanded.value = false
      grouped.value.push(...overflow)
      soundManager.play('notify')
      if (groupClearTimer) clearTimeout(groupClearTimer)
      groupClearTimer = setTimeout(() => { grouped.value = [] }, 12000)
    }

    // Debounce: espera a que termine de llegar la tanda (los inserts de
    // Realtime llegan escalonados, 0-240ms entre sí) antes de decidir el cupo.
    function scheduleCap() {
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        settleTimer = null
        capBigSceneQueue()
        if (notificationsState.achievementQueue.length > 0 && !current.value) showNext()
      }, 400)
    }

    function clearTimers() {
      phaseTimers.forEach(clearTimeout)
      phaseTimers = []
    }

    // ── Escena según dificultad (moodboard 02 · 04) ──
    const SCENE = {
      rare:      { c: '#38bdf8', g: 'rgba(56,189,248,.55)', m: ['#e0f2fe', '#38bdf8', '#0369a1'], md: 550, parts: 16, pd: 800, dim: .72, rays: false, shout: '¡Logro desbloqueado!' },
      epic:      { c: '#e879f9', g: 'rgba(232,121,249,.6)', m: ['#fae8ff', '#e879f9', '#a21caf'], md: 700, parts: 32, pd: 1100, dim: .8, rays: true, shout: '¡Logro desbloqueado!' },
      legendary: { c: '#fbbf24', g: 'rgba(251,191,36,.7)', m: ['#fff7d6', '#fbbf24', '#b45309'], md: 1500, parts: 64, pd: 1500, dim: .9, rays: true, shout: '¡Logro legendario!' },
    }
    const scene = ref(SCENE.rare)
    const dimOp = ref(0)
    const spotOn = ref(false)
    const raysOn = ref(false)
    const medalState = ref('hide') // hide · drop · stamp · idle
    const ringKey = ref(0)
    const flashKey = ref(0)
    const shoutOn = ref(false)
    const ribbonOn = ref(false)
    const descOn = ref(false)
    const pctOn = ref(false)
    const pctShown = ref(100)
    const xpOn = ref(false)
    const medalRef = ref(null)
    let pctCache = null
    function fmtPct(v) { return (v >= 10 ? v.toFixed(v % 1 ? 1 : 0) : v.toFixed(1)).replace('.', ',') + '%' }
    function countPct(target, dur) {
      if (reducedMotion) { pctShown.value = target; return }
      const t0 = performance.now(); let lastT = 0
      const st = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4)
        pctShown.value = k < 1 ? Math.round((100 - (100 - target) * e) * 10) / 10 : target
        if (now - lastT > 70 && k < 1) { lastT = now; soundManager.play('blip') }
        if (k < 1) requestAnimationFrame(st); else soundManager.play('coin')
      }
      requestAnimationFrame(st)
    }
    async function percentFor(item) {
      if (item.unlockPercent != null) return Number(item.unlockPercent)
      try { pctCache = pctCache || await getAchievementUnlockPercentages() } catch { pctCache = {} }
      const v = pctCache?.[item.code]
      return v != null ? Number(v) : null
    }
    function resetScene() {
      dimOp.value = 0; spotOn.value = false; raysOn.value = false; medalState.value = 'hide'
      shoutOn.value = false; ribbonOn.value = false; descOn.value = false; pctOn.value = false; xpOn.value = false; pctShown.value = 100
    }
    function runScene(item) {
      const rr = achievementIcon(item.code)?.rarity
      const sc = SCENE[rr] || SCENE.rare
      scene.value = sc
      legendary.value = rr === 'legendary'
      const L = legendary.value
      resetScene()
      const P = (fn, ms) => phaseTimers.push(setTimeout(fn, reducedMotion ? Math.min(ms, 40) : ms))
      const pctP = percentFor(item)
      P(() => { dimOp.value = sc.dim; soundManager.playBig('pumSmall') }, 0)
      let t = 150
      if (L) { P(() => { spotOn.value = true; soundManager.playBig('riserLong') }, 350); t = 450 }
      P(() => { medalState.value = 'drop'; if (!L) soundManager.playBig('riser') }, t)
      t += sc.md
      P(() => {
        medalState.value = 'stamp'; ringKey.value++
        soundManager.playBig('medalStamp')
        soundManager.play(L ? 'cardLegendary' : 'achievement')
        const el = medalRef.value
        if (el) { const c = center(el); sparks(c.x, c.y, sc.parts, [sc.c, '#fff'], L ? 230 : 150) }
        if (L) flashKey.value++
        if (sc.rays) raysOn.value = true
        phase.value = 1
      }, t)
      P(() => { shoutOn.value = true }, t + 150)
      P(() => { ribbonOn.value = true; soundManager.play('swoosh') }, t + 550)
      P(() => { descOn.value = true }, t + 800)
      P(async () => {
        const v = await pctP
        if (v == null || !Number.isFinite(v)) return
        pctOn.value = true; countPct(Math.max(0.1, Math.min(100, v)), sc.pd)
      }, t + 1000)
      P(() => { xpOn.value = true; soundManager.play('coin') }, t + 1100 + sc.pd)
      P(() => { phase.value = 4; medalState.value = 'idle' }, t + 1500 + sc.pd)
    }

    function showNext() {
      clearTimers()
      if (notificationsState.suppressOverlays) return
      // Si hay una escena de nivel en pantalla, el logro espera a que termine (no la corta)
      if (notificationsState.levelUpActive) { setAchievementActive(false); return }
      const item = shiftAchievementQueue()
      if (!item) { current.value = null; phase.value = 0; setAchievementActive(false); return }
      setAchievementActive(true)

      current.value = item
      claimed.value = false
      phase.value = 0
      // Legendaria: apagón + reflector y todo más lento
      legendary.value = (achievementIcon(item.code)?.rarity) === 'legendary'

      nextTick(() => runScene(item))
    }

    function claim() {
      if (claimed.value) return
      if (phase.value < 4) { // tocar antes de tiempo: adelanta la escena
        phaseTimers.forEach(clearTimeout); phaseTimers = []
        medalState.value = 'idle'; shoutOn.value = true; ribbonOn.value = true; descOn.value = true; xpOn.value = true
        if (pctOn.value) pctShown.value = pctShown.value
        phase.value = 4
        return
      }
      claimed.value = true
      soundManager.play('claim')
      spawnParticles()
      phaseTimers.push(setTimeout(flyToAvatar, 1000))
    }

    function flyToAvatar() {
      const iconEl = iconWrapRef.value
      if (!iconEl) { closeAndAdvance(); return }

      // Si la medalla estaba a mitad del bamboleo idle (ach-float) cuando
      // arranca el vuelo, medir su rect ahí y después cortar la animación
      // de golpe (ver .ach.flying más abajo) hace que "salte" al reposo
      // justo al iniciar el vuelo. Cortamos la animación ANTES de medir
      // para que el rect ya sea el de reposo.
      iconEl.style.animation = 'none'
      void iconEl.offsetHeight
      const startRect = iconEl.getBoundingClientRect()
      // Hay un ancla en el header mobile y otra en el desktop: usar la visible.
      const anchor = [...document.querySelectorAll('[data-avatar-anchor]')].find(el => el.getBoundingClientRect().width > 0) || null
      const anchorRect = anchor ? anchor.getBoundingClientRect() : null
      const hasAnchor = !!(anchorRect && anchorRect.width > 0)
      const targetRect = hasAnchor
        ? anchorRect
        : { top: 14, left: window.innerWidth - 54, width: 40, height: 40 }

      const scale = targetRect.width / startRect.width
      const deltaX = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2)
      const deltaY = (targetRect.top + targetRect.height / 2) - (startRect.top + startRect.height / 2)

      flying.value = true
      flightStyle.value = {
        position: 'fixed',
        top: `${startRect.top}px`,
        left: `${startRect.left}px`,
        width: `${startRect.width}px`,
        height: `${startRect.height}px`,
        margin: 0,
        zIndex: 70,
        transformOrigin: 'center center',
        transform: 'translate(0, 0) scale(1)',
        transition: 'none',
        opacity: 1,
      }

      nextTick(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            flightStyle.value = {
              ...flightStyle.value,
              transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})`,
              transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease-in',
              opacity: 0,
            }
          })
        })
      })

      phaseTimers.push(setTimeout(() => {
        if (hasAnchor && anchor) {
          anchor.style.animation = 'avatar-receive 0.5s var(--ease-bounce)'
          setTimeout(() => { anchor.style.animation = '' }, 550)
        }
        closeAndAdvance()
      }, 600))
    }

    function closeAndAdvance() {
      current.value = null
      phase.value = 0
      flying.value = false
      flightStyle.value = null
      phaseTimers.push(setTimeout(showNext, 200))
    }

    function spawnParticles() {
      const arr = []
      for (let i = 0; i < 12; i++) {
        arr.push({
          id: i,
          x: (Math.random() - 0.5) * 120,
          y: -(Math.random() * 80 + 30),
          delay: Math.random() * 0.2,
        })
      }
      particles.value = arr
    }

    function rarityLabel(pct) {
      if (pct == null) return null
      if (pct < 10) return { text: 'Ultra raro', cls: 'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-500/10' }
      if (pct < 30) return { text: 'Raro', cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10' }
      return { text: 'Común', cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10' }
    }

    watch(() => notificationsState.achievementQueue.length, (len) => {
      if (len > 0) drainEasy()
      if (len > 0) scheduleCap()
    })

    watch(() => notificationsState.suppressOverlays, (suppressed) => {
      if (!suppressed && notificationsState.achievementQueue.length > 0 && !current.value) {
        setTimeout(showNext, 600)
      }
    })
    // Terminó la escena de nivel → mostrar los logros que quedaron esperando
    watch(() => notificationsState.levelUpActive, (active) => {
      if (!active && notificationsState.achievementQueue.length > 0 && !current.value) setTimeout(showNext, 400)
    })

    function iconOf(item) { return achievementIcon(item?.code) }

    return { current, phase, claimed, particles, flying, flightStyle, iconWrapRef, claim, rarityLabel, iconOf, toasts, legendary,
      scene, dimOp, spotOn, raysOn, medalState, ringKey, flashKey, shoutOn, ribbonOn, descOn, pctOn, pctShown, fmtPct, xpOn, medalRef,
      grouped, groupExpanded }
  }
}
</script>

<template>
  <!-- Logros fáciles: cartel arriba, no bloquea -->
  <Teleport to="body">
    <div class="ach-toasts" aria-live="polite">
      <TransitionGroup name="ach-t">
        <div v-for="t in toasts" :key="t.id" class="ach-toast">
          <AchievementTile :icon-key="iconOf(t).icon" :rarity="iconOf(t).rarity" :size="40" />
          <div class="tx"><span class="k">Logro</span><b>{{ t.title }}</b></div>
          <span v-if="t.points" class="xp">+{{ t.points }} XP</span>
        </div>
      </TransitionGroup>
      <Transition name="ach-t">
        <div v-if="grouped.length" class="ach-group" :class="{ open: groupExpanded }">
          <button type="button" class="ach-group-pill" @click="groupExpanded = !groupExpanded">
            <span class="ico">🏆</span>
            <b>+{{ grouped.length }}</b> logro{{ grouped.length === 1 ? '' : 's' }}
            <span class="chev" :class="{ up: groupExpanded }">▾</span>
          </button>
          <div v-if="groupExpanded" class="ach-group-list">
            <div v-for="g in grouped" :key="g.id" class="ach-group-item">
              <AchievementTile :icon-key="iconOf(g).icon" :rarity="iconOf(g).rarity" :size="30" />
              <div class="tx"><b>{{ g.title }}</b></div>
              <span v-if="g.points" class="xp">+{{ g.points }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="current" class="ach" :class="{ leg: legendary, flying }" :style="{ '--rc': scene.c, '--rg': scene.g, '--m1': scene.m[0], '--m2': scene.m[1], '--m3': scene.m[2], '--md': scene.md + 'ms' }" @click.self="claim">
        <div class="ach-blur" :class="{ on: dimOp > 0 && !flying }" aria-hidden="true"></div>
        <div class="ach-dim" :style="{ opacity: flying ? 0 : dimOp }" @click="claim" aria-hidden="true"></div>
        <div class="ach-spotl" :class="{ on: spotOn && !flying }" aria-hidden="true"></div>
        <div class="ach-rays" :class="{ on: raysOn && !flying }" aria-hidden="true"></div>
        <div :key="'fl' + flashKey" class="ach-flash" :class="{ go: flashKey > 0 }" aria-hidden="true"></div>

        <div class="ach-body" @click="claim">
          <div class="ach-shout" :aria-label="scene.shout">
            <template v-if="shoutOn"><span v-for="(ch, i) in scene.shout.split('')" :key="i" :style="{ animationDelay: (i * 38) + 'ms' }">{{ ch === ' ' ? '\u00a0' : ch }}</span></template>
          </div>

          <div ref="medalRef" class="ach-medal" :class="'m-' + medalState">
            <div :key="'r' + ringKey" class="ach-ring" :class="{ go: ringKey > 0 }" aria-hidden="true"></div>
            <div ref="iconWrapRef" class="ach-coin" :style="flying ? flightStyle : null">
              <AchievementTile :icon-key="iconOf(current).icon" :rarity="iconOf(current).rarity" :size="92" />
            </div>
          </div>

          <div class="ach-ribbon" :class="{ on: ribbonOn }">{{ current.title }}</div>
          <p class="ach-desc" :class="{ on: descOn }">{{ current.description }}</p>
          <p class="ach-pct" :class="{ on: pctOn }">Solo el <b>{{ fmtPct(pctShown) }}</b> de los jugadores lo tiene</p>
          <span class="ach-xp" :class="{ on: xpOn }">+{{ current.points || 0 }} XP</span>

          <button type="button" class="ach-claim" :class="{ on: phase >= 4 && !flying, done: claimed }" :disabled="claimed" @click.stop="claim">
            {{ claimed ? '¡Reclamado!' : 'Reclamar' }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ach-toasts { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 66; display: grid; gap: 8px; pointer-events: none; width: min(92vw, 360px); }
.ach-toast { display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; border-radius: 14px; background: rgba(11, 16, 36, .94); border: 1px solid rgba(16, 185, 129, .45); box-shadow: 0 12px 30px rgba(0, 0, 0, .5), 0 0 18px rgba(16, 185, 129, .2); backdrop-filter: blur(6px); }
.ach-toast .tx { flex: 1; min-width: 0; display: grid; line-height: 1.15; }
.ach-toast .k { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; color: #34d399; }
.ach-toast b { font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ach-toast .xp { font-family: var(--font-bug); font-weight: 800; font-size: 16px; color: #fcd34d; }
.ach-group { pointer-events: auto; display: grid; gap: 6px; justify-items: center; }
.ach-group-pill { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; background: rgba(11, 16, 36, .94); border: 1px solid rgba(251, 191, 36, .45); box-shadow: 0 12px 30px rgba(0, 0, 0, .5), 0 0 18px rgba(251, 191, 36, .2); backdrop-filter: blur(6px); color: #fff; font-family: var(--font-bug); font-weight: 800; font-size: 14px; cursor: pointer; }
.ach-group-pill .ico { font-size: 16px; }
.ach-group-pill b { color: #fcd34d; font-size: 16px; }
.ach-group-pill .chev { transition: transform .25s ease; color: #8b93b8; }
.ach-group-pill .chev.up { transform: rotate(180deg); }
.ach-group-list { display: grid; gap: 6px; width: min(92vw, 360px); background: rgba(11, 16, 36, .94); border: 1px solid rgba(255, 255, 255, .12); border-radius: 14px; padding: 8px; box-shadow: 0 12px 30px rgba(0, 0, 0, .5); }
.ach-group-item { display: flex; align-items: center; gap: 10px; padding: 4px 6px; }
.ach-group-item .tx { flex: 1; min-width: 0; }
.ach-group-item b { font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.ach-group-item .xp { font-family: var(--font-bug); font-weight: 800; font-size: 13px; color: #fcd34d; }
.ach-t-enter-active { transition: transform .45s cubic-bezier(.34, 1.56, .64, 1), opacity .3s; }
.ach-t-leave-active { transition: transform .3s ease, opacity .3s; }
.ach-t-enter-from { transform: translateY(-120%); opacity: 0; }
.ach-t-leave-to { transform: translateY(-60%); opacity: 0; }
.ach-spot { background: conic-gradient(from 180deg at 50% -10%, transparent 0deg 160deg, rgba(255, 240, 190, .24) 172deg 188deg, transparent 200deg 360deg); animation: ach-spot .9s ease both; }
@keyframes ach-spot { from { opacity: 0; } to { opacity: 1; } }
.overlay-fade-enter-active { transition: opacity 0.3s ease; }
.overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }
/* ── Escena central (moodboard 02 · 04) ── */
.ach { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; overflow: hidden; }
.ach-dim { position: absolute; inset: 0; background: #02030a; transition: opacity .5s; }
.ach-blur { position: absolute; inset: 0; opacity: 0; transition: opacity .5s; -webkit-backdrop-filter: blur(10px) saturate(.6) brightness(.6); backdrop-filter: blur(10px) saturate(.6) brightness(.6); }
.ach-blur.on { opacity: 1; }
.ach-spotl { position: absolute; left: 50%; top: -10%; width: min(900px, 110vw); height: 110%; transform: translateX(-50%); opacity: 0; transition: opacity .8s; pointer-events: none;
  background: conic-gradient(from 180deg at 50% 0%, transparent 0deg 160deg, rgba(255, 240, 190, .26) 172deg 188deg, transparent 200deg 360deg);
  -webkit-mask: linear-gradient(180deg, #000 40%, transparent 95%); mask: linear-gradient(180deg, #000 40%, transparent 95%); }
.ach-spotl.on { opacity: 1; }
.ach-rays { position: absolute; left: 50%; top: 42%; width: min(1100px, 160vw); aspect-ratio: 1; transform: translate(-50%, -50%) scale(.3); opacity: 0; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, var(--rc) 0 6deg, transparent 6deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 0%, transparent 55%); mask: radial-gradient(circle, #000 0%, transparent 55%); transition: opacity .5s, transform .8s cubic-bezier(.16, 1, .3, 1); }
.ach-rays.on { opacity: .4; transform: translate(-50%, -50%) scale(1); animation: ach-spin 14s linear infinite; }
@keyframes ach-spin { to { transform: translate(-50%, -50%) scale(1) rotate(360deg); } }
.ach-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 30; }
.ach-flash.go { animation: ach-flash .35s ease-out; }
@keyframes ach-flash { from { opacity: .8; } to { opacity: 0; } }
.ach-body { position: relative; z-index: 5; display: grid; justify-items: center; gap: 12px; text-align: center; width: min(100%, 520px); }
.ach-shout { display: flex; justify-content: center; min-height: 1em; font-family: var(--font-shout); font-weight: 800; font-style: italic; text-transform: uppercase; font-size: clamp(22px, 6.8vw, 46px); line-height: 1; white-space: nowrap; }
.ach-shout span { display: inline-block; color: var(--rc); text-shadow: 0 .05em 0 rgba(0, 0, 0, .5), 0 0 .4em var(--rg); animation: ach-lpop .34s cubic-bezier(.34, 1.56, .64, 1) both; }
@keyframes ach-lpop { from { opacity: 0; transform: translateY(-.4em) scale(1.8); } to { opacity: 1; transform: none; } }
.ach-medal { position: relative; width: clamp(130px, 34vw, 170px); aspect-ratio: 1; perspective: 600px; }
.ach-coin { position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 35% 28%, var(--m1), var(--m2) 55%, var(--m3)); box-shadow: 0 0 0 4px color-mix(in srgb, var(--m3) 80%, #000), 0 14px 30px rgba(0, 0, 0, .5), 0 0 40px var(--rg); }
.ach-coin::before { content: ""; position: absolute; inset: 9%; border-radius: 50%; border: 2px dotted rgba(255, 255, 255, .55); pointer-events: none; }
.ach-coin > * { position: relative; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, .35)); border-radius: 22%; }
.ach-medal.m-hide { opacity: 0; }
.ach-medal.m-drop { animation: ach-drop var(--md) cubic-bezier(.5, 0, .75, 0) both; }
.ach-medal.m-drop .ach-coin { animation: ach-mspin var(--md) linear both; }
@keyframes ach-drop { from { transform: translateY(-80vh) scale(.6); opacity: 1; } to { transform: none; opacity: 1; } }
@keyframes ach-mspin { from { transform: rotateY(0); } to { transform: rotateY(1080deg); } }
.ach-medal.m-stamp { animation: ach-mstamp .45s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes ach-mstamp { 0% { transform: scale(1.35); } 100% { transform: scale(1); } }
.ach-medal.m-idle .ach-coin { animation: ach-float 3s ease-in-out infinite; }
@keyframes ach-float { 50% { transform: translateY(-6px) rotate(-2deg); } }
.ach-ring { position: absolute; left: 50%; top: 50%; width: 100%; aspect-ratio: 1; border-radius: 50%; border: 3px solid var(--rc); transform: translate(-50%, -50%) scale(.6); opacity: 0; pointer-events: none; }
.ach-ring.go { animation: ach-ring .7s cubic-bezier(.16, 1, .3, 1); }
@keyframes ach-ring { 0% { opacity: .9; transform: translate(-50%, -50%) scale(.8); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(2.8); } }
.ach-ribbon { position: relative; padding: 7px 34px; background: var(--rc); color: #0b1024; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: clamp(18px, 4.6vw, 24px); line-height: 1.05;
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%); transform: scaleX(0); transition: transform .45s cubic-bezier(.34, 1.4, .64, 1); max-width: 92vw; }
.ach-ribbon.on { transform: scaleX(1); }
.ach-desc { margin: 0; font-size: 15px; color: #c5cbe8; opacity: 0; transition: opacity .4s; }
.ach-pct { margin: 0; font-family: var(--font-bug); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 14px; color: #8b93b8; opacity: 0; transition: opacity .3s; }
.ach-pct b { font-size: 1.5em; color: var(--rc); font-variant-numeric: tabular-nums; }
.ach-desc.on, .ach-pct.on { opacity: 1; }
.ach-xp { display: inline-block; font-family: var(--font-bug); font-weight: 800; font-size: 20px; background: #fcd34d; color: #141005; padding: 3px 14px; border-radius: 8px; opacity: 0; transform: scale(.6); transition: opacity .25s, transform .35s cubic-bezier(.34, 1.56, .64, 1); }
.ach-xp.on { opacity: 1; transform: none; }
.ach-claim { margin-top: 6px; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 18px; padding: 12px 38px; border-radius: 14px; border: 0; cursor: pointer; color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); box-shadow: 0 10px 26px rgba(245, 158, 11, .35); opacity: 0; transform: translateY(10px); transition: opacity .3s, transform .3s; pointer-events: none; }
.ach-claim.on { opacity: 1; transform: none; pointer-events: auto; }
.ach-claim.done { background: #16a34a; color: #fff; }
.ach.flying .ach-coin, .ach.flying .ach-medal { animation: none !important; }
.ach.flying .ach-coin::before { display: none; }
.ach.flying .ach-coin { background: transparent; box-shadow: none; }
.ach.flying .ach-body > :not(.ach-medal) { opacity: 0 !important; transition: opacity .2s; }
@media (prefers-reduced-motion: reduce) { .ach-rays.on, .ach-medal.m-idle .ach-coin, .ach-shout span { animation: none; } }
</style>
