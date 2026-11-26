<script>
/**
 * LA PREVIA (diseño V4 aprobado: V4Previa)
 *
 * Pantalla completa antes de arrancar el desafío:
 *  · Arriba: "JUEGO X DE N · TIPO" y cerrar.
 *  · Portada del juego con su arte, nombre y en qué consiste.
 *  · Cómo se juega en 3 tarjetas (según el tipo de juego).
 *  · Dificultad con colores: Fácil verde · Normal amarillo · Difícil rojo
 *    (pedido de Alejo) + XP máximo y los datos de esa dificultad.
 *    Recuerda la última dificultad elegida en cada juego.
 *  · Ayudas disponibles (solo en los juegos que las usan, con tu inventario real).
 *  · Cuánto te acerca al próximo nivel un partido perfecto.
 *  · ¡A LA CANCHA!
 * Misma API que antes: props open/gameName/…/gameType, emite close y start.
 */
import { ref, computed, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { GAME_TYPES } from '@/services/game-celebrations';
import { DIFFICULTY_LEVELS, getDifficultyConfig } from '@/services/games';
import { GAME_ART, GAME_POSTER_META, POSTER_RIBBONS, BALL_SVG } from '@/services/game-art';
import { captureLevelSnapshot } from '@/services/xp';
import { fetchDailyWinStreak } from '@/services/game-modes';
import { getAuthUser } from '@/services/auth';
import { POWERUP_GAME_SLUGS } from '@/services/powerups';
import { soundManager } from '@/services/sounds';
import { tap } from '@/services/haptics';
import PowerupIcon from '@/components/rewards/PowerupIcon.vue';

/** Colores por dificultad (diseño V4). */
export const DIFF_THEME = {
  easy: { solid: 'linear-gradient(180deg,#4ade80,#16a34a)', edge: '#166534', ink: '#052e16', soft: 'rgba(74,222,128,0.10)', line: 'rgba(74,222,128,0.45)', txt: '#86efac', glow: 'rgba(74,222,128,0.45)', lvl: 1 },
  normal: { solid: 'linear-gradient(180deg,#fde047,#eab308)', edge: '#a16207', ink: '#1c1206', soft: 'rgba(250,204,21,0.10)', line: 'rgba(250,204,21,0.45)', txt: '#fde047', glow: 'rgba(250,204,21,0.45)', lvl: 2 },
  hard: { solid: 'linear-gradient(180deg,#f87171,#dc2626)', edge: '#991b1b', ink: '#ffffff', soft: 'rgba(248,113,113,0.10)', line: 'rgba(248,113,113,0.45)', txt: '#fca5a5', glow: 'rgba(248,113,113,0.5)', lvl: 3 },
};

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

// Íconos de las tarjetas "cómo se juega" (trazo blanco, 24×24)
const STEP_ICON = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  type: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  tap: '<path d="M9 11V5a2 2 0 014 0v6"/><path d="M13 10a2 2 0 014 0v2a2 2 0 014 0v3a6 6 0 01-6 6h-2a6 6 0 01-5-2.7L5 15a2 2 0 013-2.6l1 1.1"/>',
  drag: '<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  heart: '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.8 1.2 5.3 3 1.5-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  link: '<rect x="2" y="8" width="11" height="8" rx="4"/><rect x="11" y="8" width="11" height="8" rx="4"/>',
  bulb: '<path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.2 1 2V17h5v-1.1c0-.8.4-1.6 1-2A6 6 0 0012 3z"/><path d="M10 21h4"/>',
  shirt: '<path d="M8 3 L4 6 L6 10 L7 9 V21 H17 V9 L18 10 L20 6 L16 3 Q12 6 8 3Z"/>',
};
const STEP_BG = ['linear-gradient(160deg,#34d399,#047857)', 'linear-gradient(160deg,#60a5fa,#1d4ed8)', 'linear-gradient(160deg,#fcd34d,#b45309)'];

function stepsFor(type, slug, cfg) {
  const T = GAME_TYPES;
  if (slug === 'guess-player') return [['eye', 'Mirá', 'La foto arranca borrosa y se aclara.'], ['tap', 'Elegí', 'Tocá el jugador que es, al toque.'], ['clock', 'Rápido', `${cfg.targetCorrect || 10} aciertos. Cuanto antes, más XP.`]];
  switch (type) {
    case T.ORDERING: return [['eye', 'Mirá', `Te damos ${cfg.itemCount || 5} jugadores mezclados.`], ['drag', 'Ordená', 'Arrastrá o tocá dos para cambiarlos.'], ['target', 'Acertá', 'Ganás con todos en su lugar.']];
    case T.LIVES: return [['search', 'Investigá', 'Pedí pistas sobre el jugador misterioso.'], ['type', 'Arriesgá', 'Escribí quién creés que es.'], ['heart', 'Cuidalas', `Tenés ${cfg.lives || 3} ${cfg.lives === 1 ? 'vida' : 'vidas'}: cada error resta una.`]];
    case T.WORDLE: return [['type', 'Escribí', 'Probá con el apellido de un jugador.'], ['eye', 'Mirá', 'Los colores te dicen qué letras van.'], ['target', 'Acertá', `Tenés ${cfg.guesses || 8} intentos.`]];
    case T.CHAIN: return [['eye', 'Compará', '¿El nuevo tiene más o menos?'], ['link', 'Encadená', 'Cada acierto suma a la cadena.'], ['target', 'Llegá', `Ganás con ${cfg.target || 12} seguidos.`]];
    case T.PUZZLE: return [['grid', 'Agrupá', 'Armá 4 grupos de 4 jugadores.'], ['bulb', 'Pensá', 'Buscá qué tienen en común.'], ['heart', 'Cuidate', `Te podés equivocar ${cfg.mistakes || 3} veces.`]];
    case T.GRID: return [['grid', 'Cruzá', 'Cada celda cruza fila y columna.'], ['type', 'Escribí', 'Poné un jugador que cumpla las dos.'], ['target', 'Llenala', `${cfg.guessesPerCell || 2} ${cfg.guessesPerCell === 1 ? 'intento' : 'intentos'} por celda.`]];
    case T.SQUAD: return [['shirt', 'Armá', 'Elegí tu once en la formación.'], ['target', 'Cumplí', 'Respetá lo que pide cada puesto.'], ['clock', 'Rápido', `Tenés ${Math.round((cfg.time || 180) / 60)} minutos.`]];
    default: return [['eye', 'Mirá', 'Te mostramos un jugador por vez.'], ['tap', 'Respondé', 'Tocá la opción correcta al toque.'], ['clock', 'Rápido', `${cfg.targetCorrect || 10} aciertos. Lo que sobra suma XP.`]];
  }
}

/** Los dos datos de la dificultad que acompañan al XP máximo. */
function statsFor(type, cfg) {
  const T = GAME_TYPES;
  const min = (s) => `${Math.round((Number(s) || 0) / 60)} min`;
  switch (type) {
    case T.ORDERING: return [['Jugadores', cfg.itemCount], ['Para ganar', 'Todos']];
    case T.LIVES: return [['Vidas', cfg.lives], ['Por acierto', `+${cfg.xpPerCorrect || 0}`]];
    case T.WORDLE: return [['Intentos', cfg.guesses], ['Jugador', '1']];
    case T.CHAIN: return [['Cadena', cfg.target], ['Por acierto', `+${cfg.xpPerCorrect || 0}`]];
    case T.PUZZLE: return [['Errores', cfg.mistakes], ['Grupos', '4']];
    case T.GRID: return [['Por celda', cfg.guessesPerCell], ['Celdas', '9']];
    case T.SQUAD: return [['Tiempo', min(cfg.time)], ['Jugadores', '11']];
    default: return [['Tiempo', `${cfg.time || 0} s`], ['Aciertos', cfg.targetCorrect || 10]];
  }
}

const HELP_ORDER = ['fifty_fifty', 'extra_time', 'shield', 'reveal_hint'];
const HELP_NAME = { fifty_fifty: '50/50', extra_time: 'Tiempo extra', shield: 'Escudo', reveal_hint: 'Pista' };
const HELP_BG = {
  fifty_fifty: ['linear-gradient(160deg,#a78bfa,#6d28d9)', '#a78bfa'],
  extra_time: ['linear-gradient(160deg,#38bdf8,#0369a1)', '#38bdf8'],
  shield: ['linear-gradient(160deg,#34d399,#047857)', '#34d399'],
  reveal_hint: ['linear-gradient(160deg,#fcd34d,#b45309)', '#fcd34d'],
};

export default {
  name: 'GamePreviewModal',
  components: { PowerupIcon },
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

    // ── Dificultad (recuerda la última elegida por juego) ──
    const storeKey = computed(() => `gl:last_difficulty:${gameSlug.value || props.gameName}`);
    function readLast() { try { return localStorage.getItem(storeKey.value) || '' } catch { return '' } }
    const selectedDifficulty = ref(Object.values(DIFFICULTY_LEVELS).includes(readLast()) ? readLast() : DIFFICULTY_LEVELS.NORMAL);
    const currentConfig = computed(() => getDifficultyConfig(props.gameType, selectedDifficulty.value));
    const diffs = computed(() => [DIFFICULTY_LEVELS.EASY, DIFFICULTY_LEVELS.NORMAL, DIFFICULTY_LEVELS.HARD].map(v => {
      const cfg = getDifficultyConfig(props.gameType, v);
      const on = v === selectedDifficulty.value;
      const c = DIFF_THEME[v];
      const pipOn = on ? c.ink : c.txt;
      const pipOff = on ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.12)';
      return {
        value: v, label: cfg.label || v, on,
        style: {
          background: on ? c.solid : c.soft, borderColor: on ? c.edge : c.line, borderBottomWidth: on ? '4px' : '2px',
          color: on ? c.ink : c.txt, boxShadow: on ? `0 6px 18px ${c.glow}` : 'none', transform: on ? 'translateY(-2px)' : 'none',
        },
        pips: [pipOn, c.lvl >= 2 ? pipOn : pipOff, c.lvl >= 3 ? pipOn : pipOff],
      };
    }));
    function pick(v) {
      if (v === selectedDifficulty.value) return;
      selectedDifficulty.value = v;
      tap();
      soundManager.play('click');
    }

    // ── Portada ──
    const meta = computed(() => GAME_POSTER_META[gameSlug.value] || { c1: '#475569', c2: '#0f172a', sub: '' });
    const ribbon = computed(() => POSTER_RIBBONS[meta.value?.type] || null);
    const art = computed(() => (GAME_ART[gameSlug.value] || '').replace(/id="(cp[a-z])"/g, 'id="pv$1"').replace(/url\(#(cp[a-z])\)/g, 'url(#pv$1)'));
    const blurb = computed(() => props.mechanic || props.gameDescription || meta.value.sub || '');

    const steps = computed(() => stepsFor(props.gameType, gameSlug.value, currentConfig.value).map(([icon, title, text], i) => ({ icon: STEP_ICON[icon], title, text, bg: STEP_BG[i % 3] })));
    const stats = computed(() => statsFor(props.gameType, currentConfig.value).map(([label, value]) => ({ label, value: value ?? '—' })));

    // ── XP en juego (animado) ──
    const maxXp = computed(() => maxXpFor(props.gameType, currentConfig.value));
    const shownMax = ref(0);
    let raf = 0;
    watch(maxXp, (to) => {
      cancelAnimationFrame(raf);
      const from = shownMax.value; const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 350); shownMax.value = Math.round(from + (to - from) * k); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, { immediate: true });

    // ── Nivel ──
    const snap = ref(null); // { level, percent, xpToNext, range }
    const reach = computed(() => !!(snap.value && snap.value.xpToNext != null && maxXp.value >= Number(snap.value.xpToNext)));
    const ghostPct = computed(() => {
      const s = snap.value; if (!s || !s.xpToNext) return 0;
      const range = Number(s.range) || Number(s.xpToNext) / Math.max(0.01, (100 - (s.percent || 0)) / 100);
      return Math.min(100, (s.percent || 0) + (maxXp.value / Math.max(1, range)) * 100);
    });
    const leftAfter = computed(() => snap.value?.xpToNext != null ? Math.max(0, Number(snap.value.xpToNext) - maxXp.value) : null);

    // ── Ayudas (inventario real; solo en los juegos que las usan) ──
    const usesHelps = computed(() => [...POWERUP_GAME_SLUGS, 'stat-challenge'].includes(gameSlug.value));
    const helps = ref([]);
    async function loadHelps() {
      if (!usesHelps.value || !getAuthUser()?.id) { helps.value = []; return }
      try {
        const { getAvailablePowerups } = await import('@/services/powerups');
        const list = await getAvailablePowerups();
        const by = Object.fromEntries(list.map(p => [p.key, p.count]));
        helps.value = HELP_ORDER.filter(k => k in by && (k !== 'reveal_hint' || by[k] > 0)).map(k => ({ key: k, name: HELP_NAME[k], count: by[k] || 0, bg: HELP_BG[k][0], ring: HELP_BG[k][1] }));
      } catch { helps.value = [] }
    }

    // ── "JUEGO X DE N" (la jornada de hoy) ──
    const jornada = ref(null); // { n, total }
    async function loadJornada() {
      jornada.value = null;
      if (!getAuthUser()?.id) return;
      try {
        const { getNextQuickPlay } = await import('@/services/quick-play');
        const lvl = snap.value?.level || 1;
        const r = await getNextQuickPlay({ level: lvl });
        if (r?.total) jornada.value = { n: Math.min(r.total, r.played + 1), total: r.total };
      } catch { jornada.value = null }
    }
    const kicker = computed(() => [jornada.value ? `JUEGO ${jornada.value.n} DE ${jornada.value.total}` : '', (ribbon.value?.label || '').toUpperCase()].filter(Boolean).join(' · '));

    // Racha del juego ANTES de jugar: el resumen la usa para la escena de la racha
    const streakBefore = ref(null);
    async function loadStreak() {
      try { streakBefore.value = gameSlug.value ? await fetchDailyWinStreak(gameSlug.value) : null } catch { streakBefore.value = null }
    }
    async function loadSnap() {
      if (!getAuthUser()?.id) { snap.value = null; return }
      try { const s = await captureLevelSnapshot(); snap.value = s?.level ? s : null } catch { snap.value = null }
    }

    // ── Video (si el juego tiene) ──
    const howOpen = ref(false);
    const introKey = ref(0);

    function startGame() {
      tap();
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
    function onKey(e) { if (e.key === 'Escape' && props.open) emit('close') }
    watch(() => props.open, (isOpen) => {
      lockBodyScroll(isOpen);
      if (typeof window !== 'undefined') window[isOpen ? 'addEventListener' : 'removeEventListener']('keydown', onKey);
      if (isOpen) {
        howOpen.value = false; introKey.value++;
        const last = readLast(); if (Object.values(DIFFICULTY_LEVELS).includes(last)) selectedDifficulty.value = last;
        loadSnap().then(loadJornada); loadStreak(); loadHelps();
      }
    }, { immediate: true });
    onUnmounted(() => { cancelAnimationFrame(raf); lockBodyScroll(false); window.removeEventListener('keydown', onKey); });

    return {
      selectedDifficulty, currentConfig, diffs, pick, startGame, meta, art, blurb, kicker, steps, stats,
      maxXp, shownMax, snap, reach, ghostPct, leftAfter, helps, usesHelps, howOpen, introKey, BALL_SVG,
    };
  },
};
</script>

<template>
  <Teleport to="body">
    <Transition name="pv">
      <div v-if="open" class="pv-wrap" @click.self="$emit('close')">
        <div :key="introKey" class="pv" role="dialog" aria-modal="true" :aria-label="`Previa de ${gameName}`" :style="{ '--c1': meta.c1, '--c2': meta.c2 }">
          <div class="pv-top">
            <span class="pv-kick">{{ kicker }}</span>
            <button type="button" class="pv-x" aria-label="Cerrar la previa" @click="$emit('close')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div class="pv-body">
            <!-- Portada -->
            <section class="pv-hero" :aria-label="gameName">
              <span v-if="art" class="pv-art" aria-hidden="true" v-html="art"></span>
              <div class="pv-hero-tx">
                <h2>{{ gameName }}</h2>
                <p v-if="blurb">{{ blurb }}</p>
              </div>
            </section>

            <!-- Cómo se juega -->
            <section class="pv-steps" aria-label="Cómo se juega">
              <div v-for="s in steps" :key="s.title" class="st">
                <span class="ic" :style="{ background: s.bg }" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" v-html="s.icon"></svg>
                </span>
                <span class="tt">{{ s.title }}</span>
                <span class="tx">{{ s.text }}</span>
              </div>
            </section>
            <button v-if="videoUrl" type="button" class="pv-video" @click="howOpen = true">Ver el video de cómo se juega</button>

            <!-- Dificultad -->
            <section class="pv-diff" aria-label="Dificultad">
              <div role="radiogroup" aria-label="Elegí la dificultad" class="dg">
                <button
                  v-for="d in diffs" :key="d.value" type="button" role="radio" :aria-checked="d.on"
                  class="db" :style="d.style" @click="pick(d.value)"
                >
                  <span class="pips" aria-hidden="true"><i v-for="(c, i) in d.pips" :key="i" :style="{ background: c }"></i></span>
                  <span class="lb">{{ d.label }}</span>
                </button>
              </div>
              <div class="ds">
                <div class="xp">
                  <span class="k">XP máximo</span>
                  <span class="v">+{{ shownMax }}</span>
                </div>
                <div v-for="s in stats" :key="s.label">
                  <span class="k">{{ s.label }}</span>
                  <span class="v">{{ s.value }}</span>
                </div>
              </div>
            </section>

            <!-- Ayudas disponibles -->
            <section v-if="usesHelps && helps.length" class="pv-helps" aria-label="Ayudas disponibles">
              <div class="hh">
                <span class="k">AYUDAS DISPONIBLES</span>
                <span class="s">las usás durante el partido</span>
              </div>
              <div class="hg" :class="{ four: helps.length > 3 }" :style="{ '--n': helps.length }">
                <div v-for="h in helps" :key="h.key" class="hp" :class="{ none: !h.count }">
                  <span class="hi" :style="{ background: h.bg }">
                    <PowerupIcon :type="h.key" :size="22" class="text-white" />
                    <b :style="{ borderColor: h.ring }">×{{ h.count }}</b>
                  </span>
                  <span class="hn">{{ h.name }}</span>
                </div>
              </div>
            </section>

            <!-- Tu nivel si ganás -->
            <section v-if="snap" class="pv-lvl" aria-label="Tu nivel si ganás">
              <div class="lr">
                <span class="nv">NV {{ snap.level }}</span>
                <span class="bar">
                  <i class="gh" :style="{ width: ghostPct + '%' }"></i>
                  <i class="cur" :style="{ width: (snap.percent || 0) + '%' }"></i>
                </span>
                <span class="nx" :class="{ up: reach }">{{ snap.level + 1 }}</span>
              </div>
              <p>
                <template v-if="reach">Si la ganás perfecta <strong>subís al Nv {{ snap.level + 1 }}</strong>.</template>
                <template v-else-if="leftAfter != null">Si la ganás perfecta quedás a <strong>{{ leftAfter.toLocaleString('es-AR') }} XP</strong> del Nv {{ snap.level + 1 }}.</template>
              </p>
            </section>
          </div>

          <div class="pv-go">
            <button type="button" class="go" @click="startGame">
              <span class="ball" aria-hidden="true" v-html="BALL_SVG"></span>¡A LA CANCHA!
            </button>
          </div>

          <!-- Video -->
          <div v-if="videoUrl" class="pv-sheet" :class="{ on: howOpen }" :aria-hidden="!howOpen">
            <div class="vid"><video v-if="howOpen" :src="videoUrl" controls preload="metadata"></video></div>
            <button type="button" class="ok" @click="howOpen = false">Entendido</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pv-wrap { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(3, 5, 14, .82); }
.pv { --c1: #10b981; --c2: #064e3b; position: relative; width: min(100%, 430px); height: min(100dvh, 900px); display: flex; flex-direction: column; overflow: hidden; color: #f1f5f9;
  background: radial-gradient(110% 45% at 50% 0%, color-mix(in srgb, var(--c1) 38%, transparent), transparent 72%), #0b1220; animation: pv-in .45s cubic-bezier(.16, 1, .3, 1) both; }
@media (min-width: 560px) { .pv { border-radius: 24px; border: 1px solid rgba(255, 255, 255, .1); box-shadow: 0 30px 80px rgba(0, 0, 0, .6); height: min(calc(100dvh - 32px), 860px); } }
@keyframes pv-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }

.pv-top { flex: none; height: 56px; box-sizing: content-box; padding: env(safe-area-inset-top, 0px) 6px 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pv-kick { min-width: 0; padding: 4px 10px; border-radius: 999px; background: rgba(0, 0, 0, .3); border: 1px solid rgba(255, 255, 255, .12); font-family: var(--font-bug); font-weight: 800; font-size: 13px; letter-spacing: 1px; color: color-mix(in srgb, var(--c1) 45%, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pv-kick:empty { visibility: hidden; }
.pv-x { width: 44px; height: 44px; flex: none; border-radius: 50%; border: 0; background: rgba(0, 0, 0, .3); color: #fff; display: grid; place-items: center; cursor: pointer; }

.pv-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.pv-body > * { animation: pv-row .4s cubic-bezier(.16, 1, .3, 1) both; }
.pv-body > *:nth-child(2) { animation-delay: .06s; } .pv-body > *:nth-child(3) { animation-delay: .12s; } .pv-body > *:nth-child(4) { animation-delay: .18s; } .pv-body > *:nth-child(5) { animation-delay: .24s; }
@keyframes pv-row { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* portada */
.pv-hero { position: relative; flex: none; height: 196px; border-radius: 20px; overflow: hidden;
  background: radial-gradient(70% 70% at 62% 40%, color-mix(in srgb, var(--c1) 55%, transparent) 0%, transparent 72%), linear-gradient(160deg, var(--c1) 0%, var(--c2) 62%, #050716 100%);
  border: 1px solid color-mix(in srgb, var(--c1) 50%, transparent); box-shadow: 0 14px 40px color-mix(in srgb, var(--c1) 25%, transparent); }
.pv-art { position: absolute; right: -6px; top: 6px; width: 230px; aspect-ratio: 200 / 170; animation: pv-float 3.2s ease-in-out infinite; }
.pv-art :deep(svg) { width: 100%; height: 100%; display: block; }
@keyframes pv-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.pv-hero-tx { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 16px 14px; background: linear-gradient(180deg, transparent, rgba(2, 6, 23, .85)); }
.pv-hero-tx h2 { margin: 0; max-width: 70%; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 36px; line-height: .92; text-transform: uppercase; text-shadow: 0 2px 0 rgba(0, 0, 0, .35); text-wrap: balance; }
.pv-hero-tx p { margin: 5px 0 0; font-size: 13px; font-weight: 600; line-height: 1.3; color: color-mix(in srgb, var(--c1) 35%, #fff); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* cómo se juega */
.pv-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.st { border-radius: 14px; padding: 10px 8px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .08); display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.st .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; }
.st .tt { font-family: var(--font-bug); font-weight: 800; font-size: 15px; line-height: 1; text-transform: uppercase; }
.st .tx { font-size: 11px; line-height: 1.3; color: #94a3b8; }
.pv-video { align-self: center; min-height: 44px; padding: 0 12px; border: 0; background: none; color: #fbbf24; font-weight: 700; font-size: 13px; cursor: pointer; }

/* dificultad */
.pv-diff { display: flex; flex-direction: column; gap: 8px; }
.dg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.db { position: relative; min-height: 56px; box-sizing: border-box; border-radius: 14px; border: 2px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease, background .15s; -webkit-tap-highlight-color: transparent; }
.db .pips { display: flex; gap: 3px; }
.db .pips i { width: 14px; height: 5px; border-radius: 3px; display: block; }
.db .lb { font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 19px; line-height: 1; letter-spacing: .5px; text-transform: uppercase; }
.ds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.ds > div { border-radius: 12px; padding: 8px 10px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .08); display: flex; flex-direction: column; min-width: 0; }
.ds > div.xp { background: rgba(251, 191, 36, .08); border-color: rgba(251, 191, 36, .3); }
.ds .k { font-size: 10.5px; font-weight: 700; color: #94a3b8; white-space: nowrap; }
.ds .v { font-family: var(--font-bug); font-weight: 800; font-size: 22px; line-height: 1.05; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ds .xp .v { color: #fde68a; }

/* ayudas */
.pv-helps { border-radius: 16px; padding: 10px 12px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .08); display: flex; flex-direction: column; gap: 8px; }
.hh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.hh .k { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; color: #94a3b8; }
.hh .s { font-size: 11px; color: #64748b; }
.hg { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
.hp { display: flex; align-items: center; gap: 8px; min-width: 0; }
.hp.none { opacity: .45; }
.hi { position: relative; width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35); display: grid; place-items: center; color: #fff; }
.hi b { position: absolute; right: -6px; bottom: -5px; padding: 0 4px; border-radius: 6px; background: #0b1220; border: 1.5px solid; font-family: var(--font-bug); font-weight: 800; font-size: 12px; line-height: 15px; color: #fff; }
.hn { min-width: 0; font-family: var(--font-bug); font-weight: 800; font-size: 14px; line-height: 1.05; text-transform: uppercase; }
.hg.four .hp { flex-direction: column; gap: 6px; }
.hg.four .hn { font-size: 12.5px; text-align: center; }

/* nivel */
.pv-lvl { display: flex; flex-direction: column; gap: 6px; }
.lr { display: flex; align-items: center; gap: 8px; }
.lr .nv { height: 26px; padding: 0 8px; border-radius: 8px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1.5px solid #c7d2fe; display: flex; align-items: center; font-family: var(--font-bug); font-weight: 800; font-size: 15px; white-space: nowrap; }
.lr .bar { position: relative; flex: 1; height: 14px; border-radius: 999px; background: rgba(255, 255, 255, .08); overflow: hidden; display: block; }
.lr .bar i { position: absolute; left: 0; top: 0; bottom: 0; display: block; transition: width .5s cubic-bezier(.16, 1, .3, 1); }
.lr .bar .gh { background: repeating-linear-gradient(135deg, rgba(253, 230, 138, .85) 0 5px, rgba(251, 191, 36, .55) 5px 10px); animation: pv-ghost 1.6s ease-in-out infinite; }
.lr .bar .cur { background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); }
@keyframes pv-ghost { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
.lr .nx { font-family: var(--font-bug); font-weight: 800; font-size: 15px; color: #64748b; }
.lr .nx.up { color: #4ade80; }
.pv-lvl p { margin: 0; font-size: 12.5px; color: #cbd5e1; }
.pv-lvl strong { color: #fde68a; }

/* botón */
.pv-go { flex: none; padding: 8px 14px calc(20px + env(safe-area-inset-bottom, 0px)); }
.go { width: 100%; min-height: 60px; border: 0; border-radius: 16px; background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%); border-bottom: 4px solid #b45309; color: #1c1206; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 28px; letter-spacing: 1px; cursor: pointer; animation: pv-pulse 2s ease-in-out infinite; -webkit-tap-highlight-color: transparent; }
.go:active { transform: translateY(2px); border-bottom-width: 2px; }
.go .ball { width: 26px; height: 26px; display: block; }
.go .ball :deep(svg) { width: 100%; height: 100%; display: block; }
@keyframes pv-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, .45); } 50% { box-shadow: 0 0 0 9px rgba(251, 191, 36, 0); } }

/* video */
.pv-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; background: #141a38; border-top: 1px solid rgba(255, 255, 255, .12); border-radius: 16px 16px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 10px; transform: translateY(105%); transition: transform .4s cubic-bezier(.16, 1, .3, 1); }
.pv-sheet.on { transform: none; }
.pv-sheet .vid { border-radius: 10px; overflow: hidden; background: #000; aspect-ratio: 16 / 9; }
.pv-sheet video { width: 100%; height: 100%; object-fit: contain; }
.pv-sheet .ok { min-height: 48px; border: 1px solid rgba(255, 255, 255, .12); background: #0b1220; color: #fff; border-radius: 12px; cursor: pointer; font-family: var(--font-bug); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 15px; }

.pv-enter-active, .pv-leave-active { transition: opacity .2s ease; }
.pv-enter-from, .pv-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .pv, .pv-art, .pv-body > *, .go, .lr .bar .gh { animation: none !important; }
  .db, .lr .bar i, .pv-sheet { transition: none; }
}
</style>
