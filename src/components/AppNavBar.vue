<script>
import { RouterLink } from 'vue-router';
import { subscribeToAuthStateChanges } from '../services/auth';
import { logout } from '../services/auth';
import { searchPublicProfiles } from '../services/user-profiles';
import { getUserLevel } from '../services/xp';

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
                avatar_url: null,
            },
            isOpen: false,
            q: '',
            searchOpen: false,
            searching: false,
            results: [],
            menuOpen: false,
            levelInfo: null,
            levelLoading: false,
            _lastLevelAt: 0,
        };
    },
    methods: {
        handleLogout() {
            logout();
            this.$router.push('/login');
        },
        toggle() { this.isOpen = !this.isOpen; },
        async loadLevelIfNeeded(force = false) {
            if (!this.user?.id) return;
            const now = Date.now();
            if (!force && this._lastLevelAt && (now - this._lastLevelAt < 15000)) {
                // Cache for 15s
                return;
            }
            this.levelLoading = true;
            try {
                const { data, error } = await getUserLevel(null);
                if (!error) {
                    this.levelInfo = Array.isArray(data) ? data[0] : data;
                    this._lastLevelAt = Date.now();
                }
            } finally {
                this.levelLoading = false;
            }
        },
        async onSearchInput() {
            const term = this.q.trim()
            if (term.length < 2) { this.results = []; this.searchOpen = false; return }
            this.searching = true
            try {
                const { data, error } = await searchPublicProfiles(term, 8)
                if (!error) {
                    const me = this.user?.id
                    const filtered = (data || []).filter(u => u.id !== me)
                    this.results = filtered
                }
            } finally {
                this.searching = false
                this.searchOpen = true
            }
        },
        goUser(u) {
            if (!u?.id) return
            this.q = ''
            this.results = []
            this.searchOpen = false
            this.$router.push(`/u/${u.id}`)
        },
        avatarInitial() {
            const letter = (this.user?.email || '?').trim()[0] || '?'
            return letter.toUpperCase()
        }
    },
    computed: {
        progressPercent() {
            const li = this.levelInfo;
            if (!li) return 0;
            if (!li.next_level_xp) return 100;
            const completed = li.next_level_xp - (li.xp_to_next ?? 0);
            const denom = li.next_level_xp || 1;
            return Math.max(0, Math.min(100, Math.round((completed / denom) * 100)));
        },
        xpNow() {
            return this.levelInfo?.xp_total ?? 0;
        }
    },
    mounted() {
                    subscribeToAuthStateChanges(userState => this.user = userState);
                    // Close menus on outside click
                    this._onDocClick = (e) => {
                        const menu = this.$el.querySelector('[data-user-menu]')
                        const btn = this.$el.querySelector('[data-user-button]')
                        if (this.menuOpen && menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
                            this.menuOpen = false
                        }
                        const search = this.$el.querySelector('[data-search-dropdown]')
                        const searchBox = this.$el.querySelector('[data-search-box]')
                        if (this.searchOpen && search && !search.contains(e.target) && searchBox && !searchBox.contains(e.target)) {
                            this.searchOpen = false
                        }
                    }
                    document.addEventListener('click', this._onDocClick)
                    // Watch menu open to fetch level lazily
                    this.$watch('menuOpen', (open) => { if (open) this.loadLevelIfNeeded() })
                    // Clear search box when navigating to a user profile
                    this.$watch(() => this.$route.fullPath, (p) => {
                        if (p?.startsWith?.('/u/')) {
                            this.q = ''
                            this.results = []
                            this.searchOpen = false
                        }
                    })
        },
        unmounted() {
            document.removeEventListener('click', this._onDocClick)
    }
}
</script>

<template>
    <header class="sticky top-0 z-40">
        <div class="border-b border-white/10 bg-gradient-to-b from-slate-900/70 to-slate-900/30 backdrop-blur supports-[backdrop-filter]:bg-slate-900/40">
            <nav class="container mx-auto flex items-center justify-between px-4 py-4">
                <RouterLink to="/" class="group inline-flex items-center gap-2">
                    <img src="/src/assets/iconclaro.png" alt="Goaldemy" class="h-10 w-auto" />
                    <span class="sr-only">Goaldemy</span>
                </RouterLink>
                <button @click="toggle" class="md:hidden inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:border-white/20 hover:text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>Menú</span>
                </button>

                <ul class="hidden md:flex items-center gap-4 text-slate-200">
                    <li><RouterLink class="hover:text-white transition-colors" to="/">Home</RouterLink></li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/chat">Chat Global</RouterLink></li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/games">Juegos</RouterLink></li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/leaderboards">Leaderboards</RouterLink></li>
                    <!-- Search -->
                    <li class="relative w-56">
                        <div class="relative" data-search-box>
                            <input type="search" v-model="q" @input="onSearchInput" placeholder="Buscar usuarios" class="searchbox w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20" />
                            <svg class="absolute right-2 top-1.5 h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        </div>
                        <div v-if="searchOpen" data-search-dropdown class="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl">
                            <ul>
                                <li v-for="u in results" :key="u.id" @click="goUser(u)" class="px-3 py-2 hover:bg-white/5 cursor-pointer text-sm flex items-center gap-2">
                                    <img v-if="u.avatar_url" :src="u.avatar_url" class="w-8 h-8 rounded-lg object-cover flex-none" alt="avatar" />
                                    <div v-else class="w-8 h-8 rounded-lg bg-slate-700 text-[11px] grid place-items-center flex-none">{{ (u.email||'?')[0]?.toUpperCase() }}</div>
                                    <div class="truncate">
                                        <span class="text-slate-100">{{ u.display_name || u.username || (u.email || u.id) }}</span>
                                        <span class="ml-1 text-slate-400">· {{ u.email }}</span>
                                    </div>
                                </li>
                                <li v-if="!results.length && !searching" class="px-3 py-2 text-slate-400 text-sm">Sin resultados</li>
                                <li v-if="searching" class="px-3 py-2 text-slate-400 text-sm">Buscando…</li>
                            </ul>
                        </div>
                    </li>
                    <template v-if="user.id === null">
                        <li><RouterLink class="hover:text-white transition-colors" to="/login">Iniciar sesión</RouterLink></li>
                        <li><RouterLink class="rounded-full bg-[oklch(0.62_0.21_270)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[oklch(0.55_0.21_270)/30] transition hover:bg-[oklch(0.55_0.21_270)]" to="/register">Registrarse</RouterLink></li>
                    </template>
                    <template v-else>
                        <li class="relative">
                            <button data-user-button @click="menuOpen = !menuOpen" class="inline-flex items-center gap-2 rounded-full border border-white/10 px-2 py-1.5 text-sm text-slate-200 hover:border-white/20">
                                <img v-if="user.avatar_url" :src="user.avatar_url" class="w-7 h-7 rounded-full object-cover" alt="avatar" />
                                <div v-else class="w-7 h-7 rounded-full bg-slate-700 grid place-items-center text-xs">{{ avatarInitial() }}</div>
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="text-slate-400"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                            </button>
                            <div v-if="menuOpen" data-user-menu class="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden">
                                <div class="px-3 py-3 border-b border-white/10">
                                    <div v-if="!levelInfo && levelLoading" class="mt-1 h-2 rounded bg-white/10 overflow-hidden">
                                        <div class="h-full w-1/3 bg-[oklch(0.62_0.21_270)] animate-pulse"></div>
                                    </div>
                                    <div v-else>
                                        <div class="mt-1 flex items-center justify-between text-xs text-slate-300">
                                            <span>Nivel {{ levelInfo?.level ?? '—' }}</span>
                                            <span class="text-slate-200 font-medium">{{ xpNow }} XP</span>
                                        </div>
                                        <div class="mt-1 h-2 rounded bg-white/10 overflow-hidden">
                                            <div class="h-full bg-[oklch(0.62_0.21_270)]" :style="{ width: (progressPercent||0) + '%' }"></div>
                                        </div>
                                        <div class="mt-1 text-[11px] text-slate-400">
                                            <template v-if="levelInfo?.next_level_xp">
                                                Faltan {{ levelInfo?.xp_to_next }} XP para el nivel {{ (levelInfo?.next_level ?? (levelInfo?.level||0)+1) }}
                                            </template>
                                            <template v-else>
                                                Nivel máximo alcanzado
                                            </template>
                                        </div>
                                    </div>
                                </div>
                                <RouterLink @click="menuOpen=false" to="/profile" class="block px-3 py-2 text-sm hover:bg-white/5 text-slate-200">Ver Perfil</RouterLink>
                                <button @click="handleLogout" class="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-slate-200">Cerrar sesión</button>
                            </div>
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
                        <li class="pt-2">
                            <div class="relative">
                                <input type="search" v-model="q" @input="onSearchInput" placeholder="Buscar usuarios" class="searchbox w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20" />
                                <div v-if="searchOpen" class="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl">
                                    <ul>
                                        <li v-for="u in results" :key="u.id" @click="isOpen=false; goUser(u)" class="px-3 py-2 hover:bg-white/5 cursor-pointer text-sm flex items-center gap-2">
                                            <img v-if="u.avatar_url" :src="u.avatar_url" class="w-8 h-8 rounded-lg object-cover flex-none" alt="avatar" />
                                            <div v-else class="w-8 h-8 rounded-lg bg-slate-700 text-[11px] grid place-items-center flex-none">{{ (u.email||'?')[0]?.toUpperCase() }}</div>
                                            <div class="truncate">
                                                <span class="text-slate-100">{{ u.display_name || u.username || (u.email || u.id) }}</span>
                                                <span class="ml-1 text-slate-400">· {{ u.email }}</span>
                                            </div>
                                        </li>
                                        <li v-if="!results.length && !searching" class="px-3 py-2 text-slate-400 text-sm">Sin resultados</li>
                                        <li v-if="searching" class="px-3 py-2 text-slate-400 text-sm">Buscando…</li>
                                    </ul>
                                </div>
                            </div>
                        </li>
                        <template v-if="user.id === null">
                                <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/login">Iniciar sesión</RouterLink></li>
                                <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/register">Registrarse</RouterLink></li>
                        </template>
                        <template v-else>
                            <li>
                                <button @click="menuOpen = !menuOpen" class="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-slate-200 hover:border-white/20">
                                    <img v-if="user.avatar_url" :src="user.avatar_url" class="w-7 h-7 rounded-full object-cover" alt="avatar" />
                                    <div v-else class="w-7 h-7 rounded-full bg-slate-700 grid place-items-center text-xs">{{ avatarInitial() }}</div>
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="text-slate-400"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                                </button>
                                <div v-if="menuOpen" class="mt-2 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden">
                                    <div class="px-3 py-3 border-b border-white/10">
                                        <div v-if="!levelInfo && levelLoading" class="mt-1 h-2 rounded bg-white/10 overflow-hidden">
                                            <div class="h-full w-1/3 bg-[oklch(0.62_0.21_270)] animate-pulse"></div>
                                        </div>
                                        <div v-else>
                                            <div class="mt-1 flex items-center justify-between text-xs text-slate-300">
                                                <span>Nivel {{ levelInfo?.level ?? '—' }}</span>
                                                <span class="text-slate-200 font-medium">{{ xpNow }} XP</span>
                                            </div>
                                            <div class="mt-1 h-2 rounded bg-white/10 overflow-hidden">
                                                <div class="h-full bg-[oklch(0.62_0.21_270)]" :style="{ width: (progressPercent||0) + '%' }"></div>
                                            </div>
                                            <div class="mt-1 text-[11px] text-slate-400">
                                                <template v-if="levelInfo?.next_level_xp">
                                                    Faltan {{ levelInfo?.xp_to_next }} XP para el nivel {{ (levelInfo?.next_level ?? (levelInfo?.level||0)+1) }}
                                                </template>
                                                <template v-else>
                                                    Nivel máximo alcanzado
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                    <RouterLink @click="isOpen=false; menuOpen=false" to="/profile" class="block px-3 py-2 text-sm hover:bg-white/5 text-slate-200">Ver Perfil</RouterLink>
                                    <button @click="handleLogout" class="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-slate-200">Cerrar sesión</button>
                                </div>
                            </li>
                        </template>
                    </ul>
                </div>
            </transition>

        </div>
    </header>
</template>

<style scoped>
/* Make search avatars/initials uniform */
.searchbox::-ms-clear { display: none; width: 0; height: 0; }
.searchbox::-ms-reveal { display: none; width: 0; height: 0; }
.searchbox::-webkit-search-decoration,
.searchbox::-webkit-search-cancel-button,
.searchbox::-webkit-search-results-button,
.searchbox::-webkit-search-results-decoration { display: none; }
</style>