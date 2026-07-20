<script>
/**
 * KNOCKOUT BRACKET (espejado, full-width)
 *
 * Renderiza la fase de eliminación estilo Mundial: mitad izquierda y mitad
 * derecha que convergen a la Final en el centro (con el trofeo). Consume el
 * objeto `playoff` de FotMob (getPlayoff / getLeagueOverview):
 *   playoff.rounds[]  → { stage: '1/16'|'1/8'|'1/4'|'1/2'|'final', matchups[] }
 *   playoff.bronzeFinal
 * Cada matchup trae drawOrder, que usamos para partir cada ronda en las dos
 * mitades del cuadro (llaves 1..N/2 → izquierda, N/2+1..N → derecha).
 *
 * Es agnóstico del torneo: usa las rondas que existan (Champions, Libertadores
 * arrancan en 1/8, etc.).
 */

const STAGE_LABEL = {
  '1/64': '64avos', '1/32': '32avos', '1/16': '16avos',
  '1/8': 'Octavos', '1/4': 'Cuartos', '1/2': 'Semifinal', 'final': 'Final',
}
const STAGE_ORDER = { '1/64': 0, '1/32': 1, '1/16': 2, '1/8': 3, '1/4': 4, '1/2': 5, 'final': 6 }

function normMatchup(mu, idx) {
  return {
    key: `${mu.stage}-${mu.drawOrder}-${idx}`,
    stage: mu.stage,
    drawOrder: mu.drawOrder,
    homeId: mu.homeTeamId,
    awayId: mu.awayTeamId,
    home: mu.homeTeam,
    away: mu.awayTeam,
    homeShort: mu.homeTeamShortName || mu.homeTeam,
    awayShort: mu.awayTeamShortName || mu.awayTeam,
    homeScore: mu.homeScore ?? null,
    awayScore: mu.awayScore ?? null,
    winner: mu.winner ?? null,
    tbd: !!(mu.tbdTeam1 || mu.tbdTeam2) || (!mu.homeTeamId && !mu.awayTeamId),
  }
}

export default {
  name: 'KnockoutBracket',
  props: {
    playoff: { type: Object, default: null },
  },
  computed: {
    stages() {
      const rounds = (this.playoff?.rounds || [])
        .filter(r => r.stage !== 'final' && Array.isArray(r.matchups) && r.matchups.length)
        .sort((a, b) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99))
      return rounds.map(r => {
        const mus = r.matchups.map(normMatchup).sort((a, b) => a.drawOrder - b.drawOrder)
        const half = Math.ceil(mus.length / 2)
        return {
          stage: r.stage,
          label: STAGE_LABEL[r.stage] || r.stage,
          left: mus.slice(0, half),
          right: mus.slice(half),
        }
      })
    },
    // Columnas izquierda: de afuera hacia adentro (16avos → semis)
    leftColumns() {
      return this.stages.map(s => ({ stage: s.stage, label: s.label, matches: s.left }))
    },
    // Columnas derecha: de adentro hacia afuera (semis → 16avos) → orden invertido
    rightColumns() {
      return this.stages.map(s => ({ stage: s.stage, label: s.label, matches: s.right })).reverse()
    },
    final() {
      const fr = (this.playoff?.rounds || []).find(r => r.stage === 'final')
      const mu = fr?.matchups?.[0]
      return mu ? normMatchup(mu, 0) : null
    },
    bronze() {
      return this.playoff?.bronzeFinal ? normMatchup(this.playoff.bronzeFinal, 0) : null
    },
    hasBracket() {
      return this.leftColumns.some(c => c.matches.length) && !!this.final
    },
  },
  methods: {
    logo(id) { return id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : '' },
    onImgError(e) { e.target.style.visibility = 'hidden' },
    isWinner(m, side) {
      if (m.winner == null) return false
      return side === 'home' ? m.winner === m.homeId : m.winner === m.awayId
    },
    isLoser(m, side) {
      if (m.winner == null) return false
      return !this.isWinner(m, side)
    },
  },
}
</script>

<template>
  <div v-if="hasBracket" class="kb-scroll pb-3">
    <div class="kb-bracket">
      <!-- MITAD IZQUIERDA: afuera → adentro -->
      <div
        v-for="(col, i) in leftColumns"
        :key="'L-' + col.stage"
        class="kb-col kb-left"
        :class="{ 'kb-outer': i === 0, 'kb-pairs': col.matches.length > 1 }"
      >
        <div class="kb-hdr">{{ col.label }}</div>
        <div class="kb-slots">
          <div v-for="m in col.matches" :key="m.key" class="kb-slot">
            <div class="kb-card" :class="{ 'kb-tbd': m.tbd }">
              <div class="kb-row" :class="{ 'kb-win': isWinner(m,'home'), 'kb-lose': isLoser(m,'home') }">
                <img :src="logo(m.homeId)" :alt="m.home" class="kb-flag" @error="onImgError" />
                <span class="kb-name">{{ m.homeShort }}</span>
                <span class="kb-score">{{ m.homeScore }}</span>
              </div>
              <div class="kb-row" :class="{ 'kb-win': isWinner(m,'away'), 'kb-lose': isLoser(m,'away') }">
                <img :src="logo(m.awayId)" :alt="m.away" class="kb-flag" @error="onImgError" />
                <span class="kb-name">{{ m.awayShort }}</span>
                <span class="kb-score">{{ m.awayScore }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CENTRO: Final + trofeo + 3er puesto -->
      <div class="kb-center">
        <div class="kb-trophy">🏆</div>
        <div class="kb-final-label">FINAL</div>
        <div v-if="final" class="kb-card kb-final" :class="{ 'kb-tbd': final.tbd }">
          <div class="kb-row" :class="{ 'kb-win': isWinner(final,'home'), 'kb-lose': isLoser(final,'home') }">
            <img :src="logo(final.homeId)" :alt="final.home" class="kb-flag" @error="onImgError" />
            <span class="kb-name">{{ final.home }}</span>
            <span class="kb-score">{{ final.homeScore }}</span>
          </div>
          <div class="kb-row" :class="{ 'kb-win': isWinner(final,'away'), 'kb-lose': isLoser(final,'away') }">
            <img :src="logo(final.awayId)" :alt="final.away" class="kb-flag" @error="onImgError" />
            <span class="kb-name">{{ final.away }}</span>
            <span class="kb-score">{{ final.awayScore }}</span>
          </div>
        </div>
        <div v-if="bronze" class="kb-bronze">
          <div class="kb-bronze-label">🥉 Tercer puesto</div>
          <div class="kb-bronze-row">
            <span :class="{ 'kb-win': isWinner(bronze,'home') }">{{ bronze.homeShort }}</span>
            <span class="kb-bronze-score">{{ bronze.homeScore }} - {{ bronze.awayScore }}</span>
            <span :class="{ 'kb-win': isWinner(bronze,'away') }">{{ bronze.awayShort }}</span>
          </div>
        </div>
      </div>

      <!-- MITAD DERECHA: adentro → afuera -->
      <div
        v-for="(col, i) in rightColumns"
        :key="'R-' + col.stage"
        class="kb-col kb-right"
        :class="{ 'kb-outer': i === rightColumns.length - 1, 'kb-pairs': col.matches.length > 1 }"
      >
        <div class="kb-hdr">{{ col.label }}</div>
        <div class="kb-slots">
          <div v-for="m in col.matches" :key="m.key" class="kb-slot">
            <div class="kb-card" :class="{ 'kb-tbd': m.tbd }">
              <div class="kb-row" :class="{ 'kb-win': isWinner(m,'home'), 'kb-lose': isLoser(m,'home') }">
                <img :src="logo(m.homeId)" :alt="m.home" class="kb-flag" @error="onImgError" />
                <span class="kb-name">{{ m.homeShort }}</span>
                <span class="kb-score">{{ m.homeScore }}</span>
              </div>
              <div class="kb-row" :class="{ 'kb-win': isWinner(m,'away'), 'kb-lose': isLoser(m,'away') }">
                <img :src="logo(m.awayId)" :alt="m.away" class="kb-flag" @error="onImgError" />
                <span class="kb-name">{{ m.awayShort }}</span>
                <span class="kb-score">{{ m.awayScore }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kb-bracket {
  --kb-line: rgba(255, 255, 255, 0.16);
  /* gap y stub responsivos: el stub es SIEMPRE la mitad del gap para que las
     líneas horizontales de columnas vecinas se encuentren en el medio. */
  --kb-gap: clamp(6px, 0.9vw, 26px);
  --kb-stub: calc(var(--kb-gap) / 2);
  display: flex;
  align-items: stretch;
  gap: var(--kb-gap);
  min-height: 460px;
  padding: 8px 2px;
  width: 100%;
}

/* Columnas: se reparten el ancho disponible → entra el bracket completo sin scroll */
.kb-col { display: flex; flex-direction: column; flex: 1 1 0; min-width: 0; }
.kb-hdr {
  height: 22px;
  text-align: center;
  font-size: clamp(8px, 0.7vw, 10px);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kb-slots { flex: 1; display: flex; flex-direction: column; }
.kb-slot { flex: 1; display: flex; align-items: center; position: relative; }

/* Tarjeta */
.kb-card {
  position: relative;
  width: 100%;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.75);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}
.kb-row {
  display: flex;
  align-items: center;
  gap: clamp(3px, 0.4vw, 6px);
  padding: clamp(3px, 0.4vw, 5px) clamp(4px, 0.5vw, 8px);
}
.kb-row + .kb-row { border-top: 1px solid rgba(255, 255, 255, 0.06); }
.kb-flag { width: clamp(13px, 1.1vw, 18px); height: clamp(13px, 1.1vw, 18px); object-fit: contain; flex: none; }
.kb-name { flex: 1; min-width: 0; font-size: clamp(10px, 0.78vw, 12px); font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kb-score { font-size: clamp(10px, 0.78vw, 12px); font-weight: 700; color: #64748b; font-variant-numeric: tabular-nums; }

/* En pantallas chicas (mobile) sí permitimos scroll horizontal con un mínimo usable */
@media (max-width: 720px) {
  .kb-scroll { overflow-x: auto; }
  .kb-bracket { width: max-content; --kb-gap: 14px; }
  .kb-col { flex: 0 0 auto; min-width: 92px; }
}
.kb-win .kb-name { color: #fff; font-weight: 800; }
.kb-win .kb-score { color: #34d399; }
.kb-lose { opacity: 0.45; }
.kb-tbd .kb-name { color: #475569; }

/* ── Conectores ─────────────────────────────────────────── */
/* Izquierda: alimenta hacia la derecha (centro) */
.kb-left .kb-slot::after {
  content: ''; position: absolute; left: 100%; top: 50%;
  width: var(--kb-stub); height: 2px; background: var(--kb-line);
}
.kb-left.kb-pairs .kb-slot:nth-child(odd)::before {
  content: ''; position: absolute; left: calc(100% + var(--kb-stub)); top: 50%;
  height: 100%; width: 2px; background: var(--kb-line);
}
.kb-left:not(.kb-outer) .kb-card::before {
  content: ''; position: absolute; right: 100%; top: 50%;
  width: var(--kb-stub); height: 2px; background: var(--kb-line);
}

/* Derecha: alimenta hacia la izquierda (centro) — espejado */
.kb-right .kb-slot::after {
  content: ''; position: absolute; right: 100%; top: 50%;
  width: var(--kb-stub); height: 2px; background: var(--kb-line);
}
.kb-right.kb-pairs .kb-slot:nth-child(odd)::before {
  content: ''; position: absolute; right: calc(100% + var(--kb-stub)); top: 50%;
  height: 100%; width: 2px; background: var(--kb-line);
}
.kb-right:not(.kb-outer) .kb-card::before {
  content: ''; position: absolute; left: 100%; top: 50%;
  width: var(--kb-stub); height: 2px; background: var(--kb-line);
}

/* ── Centro ─────────────────────────────────────────────── */
.kb-center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1.15 1 0;
  min-width: 130px;
  gap: 6px;
  padding: 0 clamp(4px, 0.6vw, 12px);
}
.kb-trophy { font-size: clamp(28px, 2.6vw, 42px); filter: drop-shadow(0 0 16px rgba(251, 191, 36, 0.35)); }
.kb-final-label {
  font-size: clamp(10px, 0.8vw, 12px); font-weight: 800; letter-spacing: 0.14em;
  color: #fbbf24; text-transform: uppercase;
}
.kb-final {
  width: 100%; max-width: 190px;
  border-color: rgba(251, 191, 36, 0.4);
  box-shadow: 0 0 24px rgba(251, 191, 36, 0.18);
}
.kb-final .kb-name { font-size: 13px; }
.kb-bronze {
  margin-top: 10px; text-align: center;
  border: 1px solid rgba(251, 191, 36, 0.18);
  background: rgba(251, 191, 36, 0.05);
  border-radius: 10px; padding: 6px 12px;
}
.kb-bronze-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(251,191,36,0.8); }
.kb-bronze-row { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-top: 2px; }
.kb-bronze-score { font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.kb-win { color: #fff; }
</style>
