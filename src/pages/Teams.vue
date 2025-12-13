<template>
    <div class="min-h-screen bg-transparent py-8 px-4">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-white mb-2">Equipos y Jugadores</h1>
                <p class="text-slate-400">Explora las plantillas completas de todos los equipos</p>
            </div>

            <!-- Search and Filters -->
            <div class="bg-slate-800/50 border border-white/10 rounded-2xl p-6 mb-8">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Search -->
                    <div class="md:col-span-2">
                        <div class="relative">
                            <input
                                v-model="searchQuery"
                                type="text"
                                placeholder="Buscar equipo o jugador..."
                                class="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 pl-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <svg class="absolute left-4 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <!-- View Mode Toggle -->
                    <div class="flex gap-2">
                        <button
                            @click="viewMode = 'grid'"
                            :class="[
                                'flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2',
                                viewMode === 'grid' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                            ]"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Grid
                        </button>
                        <button
                            @click="viewMode = 'list'"
                            :class="[
                                'flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2',
                                viewMode === 'list' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                            ]"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            Lista
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex justify-center py-20">
                <AppLoader />
            </div>

            <!-- Grid View -->
            <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                    v-for="team in filteredTeams"
                    :key="team.id"
                    @click="selectTeam(team)"
                    class="bg-slate-800/50 border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition-all cursor-pointer group hover:shadow-xl hover:shadow-blue-500/10"
                >
                    <div class="flex items-center gap-4 mb-4">
                        <img
                            :src="team.logo"
                            :alt="team.name"
                            class="w-16 h-16 object-contain group-hover:scale-110 transition-transform"
                        />
                        <div class="flex-1">
                            <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{{ team.name }}</h3>
                            <p class="text-sm text-slate-400">{{ team.players?.length || 0 }} jugadores</p>
                        </div>
                    </div>

                    <!-- Quick Stats -->
                    <div class="grid grid-cols-3 gap-2 pt-4 border-t border-white/10">
                        <div class="text-center">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Porteros</p>
                            <p class="text-lg font-bold text-white">{{ countPosition(team, 'GK') }}</p>
                        </div>
                        <div class="text-center">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Defensas</p>
                            <p class="text-lg font-bold text-white">{{ countPosition(team, 'DEF') }}</p>
                        </div>
                        <div class="text-center">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Atacantes</p>
                            <p class="text-lg font-bold text-white">{{ countPosition(team, 'ATT') }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- List View -->
            <div v-else class="space-y-4">
                <div
                    v-for="team in filteredTeams"
                    :key="team.id"
                    class="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden"
                >
                    <!-- Team Header -->
                    <div 
                        class="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors flex items-center justify-between"
                        @click="toggleTeam(team.id)"
                    >
                        <div class="flex items-center gap-4">
                            <img
                                :src="team.logo"
                                :alt="team.name"
                                class="w-12 h-12 object-contain"
                            />
                            <div>
                                <h3 class="text-lg font-semibold text-white">{{ team.name }}</h3>
                                <p class="text-sm text-slate-400">{{ team.players?.length || 0 }} jugadores</p>
                            </div>
                        </div>
                        <svg 
                            class="w-6 h-6 text-slate-400 transition-transform"
                            :class="{ 'rotate-180': expandedTeams.has(team.id) }"
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    <!-- Players List (Expandable) -->
                    <div v-if="expandedTeams.has(team.id)" class="border-t border-white/10">
                        <div class="p-6 bg-slate-900/30">
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <div
                                    v-for="player in team.players"
                                    :key="player.id"
                                    class="bg-slate-700/30 border border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-all group"
                                >
                                    <div class="flex flex-col items-center text-center">
                                        <img
                                            :src="player.photo"
                                            :alt="player.name"
                                            class="w-20 h-20 rounded-full object-cover border-2 border-white/20 mb-3 group-hover:border-blue-500/50 transition-colors"
                                            @error="handleImageError"
                                        />
                                        <h4 class="font-semibold text-white mb-1 text-sm">{{ player.name }}</h4>
                                        <div class="flex items-center gap-2 mb-2">
                                            <span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                                                {{ player.shirtNumber }}
                                            </span>
                                            <span class="text-xs text-slate-400">{{ player.position }}</span>
                                        </div>
                                        <div class="text-xs text-slate-500 space-y-1 w-full">
                                            <div class="flex justify-between">
                                                <span>Edad:</span>
                                                <span class="text-slate-300">{{ player.age }}</span>
                                            </div>
                                            <div class="flex justify-between">
                                                <span>País:</span>
                                                <span class="text-slate-300">{{ player.nationality }}</span>
                                            </div>
                                            <div v-if="player.height !== 'N/A'" class="flex justify-between">
                                                <span>Altura:</span>
                                                <span class="text-slate-300">{{ player.height }}cm</span>
                                            </div>
                                            <div v-if="player.transferValue > 0" class="flex justify-between pt-2 border-t border-white/10">
                                                <span>Valor:</span>
                                                <span class="text-green-400 font-semibold">{{ formatCurrency(player.transferValue) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-if="!loading && filteredTeams.length === 0" class="text-center py-20">
                <div class="bg-slate-800/50 border border-white/10 rounded-2xl p-12 max-w-md mx-auto">
                    <svg class="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p class="text-slate-400 text-lg">No se encontraron equipos que coincidan con tu búsqueda</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import AppLoader from '../components/common/AppLoader.vue';

export default {
    name: 'Teams',
    components: {
        AppLoader
    },
    setup() {
        const teams = ref([]);
        const loading = ref(true);
        const searchQuery = ref('');
        const viewMode = ref('grid');
        const expandedTeams = ref(new Set());
        const selectedTeam = ref(null);

        const filteredTeams = computed(() => {
            if (!searchQuery.value.trim()) {
                return teams.value;
            }
            const query = searchQuery.value.toLowerCase();
            return teams.value.filter(team => {
                const teamMatch = team.name.toLowerCase().includes(query);
                const playerMatch = team.players?.some(player => 
                    player.name.toLowerCase().includes(query)
                );
                return teamMatch || playerMatch;
            });
        });

        async function loadTeams() {
            loading.value = true;
            try {
                const dataGamesModule = await import('../dataGAMES.json');
                const teamsData = dataGamesModule.default || dataGamesModule;
                
                const teamsWithPlayers = teamsData.map(team => {
                    const players = [];
                    
                    if (team.squad && Array.isArray(team.squad)) {
                        team.squad.forEach(section => {
                            if (section.members && Array.isArray(section.members)) {
                                section.members.forEach(member => {
                                    if (section.title !== 'coach') {
                                        players.push({
                                            id: member.id,
                                            name: member.name,
                                            photo: member.photo || `https://images.fotmob.com/image_resources/playerimages/${member.id}.png`,
                                            position: member.positionIdsDesc || member.role?.fallback || 'N/A',
                                            shirtNumber: member.shirtNumber || 'N/A',
                                            age: member.age || 'N/A',
                                            nationality: member.cname || 'N/A',
                                            height: member.height || 'N/A',
                                            transferValue: member.transferValue || 0
                                        });
                                    }
                                });
                            }
                        });
                    }
                    
                    return {
                        id: team.id,
                        name: team.name,
                        shortName: team.shortName,
                        logo: team.logo,
                        players: players
                    };
                });
                
                teams.value = teamsWithPlayers;
            } catch (error) {
                console.error('Error cargando equipos:', error);
            } finally {
                loading.value = false;
            }
        }

        function toggleTeam(teamId) {
            if (expandedTeams.value.has(teamId)) {
                expandedTeams.value.delete(teamId);
            } else {
                expandedTeams.value.add(teamId);
            }
            expandedTeams.value = new Set(expandedTeams.value);
        }

        function selectTeam(team) {
            selectedTeam.value = team;
            expandedTeams.value = new Set([team.id]);
            viewMode.value = 'list';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function countPosition(team, positionType) {
            if (!team.players) return 0;
            
            const positionMap = {
                'GK': ['GK', 'Keeper'],
                'DEF': ['D', 'DEF', 'Defender'],
                'ATT': ['A', 'ATT', 'Attacker', 'Forward']
            };
            
            return team.players.filter(player => {
                const pos = player.position?.toUpperCase() || '';
                return positionMap[positionType]?.some(p => pos.includes(p.toUpperCase()));
            }).length;
        }

        function handleImageError(event) {
            event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"%3E%3Cpath d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/%3E%3Ccircle cx="12" cy="7" r="4"/%3E%3C/svg%3E';
        }

        function formatCurrency(value) {
            if (value >= 1000000) {
                return `€${(value / 1000000).toFixed(1)}M`;
            } else if (value >= 1000) {
                return `€${(value / 1000).toFixed(0)}K`;
            }
            return `€${value}`;
        }

        onMounted(() => {
            loadTeams();
        });

        return {
            teams,
            loading,
            searchQuery,
            viewMode,
            expandedTeams,
            selectedTeam,
            filteredTeams,
            toggleTeam,
            selectTeam,
            countPosition,
            handleImageError,
            formatCurrency
        };
    }
};
</script>
