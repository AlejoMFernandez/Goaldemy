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
                    <h2 class="text-2xl font-bold text-red-400 mb-4">Acceso Denegado</h2>
                    <p class="text-slate-300 mb-6">No tienes permisos de administrador para acceder a esta sección.</p>
                    <router-link to="/" class="inline-block bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition-colors">
                        Volver al Inicio
                    </router-link>
                </div>
            </div>

            <!-- Admin Dashboard -->
            <div v-else>
                <!-- Dashboard con KPIs reales -->
                <AdminDashboard ref="dashboardRef" />

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
                            Gestión de Usuarios
                        </button>
                        <button
                            @click="activeTab = 'teams'"
                            :class="[
                                'flex-1 px-6 py-3 rounded-lg font-semibold transition-all',
                                activeTab === 'teams'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            ]"
                        >
                            Equipos y Jugadores
                        </button>
                        <button
                            @click="activeTab = 'pass'"
                            :class="[
                                'flex-1 px-6 py-3 rounded-lg font-semibold transition-all',
                                activeTab === 'pass'
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            ]"
                        >
                            Pase de Batalla
                        </button>
                        <button
                            @click="activeTab = 'bugs'"
                            :class="[
                                'flex-1 px-6 py-3 rounded-lg font-semibold transition-all',
                                activeTab === 'bugs'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            ]"
                        >
                            Reportes
                        </button>
                    </div>
                </div>

                <!-- Content Area -->
                <div>
                    <!-- User Management Tab -->
                    <AdminUserManagement v-if="activeTab === 'users'" @user-updated="loadStats" />

                    <!-- Teams Management Tab -->
                    <AdminTeamsManagement v-else-if="activeTab === 'teams'" />

                    <!-- Battle Pass Tab -->
                    <AdminBattlePass v-else-if="activeTab === 'pass'" />

                    <!-- Bug Reports Tab -->
                    <AdminBugReports v-else-if="activeTab === 'bugs'" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { isAdmin } from '../../services/admin.js';
import AppLoader from '../../components/common/AppLoader.vue';
import AdminUserManagement from '../../components/admin/AdminUserManagement.vue';
import AdminTeamsManagement from '../../components/admin/AdminTeamsManagement.vue';
import AdminBugReports from '../../components/admin/AdminBugReports.vue';
import AdminBattlePass from '../../components/admin/AdminBattlePass.vue';
import AdminDashboard from '../../components/admin/AdminDashboard.vue';

export default {
    name: 'AdminPanel',
    components: {
        AppLoader,
        AdminUserManagement,
        AdminTeamsManagement,
        AdminBugReports,
        AdminBattlePass,
        AdminDashboard
    },
    setup() {
        const loading = ref(true);
        const isAdminUser = ref(false);
        const activeTab = ref('users');
        const dashboardRef = ref(null);

        async function checkAdminAccess() {
            try {
                isAdminUser.value = await isAdmin();
            } catch (error) {
                console.error('Error verificando acceso admin:', error);
            } finally {
                loading.value = false;
            }
        }

        // Refresca el dashboard cuando se edita un usuario desde la gestión.
        function loadStats() {
            dashboardRef.value?.load();
        }

        onMounted(() => {
            checkAdminAccess();
        });

        return {
            loading,
            isAdminUser,
            activeTab,
            dashboardRef,
            loadStats
        };
    }
};
</script>


