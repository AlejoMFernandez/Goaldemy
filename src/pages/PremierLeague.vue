<template>
  <div class="premier-league-page py-8 px-4">
    <div class="container mx-auto max-w-7xl">
      <!-- Header -->
      <div class="league-header mb-6">
        <div class="flex items-center gap-3">
          <img 
            src="https://images.fotmob.com/image_resources/logo/leaguelogo/dark/47.png" 
            alt="Premier League"
            class="league-logo"
          />
          <div>
            <h1 class="text-3xl font-bold text-white mb-0">Premier League</h1>
            <p class="text-slate-400 text-sm mb-0">England</p>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-20">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        <p class="mt-4 text-slate-300">Cargando datos de la Premier League...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="rounded-xl bg-red-900/20 border border-red-500/30 p-4 text-red-300">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ error }}
      </div>

      <!-- Content -->
      <div v-else class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- Tabla de Posiciones -->
      <div class="xl:col-span-2">
        <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
          <div class="bg-slate-800/50 border-b border-white/10 px-6 py-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <i class="bi bi-trophy-fill text-slate-400"></i>
                Tabla de Posiciones
              </h2>
              <div class="flex gap-2">
                <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors">
                  Overview
                </button>
              </div>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-white/10">
                  <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12"></th>
                  <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">#</th>
                  <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Equipo</th>
                  <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">PJ</th>
                  <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">G</th>
                  <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">E</th>
                  <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">P</th>
                  <th class="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-20">+/-</th>
                  <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">DG</th>
                  <th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">PTS</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Form</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="team in leagueData?.table?.table || []" 
                  :key="team.id"
                  class="border-b border-white/5 hover:bg-white/5 transition-colors group"
                >
                  <td class="py-2.5 px-4">
                    <div 
                      class="w-1 h-6 rounded-full" 
                      :style="{ backgroundColor: team.qualColor || 'transparent' }"
                    ></div>
                  </td>
                  <td class="text-center py-2.5 px-2 text-slate-300 font-semibold text-sm">{{ team.idx }}</td>
                  <td class="py-2.5 px-4">
                    <router-link :to="`/team/${team.id}`" class="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                      <img 
                        :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${team.id}.png`"
                        :alt="team.name"
                        class="w-6 h-6 object-contain flex-shrink-0"
                        @error="handleImageError"
                      />
                      <span class="font-medium text-white text-sm truncate max-w-[180px] group-hover:text-purple-300 transition-colors">{{ team.name }}</span>
                    </router-link>
                  </td>
                  <td class="text-center py-2.5 px-2 text-slate-400 text-xs">{{ team.played }}</td>
                  <td class="text-center py-2.5 px-2 text-slate-300 text-xs">{{ team.wins }}</td>
                  <td class="text-center py-2.5 px-2 text-slate-300 text-xs">{{ team.draws }}</td>
                  <td class="text-center py-2.5 px-2 text-slate-300 text-xs">{{ team.losses }}</td>
                  <td class="text-center py-2.5 px-3 text-slate-300 text-xs">{{ team.scoresStr }}</td>
                  <td class="text-center py-2.5 px-2 text-xs font-semibold">
                    <span :class="team.goalConDiff > 0 ? 'text-green-400' : team.goalConDiff < 0 ? 'text-red-400' : 'text-slate-400'">
                      {{ team.goalConDiff > 0 ? '+' : '' }}{{ team.goalConDiff }}
                    </span>
                  </td>
                  <td class="text-center py-2.5 px-2 text-white font-bold text-sm">{{ team.pts }}</td>
                  <td class="text-center py-2.5 px-4">
                    <div class="flex gap-0.5 justify-center">
                      <span 
                        v-for="(form, idx) in (team.form || []).slice(0, 5)" 
                        :key="idx"
                        :class="getFormClass(form)"
                        class="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white"
                      >
                        {{ form }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Legend -->
          <div class="bg-slate-800/50 border-t border-white/10 px-6 py-4">
            <div class="flex flex-wrap gap-4 text-xs">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background: #2AD572"></div>
                <span class="text-slate-400">Champions League</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background: #0050CC"></div>
                <span class="text-slate-400">Europa League</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background: #FF3B69"></div>
                <span class="text-slate-400">Descenso</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar con Stats -->
      <div class="xl:col-span-1 space-y-6">
        <!-- Próximos Partidos -->
        <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
          <div class="bg-slate-800/60 border-b border-white/10 px-5 py-3">
            <div class="flex items-center justify-center gap-2 relative">
              <button 
                @click="previousRound" 
                :disabled="currentRoundIndex <= 0"
                class="w-7 h-7 rounded-md flex items-center justify-center bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polygon fill="currentColor" fill-rule="nonzero" transform="translate(6.776500, 7.523500) rotate(180.000000) translate(-6.776500, -7.523500)" points="9.554 7.523 5.448 2.693 4.12 3.659 6.656 7.523 3.999 11.388 5.448 12.354 9.554 7.524"></polygon>
                </svg>
              </button>
              <div class="relative">
                <button 
                  @click="toggleRoundDropdown"
                  class="text-sm font-bold text-white min-w-[90px] text-center hover:text-purple-300 transition-colors flex items-center justify-center gap-1"
                >
                  {{ currentRoundName }}
                  <i class="bi bi-chevron-down text-xs" :class="{ 'rotate-180': showRoundDropdown }"></i>
                </button>
                <div 
                  v-if="showRoundDropdown"
                  class="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-slate-800 border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 min-w-[120px] max-h-[300px] overflow-y-auto"
                >
                  <button
                    v-for="(round, index) in availableRounds"
                    :key="round"
                    @click="selectRound(index)"
                    class="w-full px-4 py-2 text-sm text-left hover:bg-slate-700 transition-colors"
                    :class="index === currentRoundIndex ? 'bg-slate-700 text-purple-300 font-bold' : 'text-slate-300'"
                  >
                    Jornada {{ round }}
                  </button>
                </div>
              </div>
              <button 
                @click="nextRound" 
                :disabled="currentRoundIndex >= availableRounds.length - 1"
                class="w-7 h-7 rounded-md flex items-center justify-center bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polygon fill="currentColor" fill-rule="nonzero" points="9.554 7.523 5.448 2.693 4.12 3.659 6.656 7.523 3.999 11.388 5.448 12.354 9.554 7.524"></polygon>
                </svg>
              </button>
            </div>
          </div>
          <div class="p-0">
            <div v-if="groupedMatchesByDate && Object.keys(groupedMatchesByDate).length">
              <div v-for="(matches, date) in groupedMatchesByDate" :key="date">
                <div class="px-4 py-1.5 bg-slate-800/50 border-b border-white/5">
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{{ date }}</span>
                </div>
                <div 
                  v-for="(match, idx) in matches" 
                  :key="idx"
                  class="border-b border-white/5 hover:bg-white/5 transition-colors py-2"
                >
                <div class="px-4 flex items-center justify-between gap-2">
                  <router-link :to="`/team/${match.homeTeamId}`" class="flex items-center gap-2 flex-1 justify-end min-w-0 hover:opacity-80 transition-opacity">
                    <span class="font-medium text-white text-xs text-right truncate">{{ match.homeTeam }}</span>
                    <img 
                      :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.homeTeamId}.png`"
                      :alt="match.homeTeam"
                      class="w-5 h-5 object-contain flex-shrink-0"
                      @error="handleImageError"
                    />
                  </router-link>
                  <div class="flex-shrink-0 text-center min-w-[50px]">
                    <div v-if="match.status.finished" class="text-[10px] font-bold text-white">
                      {{ match.status.score }}
                    </div>
                    <div v-else-if="match.status.started" class="flex flex-col items-center gap-0.5">
                      <span class="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
                      <span class="text-[10px] font-bold text-white">{{ match.status.score }}</span>
                    </div>
                    <div v-else class="text-[10px] text-slate-400 font-semibold">
                      {{ formatMatchTime(match.time) }}
                    </div>
                  </div>
                  <router-link :to="`/team/${match.awayTeamId}`" class="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    <img 
                      :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.awayTeamId}.png`"
                      :alt="match.awayTeam"
                      class="w-5 h-5 object-contain flex-shrink-0"
                      @error="handleImageError"
                    />
                    <span class="font-medium text-white text-xs truncate">{{ match.awayTeam }}</span>
                  </router-link>
                </div>
                </div>
              </div>
            </div>
            <div v-else class="text-slate-400 text-center py-8 text-sm">
              No hay partidos en esta jornada
            </div>
          </div>
        </div>

        <!-- Goleadores -->
        <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-b border-white/10 px-5 py-3.5">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i class="bi bi-lightning-charge-fill text-green-400"></i>
              Top Goleadores
            </h3>
          </div>
          <div class="p-0">
            <div v-if="leagueData?.topScorers?.length">
              <div 
                v-for="(player, idx) in leagueData.topScorers" 
                :key="idx"
                class="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors group"
              >
                <div class="text-slate-500 font-bold text-sm w-6">{{ idx + 1 }}</div>
                <img 
                  v-if="player.teamId"
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${player.teamId}.png`"
                  :alt="player.teamName"
                  class="w-6 h-6 object-contain"
                  @error="handleImageError"
                />
                <div class="flex-grow min-w-0">
                  <div class="font-semibold text-white text-sm truncate group-hover:text-purple-300 transition-colors">{{ player.name }}</div>
                  <div class="text-xs text-slate-400 truncate">{{ player.teamName }}</div>
                </div>
                <div class="text-lg font-bold text-green-400">{{ player.goals }}</div>
              </div>
            </div>
            <div v-else class="text-slate-400 text-center py-8 text-sm">
              No hay datos disponibles
            </div>
          </div>
        </div>

        <!-- Asistidores -->
        <div class="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border-b border-white/10 px-5 py-3.5">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i class="bi bi-bullseye text-blue-400"></i>
              Top Asistidores
            </h3>
          </div>
          <div class="p-0">
            <div v-if="leagueData?.topAssists?.length">
              <div 
                v-for="(player, idx) in leagueData.topAssists" 
                :key="idx"
                class="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors group"
              >
                <div class="text-slate-500 font-bold text-sm w-6">{{ idx + 1 }}</div>
                <img 
                  v-if="player.teamId"
                  :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${player.teamId}.png`"
                  :alt="player.teamName"
                  class="w-6 h-6 object-contain"
                  @error="handleImageError"
                />
                <div class="flex-grow min-w-0">
                  <div class="font-semibold text-white text-sm truncate group-hover:text-purple-300 transition-colors">{{ player.name }}</div>
                  <div class="text-xs text-slate-400 truncate">{{ player.teamName }}</div>
                </div>
                <div class="text-lg font-bold text-blue-400">{{ player.assists }}</div>
              </div>
            </div>
            <div v-else class="text-slate-400 text-center py-8 text-sm">
              No hay datos disponibles
            </div>
          </div>
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
  name: 'PremierLeague',
  setup() {
    const leagueData = ref(null);
    const loading = ref(true);
    const error = ref(null);
    const currentRoundIndex = ref(0);
    const showRoundDropdown = ref(false);

    const loadLeagueData = async () => {
      try {
        loading.value = true;
        error.value = null;
        
        const data = await getLeagueOverview(LEAGUES.PREMIER_LEAGUE.id);
        leagueData.value = data;

        // Auto-detectar jornada actual
        if (data.allMatches) {
          const rounds = [...new Set(data.allMatches.map(m => m.round))].sort((a, b) => a - b);
          const currentRoundIdx = rounds.findIndex(round => {
            const roundMatches = data.allMatches.filter(m => m.round === round);
            return roundMatches.some(m => !m.status.finished);
          });
          if (currentRoundIdx !== -1) {
            currentRoundIndex.value = currentRoundIdx;
          }
        }
      } catch (err) {
        console.error('Error loading Premier League data:', err);
        error.value = 'Error al cargar los datos de la Premier League. Intentá de nuevo más tarde.';
      } finally {
        loading.value = false;
      }
    };

    // Jornadas disponibles
    const availableRounds = computed(() => {
      if (!leagueData.value?.allMatches) return [];
      const rounds = [...new Set(leagueData.value.allMatches.map(m => m.round))];
      return rounds.sort((a, b) => a - b);
    });

    // Nombre de la jornada actual
    const currentRoundName = computed(() => {
      const rounds = availableRounds.value;
      if (rounds.length === 0) return '';
      return `Jornada ${rounds[currentRoundIndex.value]}`;
    });

    // Partidos de la jornada actual
    const currentRoundMatches = computed(() => {
      if (!leagueData.value?.allMatches) return [];
      const rounds = availableRounds.value;
      if (rounds.length === 0) return [];
      
      const currentRound = rounds[currentRoundIndex.value];
      return leagueData.value.allMatches
        .filter(m => m.round === currentRound)
        .sort((a, b) => new Date(a.time) - new Date(b.time));
    });

    // Agrupar partidos por fecha
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
        if (diffDays === 0) {
          dateLabel = 'Hoy';
        } else if (diffDays === 1) {
          dateLabel = 'Mañana';
        } else if (diffDays === -1) {
          dateLabel = 'Ayer';
        } else {
          dateLabel = new Date(match.time).toLocaleDateString('es-AR', { 
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          });
        }
        
        if (!groups[dateLabel]) {
          groups[dateLabel] = [];
        }
        groups[dateLabel].push(match);
      });
      
      return groups;
    });

    const previousRound = () => {
      if (currentRoundIndex.value > 0) {
        currentRoundIndex.value--;
      }
    };

    const nextRound = () => {
      if (currentRoundIndex.value < availableRounds.value.length - 1) {
        currentRoundIndex.value++;
      }
    };

    const toggleRoundDropdown = () => {
      showRoundDropdown.value = !showRoundDropdown.value;
    };

    const selectRound = (index) => {
      currentRoundIndex.value = index;
      showRoundDropdown.value = false;
    };

    const handleClickOutside = (event) => {
      if (showRoundDropdown.value && !event.target.closest('.relative')) {
        showRoundDropdown.value = false;
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape' && showRoundDropdown.value) {
        showRoundDropdown.value = false;
      }
    };

    const getPositionClass = (qualColor) => {
      if (!qualColor) return '';
      // Champions League zone
      if (qualColor === '#2AD572') return 'table-success';
      // Europa League zone
      if (qualColor === '#0046A7') return 'table-primary';
      // Relegation zone
      if (qualColor === '#FF0000' || qualColor === '#E71D20') return 'table-danger';
      return '';
    };

    const formatMatchDate = (dateStr) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = date - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return 'Hoy ' + date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      if (days === 1) return 'Mañana ' + date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      
      return date.toLocaleDateString('es-AR', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatMatchTime = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    const getFormClass = (form) => {
      if (form === 'W') return 'form-win';
      if (form === 'D') return 'form-draw';
      if (form === 'L') return 'form-loss';
      return '';
    };

    const handleImageError = (e) => {
      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23ddd"/></svg>';
    };

    // Auto-refresh cada 30 segundos
    let refreshInterval = null;

    onMounted(() => {
      loadLeagueData();
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      
      // Configurar auto-refresh
      refreshInterval = setInterval(() => {
        loadLeagueData();
      }, 30000); // 30 segundos
    });

    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      
      // Limpiar interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    });

    return {
      leagueData,
      loading,
      error,
      currentRoundIndex,
      availableRounds,
      currentRoundName,
      currentRoundMatches,
      groupedMatchesByDate,
      showRoundDropdown,
      previousRound,
      nextRound,
      toggleRoundDropdown,
      selectRound,
      getPositionClass,
      formatMatchDate,
      formatMatchTime,
      getFormClass,
      handleImageError
    };
  }
};
</script>

<style scoped>
.premier-league-page {
  min-height: 100vh;
}

.league-logo {
  width: 50px;
  height: 50px;
  object-fit: contain;
}

/* Form Badges */
.form-win {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.form-draw {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

.form-loss {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

/* Scrollbar oscuro */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}

::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

/* Animaciones */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.premier-league-page > div > div {
  animation: fadeIn 0.5s ease-out;
}

/* Responsive */
@media (max-width: 1280px) {
  .league-logo {
    width: 45px;
    height: 45px;
  }
}

@media (max-width: 768px) {
  .premier-league-page {
    padding: 1rem 0.75rem;
  }
  
  .league-logo {
    width: 40px;
    height: 40px;
  }
  
  h1 {
    font-size: 1.5rem !important;
  }
}
</style>
