<template>
  <div class="world-cup-page py-8 px-4">
    <div class="container mx-auto max-w-7xl">
      <!-- Header -->
      <div class="league-header mb-6">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-400/30 flex items-center justify-center text-3xl">
            🏆
          </div>
          <div>
            <h1 class="text-3xl font-bold text-white mb-0">Copa del Mundo 2026</h1>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <p class="text-cyan-400 text-sm font-medium mb-0">FIFA World Cup — USA, Canadá, México</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-20">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        <p class="mt-4 text-slate-300">Cargando datos del Mundial...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="rounded-xl bg-red-900/20 border border-red-500/30 p-4 text-red-300">
        {{ error }}
      </div>

      <!-- Content -->
      <div v-else class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Tabla de Posiciones / Grupos -->
        <div class="xl:col-span-2">
          <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
            <div class="bg-gradient-to-r from-cyan-900/30 to-cyan-800/20 border-b border-white/10 px-6 py-4">
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                🏆 Tabla de Posiciones
              </h2>
            </div>

            <!-- Multiple group tables (World Cup format) -->
            <template v-if="leagueData?.table?.tables?.length">
              <div v-for="group in leagueData.table.tables" :key="group.name" class="border-b border-white/10 last:border-b-0">
                <div class="px-6 py-2.5 bg-slate-800/40">
                  <span class="text-sm font-bold text-cyan-300">{{ group.name }}</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="border-b border-white/10">
                        <th class="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12"></th>
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
                        <th class="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Selección</th>
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-slate-400 uppercase w-10">PJ</th>
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-slate-400 uppercase w-10">G</th>
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-slate-400 uppercase w-10">E</th>
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-slate-400 uppercase w-10">P</th>
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-slate-400 uppercase w-10">DG</th>
                        <th class="text-center py-2.5 px-2 text-xs font-semibold text-cyan-400 uppercase w-12 font-bold">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="team in group.teams"
                        :key="team.id"
                        class="border-b border-white/5 hover:bg-white/5 transition-colors group"
                      >
                        <td class="py-2 px-4">
                          <div class="w-1 h-5 rounded-full" :style="{ backgroundColor: team.qualColor || 'transparent' }"></div>
                        </td>
                        <td class="text-center py-2 px-2 text-slate-300 font-semibold text-sm">{{ team.idx }}</td>
                        <td class="py-2 px-4">
                          <router-link :to="`/team/${team.id}`" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <img
                              :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${team.id}.png`"
                              :alt="team.name" class="w-6 h-6 object-contain flex-shrink-0"
                              @error="handleImageError"
                            />
                            <span class="font-medium text-white text-sm truncate group-hover:text-cyan-300 transition-colors">{{ team.name }}</span>
                          </router-link>
                        </td>
                        <td class="text-center py-2 px-2 text-slate-400 text-xs">{{ team.played }}</td>
                        <td class="text-center py-2 px-2 text-slate-300 text-xs">{{ team.wins }}</td>
                        <td class="text-center py-2 px-2 text-slate-300 text-xs">{{ team.draws }}</td>
                        <td class="text-center py-2 px-2 text-slate-300 text-xs">{{ team.losses }}</td>
                        <td class="text-center py-2 px-2 text-xs font-semibold">
                          <span :class="team.goalConDiff > 0 ? 'text-green-400' : team.goalConDiff < 0 ? 'text-red-400' : 'text-slate-400'">
                            {{ team.goalConDiff > 0 ? '+' : '' }}{{ team.goalConDiff }}
                          </span>
                        </td>
                        <td class="text-center py-2 px-2 text-white font-bold text-sm">{{ team.pts }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- Single table fallback -->
            <template v-else-if="leagueData?.table?.table?.length">
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-white/10">
                      <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase w-12"></th>
                      <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase w-12">#</th>
                      <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Selección</th>
                      <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase w-12">PJ</th>
                      <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase w-12">G</th>
                      <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase w-12">E</th>
                      <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase w-12">P</th>
                      <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase w-12">DG</th>
                      <th class="text-center py-3 px-2 text-xs font-semibold text-cyan-400 uppercase w-16 font-bold">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="team in leagueData.table.table"
                      :key="team.id"
                      class="border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      <td class="py-2.5 px-4">
                        <div class="w-1 h-6 rounded-full" :style="{ backgroundColor: team.qualColor || 'transparent' }"></div>
                      </td>
                      <td class="text-center py-2.5 px-2 text-slate-300 font-semibold text-sm">{{ team.idx }}</td>
                      <td class="py-2.5 px-4">
                        <router-link :to="`/team/${team.id}`" class="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                          <img
                            :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${team.id}.png`"
                            :alt="team.name" class="w-6 h-6 object-contain flex-shrink-0"
                            @error="handleImageError"
                          />
                          <span class="font-medium text-white text-sm truncate max-w-[180px] group-hover:text-cyan-300 transition-colors">{{ team.name }}</span>
                        </router-link>
                      </td>
                      <td class="text-center py-2.5 px-2 text-slate-400 text-xs">{{ team.played }}</td>
                      <td class="text-center py-2.5 px-2 text-slate-300 text-xs">{{ team.wins }}</td>
                      <td class="text-center py-2.5 px-2 text-slate-300 text-xs">{{ team.draws }}</td>
                      <td class="text-center py-2.5 px-2 text-slate-300 text-xs">{{ team.losses }}</td>
                      <td class="text-center py-2.5 px-2 text-xs font-semibold">
                        <span :class="team.goalConDiff > 0 ? 'text-green-400' : team.goalConDiff < 0 ? 'text-red-400' : 'text-slate-400'">
                          {{ team.goalConDiff > 0 ? '+' : '' }}{{ team.goalConDiff }}
                        </span>
                      </td>
                      <td class="text-center py-2.5 px-2 text-white font-bold text-sm">{{ team.pts }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <div v-else class="text-slate-400 text-center py-12 text-sm">
              <span class="text-4xl block mb-3">⚽</span>
              Las tablas se actualizan cuando comienza la fase de grupos
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="xl:col-span-1 space-y-6">
          <!-- Partidos -->
          <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
            <div class="bg-slate-800/60 border-b border-white/10 px-5 py-3">
              <div class="flex items-center justify-center gap-2 relative">
                <button @click="previousRound" :disabled="currentRoundIndex <= 0"
                  class="w-7 h-7 rounded-md flex items-center justify-center bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                  <svg width="14" height="15" viewBox="0 0 14 15" fill="none"><polygon fill="currentColor" transform="translate(6.776500, 7.523500) rotate(180) translate(-6.776500, -7.523500)" points="9.554 7.523 5.448 2.693 4.12 3.659 6.656 7.523 3.999 11.388 5.448 12.354 9.554 7.524"></polygon></svg>
                </button>
                <span class="text-sm font-bold text-white min-w-[120px] text-center">{{ currentRoundName }}</span>
                <button @click="nextRound" :disabled="currentRoundIndex >= availableRounds.length - 1"
                  class="w-7 h-7 rounded-md flex items-center justify-center bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                  <svg width="14" height="15" viewBox="0 0 14 15" fill="none"><polygon fill="currentColor" points="9.554 7.523 5.448 2.693 4.12 3.659 6.656 7.523 3.999 11.388 5.448 12.354 9.554 7.524"></polygon></svg>
                </button>
              </div>
            </div>
            <div class="p-0">
              <div v-if="groupedMatchesByDate && Object.keys(groupedMatchesByDate).length">
                <div v-for="(matches, date) in groupedMatchesByDate" :key="date">
                  <div class="px-4 py-1.5 bg-slate-800/50 border-b border-white/5">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{{ date }}</span>
                  </div>
                  <div v-for="(match, idx) in matches" :key="idx" class="border-b border-white/5 hover:bg-white/5 transition-colors py-2">
                    <div class="px-4 flex items-center justify-between gap-2">
                      <router-link :to="`/team/${match.homeTeamId}`" class="flex items-center gap-2 flex-1 justify-end min-w-0 hover:opacity-80 transition-opacity">
                        <span class="font-medium text-white text-xs text-right truncate">{{ match.homeTeam }}</span>
                        <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.homeTeamId}.png`" :alt="match.homeTeam" class="w-5 h-5 object-contain flex-shrink-0" @error="handleImageError" />
                      </router-link>
                      <div class="flex-shrink-0 text-center min-w-[50px]">
                        <div v-if="match.status.finished" class="text-[10px] font-bold text-white">{{ match.status.score }}</div>
                        <div v-else-if="match.status.started" class="flex flex-col items-center gap-0.5">
                          <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">VIVO</span>
                          <span class="text-[10px] font-bold text-white">{{ match.status.score }}</span>
                        </div>
                        <div v-else class="text-[10px] text-slate-400 font-semibold">{{ formatMatchTime(match.time) }}</div>
                      </div>
                      <router-link :to="`/team/${match.awayTeamId}`" class="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                        <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.awayTeamId}.png`" :alt="match.awayTeam" class="w-5 h-5 object-contain flex-shrink-0" @error="handleImageError" />
                        <span class="font-medium text-white text-xs truncate">{{ match.awayTeam }}</span>
                      </router-link>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-slate-400 text-center py-8 text-sm">No hay partidos en esta ronda</div>
            </div>
          </div>

          <!-- Goleadores -->
          <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
            <div class="bg-gradient-to-r from-cyan-900/30 to-cyan-800/20 border-b border-white/10 px-5 py-3.5">
              <h3 class="text-base font-bold text-white flex items-center gap-2">⚽ Top Goleadores</h3>
            </div>
            <div v-if="leagueData?.topScorers?.length">
              <div v-for="(player, idx) in leagueData.topScorers" :key="idx" class="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors group">
                <div class="text-slate-500 font-bold text-sm w-6">{{ idx + 1 }}</div>
                <img v-if="player.teamId" :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${player.teamId}.png`" :alt="player.teamName" class="w-6 h-6 object-contain" @error="handleImageError" />
                <div class="flex-grow min-w-0">
                  <div class="font-semibold text-white text-sm truncate group-hover:text-cyan-300 transition-colors">{{ player.name }}</div>
                  <div class="text-xs text-slate-400 truncate">{{ player.teamName }}</div>
                </div>
                <div class="text-lg font-bold text-cyan-400">{{ player.goals }}</div>
              </div>
            </div>
            <div v-else class="text-slate-400 text-center py-8 text-sm">Los goleadores se actualizan durante el torneo</div>
          </div>

          <!-- Asistidores -->
          <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
            <div class="bg-gradient-to-r from-cyan-900/30 to-blue-900/20 border-b border-white/10 px-5 py-3.5">
              <h3 class="text-base font-bold text-white flex items-center gap-2">🎯 Top Asistidores</h3>
            </div>
            <div v-if="leagueData?.topAssists?.length">
              <div v-for="(player, idx) in leagueData.topAssists" :key="idx" class="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors group">
                <div class="text-slate-500 font-bold text-sm w-6">{{ idx + 1 }}</div>
                <img v-if="player.teamId" :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${player.teamId}.png`" :alt="player.teamName" class="w-6 h-6 object-contain" @error="handleImageError" />
                <div class="flex-grow min-w-0">
                  <div class="font-semibold text-white text-sm truncate group-hover:text-cyan-300 transition-colors">{{ player.name }}</div>
                  <div class="text-xs text-slate-400 truncate">{{ player.teamName }}</div>
                </div>
                <div class="text-lg font-bold text-cyan-400">{{ player.assists }}</div>
              </div>
            </div>
            <div v-else class="text-slate-400 text-center py-8 text-sm">Las asistencias se actualizan durante el torneo</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { getLeagueOverview, LEAGUES } from '@/services/fotmob.js';

export default {
  name: 'WorldCup',
  setup() {
    const leagueData = ref(null);
    const loading = ref(true);
    const error = ref(null);
    const currentRoundIndex = ref(0);

    const loadLeagueData = async ({ silent = false } = {}) => {
      try {
        if (!silent || !leagueData.value) loading.value = true;
        error.value = null;
        const data = await getLeagueOverview(LEAGUES.WORLD_CUP.id);
        leagueData.value = data;
        if (data.allMatches) {
          const rounds = [...new Set(data.allMatches.map(m => m.round))].sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numA - numB;
          });
          const currentIdx = rounds.findIndex(round => {
            const roundMatches = data.allMatches.filter(m => m.round === round);
            return roundMatches.some(m => !m.status.finished);
          });
          if (currentIdx !== -1) currentRoundIndex.value = currentIdx;
        }
      } catch (err) {
        console.error('Error loading World Cup data:', err);
        error.value = 'Error al cargar los datos del Mundial. Intentá de nuevo más tarde.';
      } finally {
        loading.value = false;
      }
    };

    const availableRounds = computed(() => {
      if (!leagueData.value?.allMatches) return [];
      return [...new Set(leagueData.value.allMatches.map(m => m.round))].sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
      });
    });

    const currentRoundName = computed(() => {
      const rounds = availableRounds.value;
      if (!rounds.length) return '';
      const round = rounds[currentRoundIndex.value];
      const num = parseInt(round);
      if (!isNaN(num)) return `Jornada ${num}`;
      return round;
    });

    const currentRoundMatches = computed(() => {
      if (!leagueData.value?.allMatches) return [];
      const rounds = availableRounds.value;
      if (!rounds.length) return [];
      const currentRound = rounds[currentRoundIndex.value];
      return leagueData.value.allMatches
        .filter(m => m.round === currentRound)
        .sort((a, b) => new Date(a.time) - new Date(b.time));
    });

    const groupedMatchesByDate = computed(() => {
      const matches = currentRoundMatches.value;
      if (!matches.length) return {};
      const groups = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      matches.forEach(match => {
        const matchDate = new Date(match.time);
        matchDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((matchDate - today) / (1000 * 60 * 60 * 24));
        let dateLabel;
        if (diffDays === 0) dateLabel = 'Hoy';
        else if (diffDays === 1) dateLabel = 'Mañana';
        else if (diffDays === -1) dateLabel = 'Ayer';
        else dateLabel = new Date(match.time).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        if (!groups[dateLabel]) groups[dateLabel] = [];
        groups[dateLabel].push(match);
      });
      return groups;
    });

    const previousRound = () => { if (currentRoundIndex.value > 0) currentRoundIndex.value--; };
    const nextRound = () => { if (currentRoundIndex.value < availableRounds.value.length - 1) currentRoundIndex.value++; };
    const formatMatchTime = (dateStr) => new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const handleImageError = (e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23ddd"/></svg>'; };

    let refreshInterval = null;
    onMounted(() => {
      loadLeagueData();
      refreshInterval = setInterval(() => loadLeagueData({ silent: true }), 30000);
    });
    onBeforeUnmount(() => { if (refreshInterval) clearInterval(refreshInterval); });

    return {
      leagueData, loading, error, currentRoundIndex, availableRounds, currentRoundName,
      groupedMatchesByDate, previousRound, nextRound, formatMatchTime, handleImageError
    };
  }
};
</script>

<style scoped>
.world-cup-page { min-height: 100vh; }
@media (max-width: 768px) {
  .world-cup-page { padding: 1rem 0.75rem; }
  h1 { font-size: 1.5rem !important; }
}
</style>
