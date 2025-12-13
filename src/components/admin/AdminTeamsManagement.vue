<template>
    <div class="border border-white/10 rounded-2xl p-8 shadow-xl bg-transparent">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-white">Gestión de Equipos y Jugadores</h2>
            <button
                @click="loadTeams"
                class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                :disabled="loadingTeams"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recargar
            </button>
        </div>

        <!-- Search Bar -->
        <div class="mb-6">
            <div class="relative">
                <input
                    v-model="searchQuery"
                    @input="handleSearch"
                    type="text"
                    placeholder="Buscar equipo..."
                    class="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 pl-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg class="absolute left-4 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loadingTeams" class="flex justify-center py-12">
            <AppLoader />
        </div>

        <!-- Teams List -->
        <div v-else-if="teams.length > 0" class="space-y-4">
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
                            v-if="team.logo"
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
                    <div class="p-4 bg-slate-900/30">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div
                                v-for="player in team.players"
                                :key="player.id"
                                class="bg-slate-700/30 border border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-colors group relative"
                            >
                                <div class="flex items-start gap-3">
                                    <img
                                        v-if="player.photo"
                                        :src="player.photo"
                                        :alt="player.name"
                                        class="w-16 h-16 rounded-lg object-cover border-2 border-white/20"
                                        @error="handleImageError"
                                    />
                                    <div class="flex-1 min-w-0">
                                        <h4 class="font-semibold text-white truncate">{{ player.name }}</h4>
                                        <div class="text-xs text-slate-400 space-y-1 mt-1">
                                            <p>Posición: <span class="text-slate-300">{{ player.position }}</span></p>
                                            <p>Dorsal: <span class="text-slate-300">{{ player.shirtNumber }}</span></p>
                                            <p>Edad: <span class="text-slate-300">{{ player.age }}</span></p>
                                            <p>Nacionalidad: <span class="text-slate-300">{{ player.nationality }}</span></p>
                                            <p v-if="player.height !== 'N/A'">Altura: <span class="text-slate-300">{{ player.height }} cm</span></p>
                                            <p v-if="player.transferValue > 0">Valor: <span class="text-green-400">{{ formatCurrency(player.transferValue) }}</span></p>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Edit Button (will be functional in future) -->
                                <button
                                    @click="editPlayer(team, player)"
                                    class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                                    title="Editar jugador (próximamente)"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12">
            <p class="text-slate-400">No se encontraron equipos</p>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import AppLoader from '../common/AppLoader.vue';
import { pushErrorToast } from '../../stores/notifications.js';

export default {
    name: 'AdminTeamsManagement',
    components: {
        AppLoader
    },
    setup() {
        const teams = ref([]);
        const loadingTeams = ref(false);
        const searchQuery = ref('');
        const expandedTeams = ref(new Set());

        const filteredTeams = computed(() => {
            if (!searchQuery.value.trim()) {
                return teams.value;
            }
            const query = searchQuery.value.toLowerCase();
            return teams.value.filter(team => 
                team.name.toLowerCase().includes(query)
            );
        });

        async function loadTeams() {
            loadingTeams.value = true;
            try {
                // Cargar desde el JSON de datos de juegos
                const dataGamesModule = await import('../../dataGAMES.json');
                const teamsData = dataGamesModule.default || dataGamesModule;
                
                // Procesar los datos para extraer equipos y jugadores
                const teamsWithPlayers = teamsData.map(team => {
                    // Extraer todos los jugadores del squad
                    const players = [];
                    
                    if (team.squad && Array.isArray(team.squad)) {
                        team.squad.forEach(section => {
                            if (section.members && Array.isArray(section.members)) {
                                section.members.forEach(member => {
                                    // Solo agregar si no es coach
                                    if (section.title !== 'coach') {
                                        players.push({
                                            id: member.id,
                                            name: member.name,
                                            photo: member.photo || `https://images.fotmob.com/image_resources/playerimages/${member.id}.png`,
                                            position: member.role?.fallback || member.positionIdsDesc || 'N/A',
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
                pushErrorToast('Error cargando equipos');
            } finally {
                loadingTeams.value = false;
            }
        }

        function handleSearch() {
            // La búsqueda se maneja automáticamente con el computed
        }

        function toggleTeam(teamId) {
            if (expandedTeams.value.has(teamId)) {
                expandedTeams.value.delete(teamId);
            } else {
                expandedTeams.value.add(teamId);
            }
            // Forzar reactividad
            expandedTeams.value = new Set(expandedTeams.value);
        }

        function editPlayer(team, player) {
            // Placeholder para futura funcionalidad de edición
            console.log('Editar jugador:', player.name, 'del equipo:', team.name);
            pushErrorToast('Funcionalidad de edición próximamente disponible');
        }

        function handleImageError(event) {
            // Si falla la carga de la imagen, usar un placeholder
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
            loadingTeams,
            searchQuery,
            expandedTeams,
            filteredTeams,
            loadTeams,
            handleSearch,
            toggleTeam,
            editPlayer,
            handleImageError,
            formatCurrency
        };
    }
};
</script>
