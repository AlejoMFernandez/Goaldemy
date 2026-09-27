<script>
/**
 * POPUP DE INICIO = LA PREVIA (Moodboard 07 v2)
 *
 * Liviana y con el premio en grande:
 *  · Banner del póster del juego (arte + cinta de tipo + nombre).
 *  · Cómo se gana en una línea dibujada (10 pelotas + reloj + ¡Basta!).
 *  · Dificultad: selector de pastilla que se desliza + una línea de datos.
 *    Recuerda la última dificultad elegida en cada juego.
 *  · "Podés ganar hasta +XP" en grande, con la carta del próximo premio de
 *    nivel (se prende en dorado si te alcanza) y la barra con el XP posible.
 *  · Consejos, video y objetivo quedan dentro de "Cómo se juega".
 * Misma API que antes: props open/gameName/…/gameType, emite close y start.
 */
import { ref, computed, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { GAME_TYPES } from '@/services/game-celebrations';
import { DIFFICULTY_LEVELS, getDifficultyConfig } from '@/services/games';
import { GAME_ART, GAME_POSTER_META, POSTER_RIBBONS, BALL_SVG } from '@/services/game-art';
import { captureLevelSnapshot } from '@/services/xp';
import { fetchDailyWinStreak } from '@/services/game-modes';
import { upcomingPrizes, nextRealPrize } from '@/services/prize-card';
import { soundManager } from '@/services/sounds';
import PrizeCard from '@/components/rewards/PrizeCard.vue';

const DIFF_COLORS = { easy: '#4ade80', normal: '#fcd34d', hard: '#f87171' };

/** XP máximo "limpio" de un partido según el tipo y la dificultad. */
export function maxXpFor(type, cfg = {}) {
  const c = Number(cfg.xpCompletion) || 0;
  switch (type) {
    case GAME_TYPES.TIMED: return (Number(cfg.xpPerCorrect) || 0) * (Number(cfg.targetCorrect) || 10) + c;
    case GAME_TYPES.PUZZLE: return (Number(cfg.xpPerGroup) || 0) * 4 + c;
    case GAME_TYPES.GRID: return (Number(cfg.xpPerCell) || 0) * 9 + c;
    case GAME_TYPES.CHAIN: {
      const n = Number(cfg.target || cfg.chainLength || (String(cfg.description || '').match(/(\d+)/) || [])[1] || 10);
      return (Number(cfg.xpPerCorrect) || 0) * n + c;
    }
    case GAME_TYPES.LIVES: return (Number(cfg.xpPerCorrect) || 0) + c;
    default: return c;
  }
}

export default {
  name: 'GamePreviewModal',
  components: { PrizeCard },
  props: {
    open: { type: Boolean, default: false },
    gameName: { type: String, required: true },
    gameDescription: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    mechanic: { type: String, default: '' },
    tips: { type: Array, default: () => [] },
    gameType: { type: String, default: GAME_TYPES.TIMED }, // 'timed', 'ordering', 'lives', …
    slug: { type: String, default: '' },
  },
  emits: ['close', 'start'],
  setup(props, { emit }) {
    const route = useRoute();
    const gameSlug = computed(() => props.slug || String(route?.path || '').split('/')[2] || '');
    const isTimed = computed(() => props.gameType === GAME_TYPES.TIMED);

    // ── Dificultad (recuerda la última elegida por juego) ──
    const storeKey = computed(() => `gl:last_difficulty:${gameSlug.value || props.gameName}`);
    function readLast() { try { return localStorage.getItem(storeKey.value) || '' } catch { return '' } }
    const lastPicked = ref(readLast());
    const selectedDifficulty = ref(Object.values(DIFFICULTY_LEVELS).includes(lastPicked.value) ? lastPicked.value : DIFFICULTY_LEVELS.NORMAL);

    const difficultyOptions = computed(() => [
      { value: DIFFICULTY_LEVELS.EASY, ...getDifficultyConfig(props.gameType, DIFFICULTY_LEVELS.EASY) },
      { value: DIFFICULTY_LEVELS.NORMAL, ...getDifficultyConfig(props.gameType, DIFFICULTY_LEVELS.NORMAL) },
      { value: DIFFICULTY_LEVELS.HARD, ...getDifficultyConfig(props.gameType, DIFFICULTY_LEVELS.HARD) },
    ]);
    const currentConfig = computed(() => getDifficultyConfig(props.gameType, selectedDifficulty.value));
    const diffIndex = computed(() => Math.max(0, difficultyOptions.value.findIndex(o => o.value === selectedDifficulty.value)));
    function pick(v) {
      if (v === selectedDifficulty.value) return;
      selectedDifficulty.value = v;
      soundManager.play('click');
    }

    // ── Banner ──
    const meta = computed(() => GAME_POSTER_META[gameSlug.value] || null);
    const ribbon = computed(() => POSTER_RIBBONS[meta.value?.type] || null);
    const art = computed(() => (GAME_ART[gameSlug.value] || '').replace(/id="(cp[a-z])"/g, 'id="pv$1"').replace(/url\(#(cp[a-z])\)/g, 'url(#pv$1)'));

    // ── Premio en juego ──
    const maxXp = computed(() => maxXpFor(props.gameType, currentConfig.value));
    const shownMax = ref(0);
    let raf = 0;
    watch(maxXp, (to) => {
      cancelAnimationFrame(raf);
      const from = shownMax.value; const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 350); shownMax.value = Math.round(from + (to - from) * k); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, { immediate: true });
    const snap = ref(null); // { level, percent, xpToNext }
    const nextPrize = computed(() => snap.value?.level ? nextRealPrize(snap.value.level) : null);
    const reach = computed(() => !!(snap.value && snap.value.xpToNext != null && maxXp.value >= Number(snap.value.xpToNext)));
    const ghostPct = computed(() => {
      const s = snap.value; if (!s || !s.xpToNext) return 0;
      const range = Number(s.range) || Number(s.xpToNext) / Math.max(0.01, (100 - (s.percent || 0)) / 100);
      return Math.min(100 - (s.percent || 0), (maxXp.value / Math.max(1, range)) * 100);
    });
    // Cuánto te quedaría para el próximo nivel con un partido perfecto (si no te alcanza)
    const leftAfter = computed(() => snap.value?.xpToNext != null ? Math.max(0, Number(snap.value.xpToNext) - maxXp.value) : null);
    // Consejos dibujados de "Cómo se juega" (Moodboard 07): 3 tarjetas con ilustración
    const TIP_ART = {
      clock: '<svg viewBox="0 0 90 44"><circle cx="30" cy="24" r="14" fill="none" stroke="#fcd34d" stroke-width="3"/><path d="M30 16v8l5 3M26 6h8" stroke="#fcd34d" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 24h14" stroke="#8b93b8" stroke-width="2.5" stroke-linecap="round"/><path d="M60 19l5 5-5 5" stroke="#8b93b8" stroke-width="2.5" fill="none"/><text x="78" y="30" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="15" fill="#fcd34d">XP</text></svg>',
      help: '<svg viewBox="0 0 90 44"><rect x="8" y="10" width="34" height="24" rx="4" fill="#e879f9" fill-opacity=".25" stroke="#e879f9" stroke-width="2"/><text x="25" y="27" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="12" fill="#f5d0fe">50/50</text><rect x="48" y="10" width="34" height="24" rx="4" fill="#38bdf8" fill-opacity=".25" stroke="#38bdf8" stroke-width="2"/><path d="M65 14l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8v-5z" fill="#38bdf8"/></svg>',
      flame: '<svg viewBox="0 0 90 44"><g fill="#fbbf24">' + [0, 1, 2].map(i => `<path transform="translate(${14 + i * 22} 8) scale(1.2)" d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z" opacity="${0.5 + i * 0.25}"/>`).join('') + '</g></svg>',
      drag: '<svg viewBox="0 0 90 44"><rect x="10" y="6" width="44" height="12" rx="3" fill="#c4b5fd" fill-opacity=".3" stroke="#c4b5fd" stroke-width="2"/><rect x="18" y="26" width="44" height="12" rx="3" fill="#c4b5fd" stroke="#c4b5fd" stroke-width="2"/><path d="M74 12v20M69 17l5-5 5 5M69 27l5 5 5-5" stroke="#fcd34d" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      target: '<svg viewBox="0 0 90 44"><circle cx="45" cy="22" r="17" fill="none" stroke="#4ade80" stroke-width="3"/><circle cx="45" cy="22" r="9" fill="none" stroke="#4ade80" stroke-width="3"/><circle cx="45" cy="22" r="3" fill="#4ade80"/></svg>',
      bulb: '<svg viewBox="0 0 90 44"><path d="M45 6a12 12 0 0 0-7 21.7c1.3 1 2 2.4 2 4V33h10v-1.3c0-1.6.7-3 2-4A12 12 0 0 0 45 6z" fill="#fcd34d" fill-opacity=".25" stroke="#fcd34d" stroke-width="2.5"/><path d="M40 38h10" stroke="#fcd34d" stroke-width="2.5" stroke-linecap="round"/></svg>',
    };
    const howTips = computed(() => {
      if (isTimed.value) return [
        { art: TIP_ART.clock, text: 'Llegá a 10 rápido: lo que sobra suma XP' },
        { art: TIP_ART.help, text: 'Usá tus ayudas en la partida' },
        { art: TIP_ART.flame, text: '3 seguidas y se prende la racha' },
      ];
      const arts = props.gameType === GAME_TYPES.ORDERING ? [TIP_ART.drag, TIP_ART.target, TIP_ART.bulb] : [TIP_ART.target, TIP_ART.bulb, TIP_ART.flame];
      const texts = (props.tips || []).slice(0, 3);
      if (props.gameType === GAME_TYPES.ORDERING && !texts.length) texts.push('Arrastrá una carta o tocá dos para cambiarlas', 'Cada puesto bien ubicado suma', 'Los errores te muestran su lugar');
      return texts.map((t, i) => ({ art: arts[i % arts.length], text: t }));
    });
    // Racha del juego ANTES de jugar: el resumen la usa para la escena de la llama
    const streakBefore = ref(null);
    async function loadStreak() {
      try { streakBefore.value = gameSlug.value ? await fetchDailyWinStreak(gameSlug.value) : null } catch { streakBefore.value = null }
    }
    async function loadSnap() {
      try { const s = await captureLevelSnapshot(); snap.value = s?.level ? s : null } catch { snap.value = null }
    }

    // ── Cómo se juega (hoja con objetivo, consejos y video) ──
    const howOpen = ref(false);
    const introKey = ref(0);

    function startGame() {
      window.scrollTo({ top: 0 });
      try { localStorage.setItem(storeKey.value, selectedDifficulty.value) } catch {}
      try { if (gameSlug.value && streakBefore.value != null) sessionStorage.setItem(`gl:streak_before:${gameSlug.value}`, String(streakBefore.value)) } catch {}
      // El pitazo inicial (KickoffOverlay) corre adentro del juego.
      emit('start', { difficulty: selectedDifficulty.value, config: currentConfig.value });
    }

    // Bloquear el scroll del fondo mientras la previa está abierta
    let hadScrollLock = false;
    function lockBodyScroll(lock) {
      if (typeof document === 'undefined') return;
      if (lock) { window.scrollTo({ top: 0 }); document.body.style.overflow = 'hidden'; hadScrollLock = true; }
      else if (hadScrollLock) { document.body.style.overflow = ''; hadScrollLock = false; }
    }
    watch(() => props.open, (isOpen) => {
      lockBodyScroll(isOpen);
      if (isOpen) { howOpen.value = false; introKey.value++; lastPicked.value = readLast(); loadSnap(); loadStreak(); }
    }, { immediate: true });
    onUnmounted(() => { cancelAnimationFrame(raf); lockBodyScroll(false); });

    return {
      selectedDifficulty, difficultyOptions, currentConfig, diffIndex, pick, lastPicked,
      startGame, DIFFICULTY_LEVELS, DIFF_COLORS, isTimed, meta, ribbon, art,
      maxXp, shownMax, snap, nextPrize, reach, ghostPct, leftAfter, howOpen, introKey, howTips, BALL_SVG,
    };
  },
};
</script>

<template>
  <Teleport to="body">
    <Transition name="pv">
      <div v-if="open" class="pv-wrap" @click.self="$emit('close')">
        <div :key="introKey" class="pv" role="dialog" aria-modal="true" :aria-label="gameName">
          <!-- Banner del póster -->
          <div class="pv-ban" :style="meta ? { '--c1': meta.c1, '--c2': meta.c2 } : null">
            <span v-if="art" class="pv-art" v-html="art"></span>
            <button type="button" class="pv-x" aria-label="Cerrar" @click="$emit('close')">✕</button>
            <div class="pv-tt">
              <span v-if="ribbon" class="pv-rib" :style="{ '--rc': ribbon.color }"><span class="ri" v-html="ribbon.icon"></span>{{ ribbon.label }}</span>
              <h2>{{ gameName }}</h2>
            </div>
          </div>

          <div class="pv-body">
            <!-- Cómo se gana, dibujado -->
            <div v-if="isTimed" class="pv-goal">
              <span class="balls" aria-hidden="true"><i v-for="i in (currentConfig.targetCorrect || 10)" :key="i" :style="{ animationDelay: (0.25 + i * 0.09) + 's' }" v-html="BALL_SVG"></i></span>
              <span>en</span>
              <span class="clk">{{ Math.floor((currentConfig.time || 0) / 60) }}:{{ String((currentConfig.time || 0) % 60).padStart(2, '0') }}</span>
              <span class="bt">⏱ lo que sobra → XP</span>
            </div>
            <p v-else-if="mechanic" class="pv-mech">{{ mechanic }}</p>

            <!-- Dificultad liviana -->
            <div class="pv-dsel">
              <div class="pill" role="radiogroup" aria-label="Dificultad">
                <span class="th" :style="{ transform: `translateX(${diffIndex * 100}%)`, '--dc': DIFF_COLORS[selectedDifficulty] }"></span>
                <button
                  v-for="o in difficultyOptions" :key="o.value" type="button" role="radio"
                  :aria-checked="selectedDifficulty === o.value" :class="{ on: selectedDifficulty === o.value }"
                  :style="{ '--dc': DIFF_COLORS[o.value] }" @click="pick(o.value)"
                ><i></i>{{ o.label }}</button>
              </div>
              <div class="dline">
                <span v-if="currentConfig.time">⏱ <b>{{ currentConfig.time }} s</b></span>
                <span v-else-if="currentConfig.description">{{ currentConfig.description }}</span>
                <span v-if="currentConfig.xpPerCorrect"><b>{{ currentConfig.xpPerCorrect }} XP</b> por acierto</span>
                <span v-if="currentConfig.xpCompletion"><b>+{{ currentConfig.xpCompletion }}</b> al completar</span>
              </div>
            </div>

            <!-- Lo que está en juego: el premio en grande -->
            <div class="pv-prize">
              <div class="top">
                <div>
                  <div class="lb">Podés ganar hasta</div>
                  <div class="xp"><span>+{{ shownMax }}</span><small>XP</small></div>
                  <div v-if="isTimed" class="lb2">+ bonus ¡Basta! si te sobra tiempo</div>
                </div>
                <div v-if="nextPrize" class="card" :class="{ reach: reach && nextPrize.level === snap.level + 1 }">
                  <PrizeCard :prize="nextPrize.prize" :size="92" />
                  <span class="pl">{{ reach && nextPrize.level === snap.level + 1 ? '¡A tu alcance!' : `Premio NV ${nextPrize.level}` }}</span>
                </div>
              </div>
              <!-- Barra estimativa: hasta dónde llegás con un partido perfecto en esta dificultad -->
              <div v-if="snap" class="lvl" :class="{ reach }">
                <span class="nv">NV {{ snap.level }}</span>
                <div class="bar">
                  <i class="cur" :style="{ width: (snap.percent || 0) + '%' }"></i>
                  <i class="gh" :style="{ left: (snap.percent || 0) + '%', width: ghostPct + '%' }"></i>
                  <span class="tag" :style="{ left: Math.min(100, (snap.percent || 0) + ghostPct) + '%' }">+{{ shownMax }}</span>
                </div>
                <span class="nv nx"><span v-if="reach" class="up" aria-hidden="true">▲</span>NV {{ snap.level + 1 }}</span>
              </div>
              <p v-if="snap" class="foot">
                <template v-if="reach">¡Con un partido perfecto <b>subís al nivel {{ snap.level + 1 }}</b>!</template>
                <template v-else-if="leftAfter != null">Con un partido perfecto quedás a <b>{{ leftAfter }} XP</b> del nivel {{ snap.level + 1 }}.</template>
              </p>
            </div>

            <div class="pv-go">
              <button type="button" class="how" @click="howOpen = true">Cómo se juega</button>
              <button type="button" class="play" @click="startGame">¡A jugar!</button>
            </div>
          </div>

          <!-- Hoja "Cómo se juega" -->
          <div class="pv-sheet" :class="{ on: howOpen }" :aria-hidden="!howOpen">
            <p v-if="mechanic || gameDescription" class="d">{{ mechanic || gameDescription }}</p>
            <div v-if="howTips.length" class="tips">
              <div v-for="(t, i) in howTips" :key="i" class="tip"><span class="ta" v-html="t.art"></span><span>{{ t.text }}</span></div>
            </div>
            <div v-if="videoUrl" class="vid"><video :src="videoUrl" controls preload="metadata"></video></div>
            <button type="button" class="ok" @click="howOpen = false">Entendido</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pv-wrap { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; background: rgba(3, 5, 14, .82); overflow-y: auto; }
.pv { position: relative; width: min(100%, 520px); border-radius: 18px; overflow: hidden; background: #0b1024; border: 1px solid rgba(255, 255, 255, .12); box-shadow: 0 30px 80px rgba(0, 0, 0, .6); animation: pv-in .5s cubic-bezier(.16, 1, .3, 1) both; }
@keyframes pv-in { from { transform: translateY(24px) scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }
@media (max-width: 560px) {
  .pv-wrap { place-items: end center; padding: 0; }
  .pv { width: 100%; border-radius: 18px 18px 0 0; max-height: 94vh; overflow-y: auto; animation-name: pv-up; }
  @keyframes pv-up { from { transform: translateY(100%); } to { transform: none; } }
}
/* banner */
.pv-ban { --c1: #06b6d4; --c2: #083344; position: relative; height: clamp(130px, 30vw, 176px); overflow: hidden;
  background: radial-gradient(60% 90% at 78% 40%, color-mix(in srgb, var(--c1) 60%, transparent), transparent 70%), linear-gradient(120deg, #050716 0%, var(--c2) 55%, color-mix(in srgb, var(--c1) 60%, #000) 100%); }
.pv-ban::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(115deg, rgba(255, 255, 255, .05) 0 9px, transparent 9px 22px); }
.pv-art { position: absolute; right: -2%; top: -8%; height: 125%; aspect-ratio: 200 / 170; animation: pv-art .7s .15s cubic-bezier(.16, 1, .3, 1) both; }
.pv-art :deep(svg) { width: 100%; height: 100%; }
@keyframes pv-art { from { transform: translateX(30%) rotate(8deg); opacity: 0; } to { transform: none; opacity: 1; } }
.pv-tt { position: absolute; left: 18px; bottom: 14px; right: 42%; }
.pv-tt h2 { margin: 0; font-family: var(--font-shout); font-weight: 400; text-transform: uppercase; font-size: clamp(28px, 7vw, 42px); line-height: .92; color: #fff; text-shadow: 0 3px 0 rgba(0, 0, 0, .35); text-wrap: balance; }
.pv-rib { display: inline-flex; align-items: center; gap: .35em; margin-bottom: 8px; padding: 4px 9px; border-radius: 6px; background: var(--rc); color: #141005; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 13px; line-height: 1; }
.pv-rib .ri { display: inline-flex; width: 1.1em; height: 1.1em; }
.pv-rib .ri :deep(svg) { width: 100%; height: 100%; }
.pv-x { position: absolute; right: 10px; top: 10px; z-index: 2; width: 34px; height: 34px; border-radius: 50%; border: 0; background: rgba(0, 0, 0, .45); color: #fff; font-size: 16px; cursor: pointer; }
/* cuerpo */
.pv-body { padding: 16px; display: grid; gap: 16px; }
.pv-body > * { animation: pv-row .45s cubic-bezier(.16, 1, .3, 1) both; }
.pv-body > *:nth-child(2) { animation-delay: .08s; } .pv-body > *:nth-child(3) { animation-delay: .16s; } .pv-body > *:nth-child(4) { animation-delay: .24s; }
@keyframes pv-row { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.pv-goal { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; font-size: 14px; color: #c5cbe8; }
.pv-goal .balls { display: flex; gap: 3px; }
.pv-goal .balls i { width: 17px; aspect-ratio: 1; border-radius: 50%; display: block; animation: pv-ball .4s cubic-bezier(.34, 1.56, .64, 1) both; }
.pv-goal .balls i :deep(svg) { width: 100%; height: 100%; display: block; }
@keyframes pv-ball { from { transform: scale(0) rotate(-120deg); opacity: 0; } to { transform: none; opacity: 1; } }
.pv-goal .clk { font-family: var(--font-bug); font-weight: 800; font-size: 17px; background: #fff; color: #070a1a; border-radius: 5px; padding: 0 7px; font-variant-numeric: tabular-nums; }
.pv-goal .bt { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; background: rgba(252, 211, 77, .1); color: #fde68a; font-size: 13px; }
.pv-mech { margin: 0; text-align: center; font-size: 14px; color: #c5cbe8; }
/* dificultad */
.pv-dsel { display: grid; gap: 8px; justify-items: center; }
.pill { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); padding: 4px; border-radius: 999px; background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .08); width: min(100%, 360px); }
.pill .th { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3); border-radius: 999px; background: color-mix(in srgb, var(--dc) 22%, #141a38); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--dc) 70%, transparent), 0 4px 14px color-mix(in srgb, var(--dc) 25%, transparent); transition: transform .35s cubic-bezier(.34, 1.3, .64, 1), background .3s, box-shadow .3s; }
.pill button { position: relative; z-index: 1; border: 0; background: none; color: #8b93b8; font-weight: 600; font-size: 14px; padding: 9px 6px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: color .2s; }
.pill button.on { color: #fff; }
.pill button i { width: 7px; height: 7px; border-radius: 50%; background: var(--dc); }
.dline { font-size: 13px; color: #8b93b8; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.dline b { color: #dfe4ff; font-weight: 600; }
.dline .last { color: #5b6388; font-size: 12px; }
/* premio */
.pv-prize { border-radius: 16px; padding: 16px; background: radial-gradient(120% 100% at 0% 0%, rgba(252, 211, 77, .14), transparent 60%), #10163a; border: 1px solid rgba(252, 211, 77, .25); display: grid; gap: 12px; }
.pv-prize .top { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; }
.pv-prize .lb { font-size: 13px; color: #c5cbe8; }
.pv-prize .lb2 { font-size: 12px; color: #8b93b8; }
.pv-prize .xp { font-family: var(--font-bug); font-weight: 800; font-size: clamp(44px, 12vw, 60px); line-height: .95; color: #fcd34d; font-variant-numeric: tabular-nums; text-shadow: 0 0 24px rgba(252, 211, 77, .35); }
.pv-prize .xp small { font-size: .42em; margin-left: 4px; color: #fde68a; }
.pv-prize .card { display: grid; justify-items: center; gap: 8px; transition: filter .3s; }
.pv-prize .card .pl { font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: #8b93b8; }
.pv-prize .card.reach .pl { color: #fcd34d; }
.pv-prize .card.reach :deep(.pcard) { animation: pv-bob 1.6s ease-in-out infinite; box-shadow: 0 0 22px rgba(252, 211, 77, .4); }
@keyframes pv-bob { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-4px) rotate(2deg); } }
.lvl { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; }
.lvl .nv { font-family: var(--font-bug); font-weight: 800; font-size: 15px; color: #c5cbe8; }
.lvl .nv.nx { color: #fcd34d; }
.lvl .bar { position: relative; height: 12px; border-radius: 8px; background: rgba(255, 255, 255, .08); }
.lvl .bar .tag { position: absolute; top: -24px; transform: translateX(-50%); font-family: var(--font-bug); font-weight: 800; font-size: 13px; line-height: 1; padding: 3px 6px; border-radius: 6px; background: #fcd34d; color: #141005; white-space: nowrap; transition: left .5s cubic-bezier(.16, 1, .3, 1); }
.lvl .bar .tag::after { content: ""; position: absolute; left: 50%; bottom: -4px; margin-left: -4px; border: 4px solid transparent; border-bottom: 0; border-top-color: #fcd34d; }
.lvl { margin-top: 20px; }
.lvl.reach .bar { box-shadow: 0 0 14px rgba(252, 211, 77, .45); }
.lvl.reach .bar .tag { transform: translateX(-85%); }
.lvl .nv .up { display: inline-block; margin-right: 3px; color: #4ade80; animation: pv-up 1s ease-in-out infinite; }
@keyframes pv-up { 50% { transform: translateY(-3px); } }
.lvl.reach .nv.nx { color: #4ade80; text-shadow: 0 0 10px rgba(74, 222, 128, .5); }
.lvl .bar .cur { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px 0 0 8px; background: linear-gradient(90deg, #f59e0b, #fcd34d); }
.lvl .bar .gh { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, rgba(252, 211, 77, .6) 0 5px, rgba(252, 211, 77, .2) 5px 10px); transition: width .5s cubic-bezier(.16, 1, .3, 1); animation: pv-gh 1.4s ease-in-out infinite; }
@keyframes pv-gh { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
.pv-prize .foot { margin: 0; text-align: center; font-size: 13px; color: #c5cbe8; }
.pv-prize .foot b { color: #fcd34d; }
/* botones */
.pv-go { display: flex; gap: 10px; align-items: center; position: sticky; bottom: 0; }
.pv-go .how { font-weight: 600; font-size: 13px; color: #8b93b8; background: none; border: 1px solid rgba(255, 255, 255, .1); border-radius: 12px; padding: 14px 12px; cursor: pointer; white-space: nowrap; }
.pv-go .play { flex: 1; position: relative; overflow: hidden; border: 0; cursor: pointer; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 21px; padding: 13px; border-radius: 12px; color: #141005; background: linear-gradient(180deg, #fde68a, #f59e0b); box-shadow: 0 8px 24px rgba(252, 211, 77, .28); white-space: nowrap; }
.pv-go .play::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, .55) 50%, transparent 70%); transform: translateX(-120%); animation: pv-shine 2.8s ease-in-out infinite; }
@keyframes pv-shine { 60%, 100% { transform: translateX(120%); } }
.pv-go .play:active { transform: scale(.97); }
/* hoja */
.pv-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; max-height: 80%; overflow-y: auto; background: #141a38; border-top: 1px solid rgba(255, 255, 255, .12); border-radius: 16px 16px 0 0; padding: 16px; display: grid; gap: 10px; transform: translateY(105%); transition: transform .4s cubic-bezier(.16, 1, .3, 1); font-size: 14px; color: #c5cbe8; }
.pv-sheet.on { transform: none; }
.pv-sheet p { margin: 0; }
.pv-sheet .m b { color: #fff; }
.pv-sheet .vid { border-radius: 10px; overflow: hidden; background: #000; aspect-ratio: 16 / 9; }
.pv-sheet video { width: 100%; height: 100%; object-fit: contain; }
.pv-sheet .d { text-align: center; }
.pv-sheet .tips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pv-sheet .tip { background: #10163a; border-radius: 10px; padding: 10px 8px; display: grid; gap: 6px; justify-items: center; align-content: start; text-align: center; font-size: 12px; color: #c5cbe8; line-height: 1.3; }
.pv-sheet .tip .ta { display: block; width: 100%; max-width: 90px; }
.pv-sheet .tip .ta :deep(svg) { width: 100%; height: auto; display: block; }
.pv-sheet .ok { justify-self: stretch; border: 1px solid rgba(255, 255, 255, .12); background: #141a38; color: #fff; border-radius: 10px; padding: 11px; cursor: pointer; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 15px; }
@media (max-width: 480px) {
  .pv-prize .top { grid-template-columns: 1fr auto; }
  .pv-go .play { font-size: 19px; }
}
.pv-enter-active, .pv-leave-active { transition: opacity .2s ease; }
.pv-enter-from, .pv-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .pv, .pv-art, .pv-body > *, .pv-goal .balls i, .pv-go .play::after, .lvl .bar .gh, .pv-prize .card.reach :deep(.pcard) { animation: none !important; }
}
</style>
