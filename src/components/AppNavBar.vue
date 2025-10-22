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
            infoOpen: false,
            playOpen: false,
            _infoCloseTimer: null,
            _playCloseTimer: null,
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
        },
        // Dropdown controls (less sensitive hover)
        onInfoEnter() {
            if (this._infoCloseTimer) { clearTimeout(this._infoCloseTimer); this._infoCloseTimer = null }
            this.infoOpen = true
            this.playOpen = false
        },
        onInfoLeave() {
            if (this._infoCloseTimer) clearTimeout(this._infoCloseTimer)
            this._infoCloseTimer = setTimeout(() => { this.infoOpen = false }, 220)
        },
        onPlayEnter() {
            if (this._playCloseTimer) { clearTimeout(this._playCloseTimer); this._playCloseTimer = null }
            this.playOpen = true
            this.infoOpen = false
        },
        onPlayLeave() {
            if (this._playCloseTimer) clearTimeout(this._playCloseTimer)
            this._playCloseTimer = setTimeout(() => { this.playOpen = false }, 220)
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
                        const infoMenu = this.$el.querySelector('[data-info-menu]')
                        const infoBtn = this.$el.querySelector('[data-info-button]')
                        if (this.infoOpen && infoMenu && !infoMenu.contains(e.target) && infoBtn && !infoBtn.contains(e.target)) {
                            this.infoOpen = false
                        }
                        const playMenu = this.$el.querySelector('[data-play-menu]')
                        const playBtn = this.$el.querySelector('[data-play-button]')
                        if (this.playOpen && playMenu && !playMenu.contains(e.target) && playBtn && !playBtn.contains(e.target)) {
                            this.playOpen = false
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
                        this.infoOpen = false
                        this.playOpen = false
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
            <nav class="container mx-auto flex items-center justify-between px-4 py-4 gap-3">
                <RouterLink to="/" class="group inline-flex items-center gap-2 flex-none">
                    <img src="/src/assets/iconclaro.png" alt="Goaldemy" class="h-10 w-auto" />
                    <span class="sr-only">Goaldemy</span>
                </RouterLink>
                <!-- Mobile controls: only menu button (logo + menú) -->
                <div class="md:hidden flex items-center gap-2 flex-1 justify-end">
                    <button @click="toggle" class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:border-white/20 hover:text-white">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span>Menú</span>
                    </button>
                </div>

                <ul class="hidden md:flex items-center gap-4 text-slate-200">
                    <li><RouterLink class="hover:text-white transition-colors" to="/">Home</RouterLink></li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/chat">Chat Global</RouterLink></li>
                    
                    <li><RouterLink class="hover:text-white transition-colors" to="/leaderboards">Leaderboards</RouterLink></li>
                    <!-- Info dropdown (hover) -->
                    <li class="relative"
                        @mouseenter="onInfoEnter"
                        @mouseleave="onInfoLeave">
                        <button data-info-button class="inline-flex items-center gap-1 px-0 py-1.5 text-slate-200 hover:text-white">
                            Información
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="text-slate-400"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                        </button>
                        <div v-if="infoOpen" data-info-menu class="absolute left-0 mt-2 w-56 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden z-30"
                             @mouseenter="onInfoEnter" @mouseleave="onInfoLeave">
                            <RouterLink @click="infoOpen=false" to="/about/me" class="block px-4 py-3 text-sm font-medium hover:bg-white/5 text-slate-200">¿Quién soy?</RouterLink>
                            <RouterLink @click="infoOpen=false" to="/about/goaldemy" class="block px-4 py-3 text-sm font-medium hover:bg-white/5 text-slate-200">¿Qué es Goaldemy?</RouterLink>
                            <RouterLink @click="infoOpen=false" to="/about/objetivo" class="block px-4 py-3 text-sm font-medium hover:bg-white/5 text-slate-200">Objetivo</RouterLink>
                        </div>
                    </li>
                    <!-- Play dropdown (hover) with descriptions -->
                    <li class="relative"
                        @mouseenter="onPlayEnter"
                        @mouseleave="onPlayLeave">
                        <button data-play-button class="inline-flex items-center gap-1 px-0 py-1.5 text-slate-200 hover:text-white">
                            Jugar
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="text-slate-400"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                        </button>
                        <div v-if="playOpen" data-play-menu class="absolute left-0 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden z-30"
                             @mouseenter="onPlayEnter" @mouseleave="onPlayLeave">
                            <div class="p-3">
                                <h4 class="text-slate-400 text-xs uppercase tracking-wider mb-2">Modos de juego</h4>
                                <RouterLink @click="playOpen=false" to="/play/points" class="block rounded-lg p-2 hover:bg-white/5">
                                    <div class="text-sm text-slate-100 font-medium">Jugar por puntos</div>
                                    <p class="text-slate-400 text-xs">Desafío diario con cronómetro. 1 intento por día. Sumá XP.</p>
                                </RouterLink>
                                <RouterLink @click="playOpen=false" to="/play/free" class="mt-1 block rounded-lg p-2 hover:bg-white/5">
                                    <div class="text-sm text-slate-100 font-medium">Jugar libre</div>
                                    <p class="text-slate-400 text-xs">Practicá sin límite de partidas. No suma XP.</p>
                                </RouterLink>
                            </div>
                        </div>
                    </li>
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

            <!-- Mobile header menu options -->
            <transition name="fade-slide">
                <div v-if="isOpen" class="md:hidden border-t border-white/10">
                    <ul class="container mx-auto px-4 py-3 flex flex-col gap-3 text-slate-200">
                        <!-- Row: searchbar - user dropdown -->
                        <li>
                            <div class="flex items-center gap-2">
                                <div class="relative flex-1" data-search-box>
                                    <input type="search" v-model="q" @input="onSearchInput" placeholder="Buscar usuarios" class="searchbox w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20" />
                                    <div v-if="searchOpen" data-search-dropdown class="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl">
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

                                <div class="relative flex-none">
                                    <template v-if="user.id === null">
                                        <RouterLink @click="isOpen=false" to="/login" class="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-slate-200 hover:border-white/20">Iniciar sesión</RouterLink>
                                    </template>
                                    <template v-else>
                                        <button data-user-button @click.stop="menuOpen = !menuOpen" class="inline-flex items-center gap-2 rounded-full border border-white/10 px-2 py-1.5 text-sm text-slate-200 hover:border-white/20">
                                            <img v-if="user.avatar_url" :src="user.avatar_url" class="w-7 h-7 rounded-full object-cover" alt="avatar" />
                                            <div v-else class="w-7 h-7 rounded-full bg-slate-700 grid place-items-center text-xs">{{ avatarInitial() }}</div>
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="text-slate-400"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                                        </button>
                                        <div v-if="menuOpen" data-user-menu class="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden z-50">
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
                                    </template>
                                </div>
                            </div>
                        </li>

                        <!-- Nav items -->
                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/">Home</RouterLink></li>
                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/chat">Chat Global</RouterLink></li>
                        
                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/leaderboards">Leaderboards</RouterLink></li>
                                                <li>
                                                    <details class="group">
                                                        <summary class="cursor-pointer hover:text-white">Info</summary>
                                                        <ul class="mt-1 pl-3 flex flex-col gap-1 text-slate-300">
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/about/me">¿Quién soy?</RouterLink></li>
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/about/goaldemy">¿Qué es Goaldemy?</RouterLink></li>
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/about/objetivo">Objetivo</RouterLink></li>
                                                        </ul>
                                                    </details>
                                                </li>
                                                <li>
                                                    <details class="group">
                                                        <summary class="cursor-pointer hover:text-white">Jugar</summary>
                                                        <ul class="mt-1 pl-3 flex flex-col gap-1 text-slate-300">
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/play/points">Jugar por puntos</RouterLink></li>
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/play/free">Jugar libre</RouterLink></li>
                                                        </ul>
                                                    </details>
                                                </li>
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