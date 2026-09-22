<template>
    <div class="min-h-screen bg-transparent py-8 px-4">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-white mb-2">Panel de Administración</h1>
                <p class="text-slate-400">Gestión completa de FULVO</p>
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

            <!-- Admin Shell -->
            <div v-else class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">

                <!-- Sidebar (fija) -->
                <div class="lg:sticky lg:top-24 space-y-3">
                    <nav class="bg-gradient-to-br from-slate-800/80 to-slate-900/50 backdrop-blur border border-white/10 rounded-2xl p-2 shadow-xl">
                        <div class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                            <button
                                v-for="section in sections"
                                :key="section.key"
                                @click="activeTab = section.key"
                                :class="[
                                    'flex items-center gap-3 min-w-max lg:min-w-0 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left',
                                    activeTab === section.key
                                        ? 'bg-gradient-to-r ' + section.activeClass + ' text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                ]"
                            >
                                <svg class="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path v-if="section.icon === 'chart'" d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
                                    <path v-else-if="section.icon === 'users'" d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
                                    <path v-else-if="section.icon === 'shield'" fill-rule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.54.035-1.07.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75zm4.196 5.954a.75.75 0 00-1.214-.882l-3.236 4.446-1.65-1.65a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.137-.089l3.773-5.135z" clip-rule="evenodd" />
                                    <path v-else-if="section.icon === 'star'" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    <path v-else-if="section.icon === 'flag'" fill-rule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clip-rule="evenodd" />
                                </svg>
                                <span class="whitespace-nowrap">{{ section.label }}</span>
                            </button>
                        </div>
                    </nav>

                    <!-- Pendientes (fija, debajo del nav) -->
                    <div v-if="pending.bugsOpen > 0 || pending.ghostUsers > 0" class="space-y-2">
                        <button
                            v-if="pending.bugsOpen > 0"
                            @click="activeTab = 'bugs'"
                            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition text-left"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 text-amber-400 shrink-0">
                                <path d="M8 2l1.5 2.5M16 2l-1.5 2.5"/><rect x="7" y="6" width="10" height="12" rx="5"/><path d="M12 10v6M4 10h3M17 10h3M4 15h3M17 15h3M5 20l2.5-2M19 20l-2.5-2"/>
                            </svg>
                            <div class="min-w-0">
                                <p class="text-2xl font-extrabold text-white leading-none">{{ pending.bugsOpen }}</p>
                                <p class="text-xs text-slate-400 mt-1">ticket{{ pending.bugsOpen === 1 ? '' : 's' }} sin resolver</p>
                            </div>
                        </button>
                        <button
                            v-if="pending.ghostUsers > 0"
                            @click="activeTab = 'users'"
                            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 transition text-left"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 text-red-400 shrink-0">
                                <path d="M12 3a7 7 0 0 0-7 7v9l2.5-2 2.5 2 2-2 2 2 2.5-2 2.5 2v-9a7 7 0 0 0-7-7z"/>
                                <circle cx="9.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
                                <circle cx="14.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
                            </svg>
                            <div class="min-w-0">
                                <p class="text-2xl font-extrabold text-white leading-none">{{ pending.ghostUsers }}</p>
                                <p class="text-xs text-slate-400 mt-1">fantasma{{ pending.ghostUsers === 1 ? '' : 's' }} detectado{{ pending.ghostUsers === 1 ? '' : 's' }}</p>
                            </div>
                        </button>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="min-w-0">
                    <!-- Resumen (Dashboard) -->
                    <AdminDashboard v-if="activeTab === 'dashboard'" ref="dashboardRef" />

                    <!-- User Management Tab -->
                    <AdminUserManagement v-else-if="activeTab === 'users'" @user-updated="loadStats" />

                    <!-- Teams Management Tab -->
                    <AdminTeamsManagement v-else-if="activeTab === 'teams'" />

                    <!-- Battle Pass Tab -->
                    <AdminBattlePass v-else-if="activeTab === 'pass'" />

                    <!-- Tickets Tab -->
                    <AdminBugReports v-else-if="activeTab === 'bugs'" @updated="loadPending" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { isAdmin, getAdminDashboard } from '../../services/admin.js';
import AppLoader from '../../components/common/AppLoader.vue';
import AdminUserManagement from '../../components/admin/AdminUserManagement.vue';
import AdminTeamsManagement from '../../components/admin/AdminTeamsManagement.vue';
import AdminBugReports from '../../components/admin/AdminBugReports.vue';
import AdminBattlePass from '../../components/admin/AdminBattlePass.vue';
import AdminDashboard from '../../components/admin/AdminDashboard.vue';

const SECTIONS = [
    { key: 'dashboard', label: 'Resumen', icon: 'chart', activeClass: 'from-cyan-600 to-cyan-700' },
    { key: 'users', label: 'Usuarios', icon: 'users', activeClass: 'from-blue-600 to-blue-700' },
    { key: 'teams', label: 'Equipos', icon: 'shield', activeClass: 'from-blue-600 to-blue-700' },
    { key: 'pass', label: 'Pase de Batalla', icon: 'star', activeClass: 'from-amber-500 to-yellow-600' },
    { key: 'bugs', label: 'Tickets', icon: 'flag', activeClass: 'from-blue-600 to-blue-700' },
];

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
        const activeTab = ref('dashboard');
        const dashboardRef = ref(null);
        const sections = SECTIONS;
        // Pendientes: widget fijo bajo el nav, independiente de qué tab esté activa.
        const pending = ref({ bugsOpen: 0, ghostUsers: 0 });

        async function checkAdminAccess() {
            try {
                isAdminUser.value = await isAdmin();
                if (isAdminUser.value) loadPending();
            } catch (error) {
                console.error('Error verificando acceso admin:', error);
            } finally {
                loading.value = false;
            }
        }

        async function loadPending() {
            try {
                const d = await getAdminDashboard();
                pending.value = { bugsOpen: d.bug_reports_open || 0, ghostUsers: d.ghost_users || 0 };
            } catch (error) {
                console.error('Error cargando pendientes:', error);
            }
        }

        // Refresca el dashboard cuando se edita un usuario desde la gestión (si está montado).
        function loadStats() {
            dashboardRef.value?.load();
            loadPending();
        }

        onMounted(() => {
            checkAdminAccess();
        });

        return {
            loading,
            isAdminUser,
            activeTab,
            dashboardRef,
            sections,
            pending,
            loadPending,
            loadStats
        };
    }
};
</script>


