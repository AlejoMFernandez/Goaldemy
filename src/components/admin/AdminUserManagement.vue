<template>
    <div class="border border-white/10 rounded-2xl p-8 shadow-xl bg-transparent">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-white">Gestión de Usuarios</h2>
            <button
                @click="loadUsers"
                class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                :disabled="loadingUsers"
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
                    placeholder="Buscar por nombre o email..."
                    class="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 pl-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg class="absolute left-4 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loadingUsers" class="flex justify-center py-12">
            <AppLoader />
        </div>

        <!-- Users Table -->
        <div v-else-if="users.length > 0" class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-white/10">
                        <th class="text-left py-3 px-4 text-xs uppercase tracking-wider text-slate-400 font-semibold">Usuario</th>
                        <th class="text-left py-3 px-4 text-xs uppercase tracking-wider text-slate-400 font-semibold">Email</th>
                        <th class="text-left py-3 px-4 text-xs uppercase tracking-wider text-slate-400 font-semibold">Nivel</th>
                        <th class="text-left py-3 px-4 text-xs uppercase tracking-wider text-slate-400 font-semibold">XP</th>
                        <th class="text-left py-3 px-4 text-xs uppercase tracking-wider text-slate-400 font-semibold">Rol</th>
                        <th class="text-left py-3 px-4 text-xs uppercase tracking-wider text-slate-400 font-semibold">Fecha Registro</th>
                        <th class="text-right py-3 px-4 text-xs uppercase tracking-wider text-slate-400 font-semibold">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    <tr
                        v-for="user in users"
                        :key="user.id"
                        class="hover:bg-slate-700/30 transition-colors"
                    >
                        <!-- User Info -->
                        <td class="py-4 px-4">
                            <div class="flex items-center gap-3">
                                <img
                                    v-if="user.avatar_url"
                                    :src="user.avatar_url"
                                    :alt="user.display_name"
                                    class="w-10 h-10 rounded-full object-cover border-2 border-white/20"
                                />
                                <div v-else class="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold">
                                    {{ user.display_name?.charAt(0).toUpperCase() }}
                                </div>
                                <div>
                                    <p class="font-semibold text-white">{{ user.display_name }}</p>
                                    <p class="text-xs text-slate-400">ID: {{ user.id.slice(0, 8) }}...</p>
                                </div>
                            </div>
                        </td>

                        <!-- Email -->
                        <td class="py-4 px-4">
                            <p class="text-slate-300">{{ user.email }}</p>
                        </td>


                        <!-- Level -->
                        <td class="py-4 px-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-slate-800/40 text-emerald-300">
                                {{ user.level ?? '-' }}
                            </span>
                        </td>

                        <td class="py-4 px-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border border-amber-500/30 bg-slate-800/40 text-amber-300">
                                {{ user.total_xp?.toLocaleString() ?? '-' }}
                            </span>
                        </td>

                        <td class="py-4 px-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border border-slate-500/30 bg-slate-800/40 text-slate-200">
                                {{ user.role === 'admin' ? 'Admin' : 'User' }}
                            </span>
                        </td>

                        <td class="py-4 px-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border border-slate-500/30 bg-slate-800/40 text-slate-300">
                                {{ formatDate(user.created_at) ?? '-' }}
                            </span>
                        </td>

                        <!-- Actions -->
                        <td class="py-4 px-4">
                            <div class="flex justify-end gap-2">
                                <button
                                    @click="toggleRole(user)"
                                    class="px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white transition-colors"
                                    :disabled="processingUserId === user.id"
                                >
                                    {{ user.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin' }}
                                </button>
                                <button
                                    @click="confirmDelete(user)"
                                    class="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-400 text-red-400 hover:bg-red-400 hover:text-white transition-colors"
                                    :disabled="processingUserId === user.id"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12">
            <p class="text-slate-400">No se encontraron usuarios</p>
        </div>

        <!-- Delete Confirmation Modal -->
        <div
            v-if="showDeleteModal"
            class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            @click.self="showDeleteModal = false"
        >
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <h3 class="text-2xl font-bold text-white mb-4">⚠️ Confirmar Eliminación</h3>
                <p class="text-slate-300 mb-6">
                    ¿Estás seguro de que querés eliminar al usuario <strong class="text-white">{{ userToDelete?.display_name }}</strong>?
                    Esta acción no se puede deshacer.
                </p>
                <div class="flex gap-4">
                    <button
                        @click="showDeleteModal = false"
                        class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        @click="handleDelete"
                        class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                        :disabled="processingUserId === userToDelete?.id"
                    >
                        {{ processingUserId === userToDelete?.id ? 'Eliminando...' : 'Eliminar' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { getAllUsers, changeUserRole, deleteUser, searchUsers } from '../../services/admin.js';
import AppLoader from '../common/AppLoader.vue';
import { pushErrorToast, pushSuccessToast } from '../../stores/notifications.js';

export default {
    name: 'AdminUserManagement',
    components: {
        AppLoader
    },
    emits: ['user-updated'],
    setup(props, { emit }) {
        const users = ref([]);
        const loadingUsers = ref(false);
        const searchQuery = ref('');
        const processingUserId = ref(null);
        const showDeleteModal = ref(false);
        const userToDelete = ref(null);
        let searchTimeout = null;

        async function loadUsers() {
            loadingUsers.value = true;
            try {
                users.value = await getAllUsers();
            } catch (error) {
                console.error('Error cargando usuarios:', error);
                pushErrorToast('Error cargando usuarios');
            } finally {
                loadingUsers.value = false;
            }
        }

        async function handleSearch() {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            searchTimeout = setTimeout(async () => {
                if (searchQuery.value.trim().length === 0) {
                    await loadUsers();
                    return;
                }

                loadingUsers.value = true;
                try {
                    users.value = await searchUsers(searchQuery.value.trim());
                } catch (error) {
                    console.error('Error buscando usuarios:', error);
                    pushErrorToast('Error en la búsqueda');
                } finally {
                    loadingUsers.value = false;
                }
            }, 300);
        }

        async function toggleRole(user) {
            processingUserId.value = user.id;
            try {
                const newRole = user.role === 'admin' ? 'user' : 'admin';
                await changeUserRole(user.id, newRole);
                
                // Update local state
                user.role = newRole;
                
                pushSuccessToast(
                    `Usuario ${newRole === 'admin' ? 'promovido a' : 'removido de'} administrador`
                );
                
                emit('user-updated');
            } catch (error) {
                console.error('Error cambiando rol:', error);
                pushErrorToast(error.message || 'Error cambiando rol del usuario');
            } finally {
                processingUserId.value = null;
            }
        }

        function confirmDelete(user) {
            userToDelete.value = user;
            showDeleteModal.value = true;
        }

        async function handleDelete() {
            if (!userToDelete.value) return;

            processingUserId.value = userToDelete.value.id;
            try {
                await deleteUser(userToDelete.value.id);
                
                // Remove from local state
                users.value = users.value.filter(u => u.id !== userToDelete.value.id);
                
                pushSuccessToast('Usuario eliminado correctamente');
                showDeleteModal.value = false;
                userToDelete.value = null;
                
                emit('user-updated');
            } catch (error) {
                console.error('Error eliminando usuario:', error);
                pushErrorToast(error.message || 'Error eliminando usuario');
            } finally {
                processingUserId.value = null;
            }
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }

        onMounted(() => {
            loadUsers();
        });

        return {
            users,
            loadingUsers,
            searchQuery,
            processingUserId,
            showDeleteModal,
            userToDelete,
            loadUsers,
            handleSearch,
            toggleRole,
            confirmDelete,
            handleDelete,
            formatDate
        };
    }
};
</script>

