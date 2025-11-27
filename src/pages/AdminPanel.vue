<template>
    <div class="min-h-screen bg-transparent py-8 px-4">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-white mb-2">Panel de Administración</h1>
                <p class="text-slate-400">Gestión completa de GOALDEMY</p>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex justify-center items-center py-20">
                <AppLoader />
            </div>

            <!-- Access Denied -->
            <div v-else-if="!isAdminUser" class="text-center py-20">
                <div class="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-md mx-auto">
                    <h2 class="text-2xl font-bold text-red-400 mb-4">⛔ Acceso Denegado</h2>
                    <p class="text-slate-300 mb-6">No tienes permisos de administrador para acceder a esta sección.</p>
                    <router-link to="/" class="inline-block bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition-colors">
                        Volver al Inicio
                    </router-link>
                </div>
            </div>

            <!-- Admin Dashboard -->
            <div v-else>
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <!-- Total Users -->
                    <div class="bg-slate-800/80 border border-white/10 rounded-2xl p-6 shadow-xl">
                        <div class="flex items-center justify-between mb-4">
                            <div class="bg-blue-500/20 p-3 rounded-lg">
                                <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                        </div>
                        <h3 class="text-slate-400 text-sm uppercase tracking-wide mb-1">Total Usuarios</h3>
                        <p class="text-3xl font-bold text-white">{{ stats.totalUsers ?? '-' }}</p>
                    </div>

                    <!-- Total Admins -->
                    <div class="bg-slate-800/80 border border-white/10 rounded-2xl p-6 shadow-xl">
                        <div class="flex items-center justify-between mb-4">
                            <div class="bg-amber-500/20 p-3 rounded-lg">
                                <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                        </div>
                        <h3 class="text-slate-400 text-sm uppercase tracking-wide mb-1">Administradores</h3>
                        <p class="text-3xl font-bold text-white">{{ stats.totalAdmins ?? '-' }}</p>
                    </div>

                    <!-- New Users 24h -->
                    <div class="bg-slate-800/80 border border-white/10 rounded-2xl p-6 shadow-xl">
                        <div class="flex items-center justify-between mb-4">
                            <div class="bg-green-500/20 p-3 rounded-lg">
                                <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                            </div>
                        </div>
                        <h3 class="text-slate-400 text-sm uppercase tracking-wide mb-1">Nuevos (24h)</h3>
                        <p class="text-3xl font-bold text-white">{{ stats.newUsersLast24h ?? '-' }}</p>
                    </div>

                    <!-- Top XP -->
                    <div class="bg-slate-800/80 border border-white/10 rounded-2xl p-6 shadow-xl">
                        <div class="flex items-center justify-between mb-4">
                            <div class="bg-purple-500/20 p-3 rounded-lg">
                                <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                        <h3 class="text-slate-400 text-sm uppercase tracking-wide mb-1">Top XP</h3>
                        <p class="text-3xl font-bold text-white">{{ stats.topUsers?.[0]?.total_xp ?? '-' }}</p>
                        <p class="text-xs text-slate-400 mt-1">{{ stats.topUsers?.[0]?.display_name ?? '-' }}</p>
                    </div>
                </div>

                <!-- Navigation Tabs -->
                <div class="bg-gradient-to-br from-slate-800/80 to-slate-900/50 backdrop-blur border border-white/10 rounded-2xl p-2 mb-8 shadow-xl">
                    <div class="flex gap-2">
                        <button
                            @click="activeTab = 'users'"
                            :class="[
                                'flex-1 px-6 py-3 rounded-lg font-semibold transition-all',
                                activeTab === 'users' 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            ]"
                        >
                            👥 Gestión de Usuarios
                        </button>
                        <button
                            @click="activeTab = 'stats'"
                            :class="[
                                'flex-1 px-6 py-3 rounded-lg font-semibold transition-all',
                                activeTab === 'stats' 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            ]"
                        >
                            📊 Estadísticas
                        </button>
                    </div>
                </div>

                <!-- Content Area -->
                <div>
                    <!-- User Management Tab -->
                    <AdminUserManagement v-if="activeTab === 'users'" @user-updated="loadStats" />

                    <!-- Stats Tab -->
                    <div v-else-if="activeTab === 'stats'" class="bg-gradient-to-br from-slate-800/80 to-slate-900/50 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-xl">
                        <h2 class="text-2xl font-bold text-white mb-6">Top 5 Usuarios por XP</h2>
                        <div class="space-y-4">
                            <div
                                v-for="(user, index) in stats.topUsers"
                                :key="user.display_name"
                                class="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                            >
                                <div class="text-2xl font-bold text-slate-500 w-8">
                                    #{{ index + 1 }}
                                </div>
                                <div class="flex-1">
                                    <p class="font-semibold text-white">{{ user.display_name }}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-lg font-bold text-amber-400">{{ user.total_xp.toLocaleString() }} XP</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { isAdmin, getUserStats } from '../services/admin.js';
import AppLoader from '../components/AppLoader.vue';
import AdminUserManagement from '../components/admin/AdminUserManagement.vue';

export default {
    name: 'AdminPanel',
    components: {
        AppLoader,
        AdminUserManagement
    },
    setup() {
        const loading = ref(true);
        const isAdminUser = ref(false);
        const activeTab = ref('users');
        const stats = ref({
            totalUsers: 0,
            totalAdmins: 0,
            newUsersLast24h: 0,
            topUsers: []
        });

        async function checkAdminAccess() {
            try {
                isAdminUser.value = await isAdmin();
                if (isAdminUser.value) {
                    await loadStats();
                }
            } catch (error) {
                console.error('Error verificando acceso admin:', error);
            } finally {
                loading.value = false;
            }
        }

        async function loadStats() {
            try {
                stats.value = await getUserStats();
            } catch (error) {
                console.error('Error cargando estadísticas:', error);
            }
        }

        onMounted(() => {
            checkAdminAccess();
        });

        return {
            loading,
            isAdminUser,
            activeTab,
            stats,
            loadStats
        };
    }
};
</script>
