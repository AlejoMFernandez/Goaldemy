<script>
import { RouterLink } from 'vue-router';
import { subscribeToAuthStateChanges } from '../services/auth';
import { logout } from '../services/auth';

export default {
  name: 'AppNavBar',
  components: {
    RouterLink
  },
    data() {
        return {
            user: {
                id: null,
                email: null,
            },
            isOpen: false,
        };
    },
    methods: {
        handleLogout() {
            logout();
            this.$router.push('/login');
        },
        toggle() { this.isOpen = !this.isOpen; }
    },
    mounted() {
        subscribeToAuthStateChanges(userState => this.user = userState);
    }
}
</script>

<template>
    <header class="sticky top-0 z-40">
        <div class="border-b border-white/10 bg-gradient-to-b from-slate-900/70 to-slate-900/30 backdrop-blur supports-[backdrop-filter]:bg-slate-900/40">
            <nav class="container mx-auto flex items-center justify-between px-4 py-4">
                <RouterLink to="/" class="group inline-flex items-center gap-2">
                    <img src="/src/assets/iconclaro.png" alt="Goaldemy" class="h-6 w-auto" />
                    <span class="sr-only">Goaldemy</span>
                </RouterLink>
                <button @click="toggle" class="md:hidden inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:border-white/20 hover:text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>Menú</span>
                </button>

                <ul class="hidden md:flex items-center gap-6 text-slate-200">
                    <li><RouterLink class="hover:text-white transition-colors" to="/">Home</RouterLink></li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/chat">Chat Global</RouterLink></li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/games">Juegos</RouterLink></li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/leaderboards">Leaderboards</RouterLink></li>
                    <template v-if="user.id === null">
                        <li><RouterLink class="hover:text-white transition-colors" to="/login">Iniciar sesión</RouterLink></li>
                        <li>
                            <RouterLink
                                class="rounded-full bg-[oklch(0.62_0.21_270)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[oklch(0.55_0.21_270)/30] transition hover:bg-[oklch(0.55_0.21_270)]"
                                to="/register"
                            >Registrarse</RouterLink>
                        </li>
                    </template>
                    <template v-else>
                        <li><RouterLink class="hover:text-white transition-colors" to="/profile">Perfil</RouterLink></li>
                        <li>
                            <form action="#" @submit.prevent="handleLogout">
                                <button
                                    class="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:text-white"
                                    type="submit"
                                >{{ user.email }} · Cerrar sesión</button>
                            </form>
                        </li>
                    </template>
                </ul>
            </nav>

            <!-- Mobile header -->
            <transition name="fade-slide">
                <div v-if="isOpen" class="md:hidden border-t border-white/10">
                                <ul class="container mx-auto px-4 py-3 flex flex-col gap-3 text-slate-200">
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/">Home</RouterLink></li>
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/chat">Chat Global</RouterLink></li>
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/games">Juegos</RouterLink></li>
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/leaderboards">Leaderboards</RouterLink></li>
                        <template v-if="user.id === null">
                                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/login">Iniciar sesión</RouterLink></li>
                                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/register">Registrarse</RouterLink></li>
                        </template>
                        <template v-else>
                                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/profile">Perfil</RouterLink></li>
                                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/profile-edit">Editar perfil</RouterLink></li>
                            <li>
                                <form action="#" @submit.prevent="handleLogout">
                                    <button class="block w-full text-left rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:text-white" type="submit">{{ user.email }} · Cerrar sesión</button>
                                </form>
                            </li>
                        </template>
                    </ul>
                </div>
            </transition>
             
        </div>
    </header>
</template>