<script>
import { RouterLink } from 'vue-router';
import { subscribeToAuthStateChanges } from '../services/auth';
import { logout } from '../services/auth';
import { searchPublicProfiles } from '../services/user-profiles';
import { getUserLevel, computeProgressPercentSync, computeLevelProgress, fetchLevelThresholds } from '../services/xp';
import { fetchUnreadCount, listNotifications, markAsRead } from '../services/notifications';
import { supabase } from '../services/supabase';
import { listIncomingRequests, acceptRequest, blockRequest } from '../services/connections';
import { getPublicProfilesByIds } from '../services/user-profiles';
import { getEquippedCosmeticsBatch } from '../services/cosmetics';
import { isAdmin } from '../services/admin';
import GoaldemyLogo from './GoaldemyLogo.vue';
import UserAvatar from './common/UserAvatar.vue';
import { getUnclaimedCount } from '../stores/notifications';
import { playNotifySound } from '../services/sounds';

export default {
  name: 'AppNavBar',
  components: {
    RouterLink,
    GoaldemyLogo,
    UserAvatar
  },
    data() {
        return {
            user: {
                id: null,
                email: null,
                avatar_url: null,
            },
            equipped: { frameKey: 'none', iconGlyph: '', iconBg: 'emerald', framePremium: false },
            isOpen: false,
            infoOpen: false,
            playOpen: false,
            leaguesOpen: false,
            _infoCloseTimer: null,
            _playCloseTimer: null,
            _leaguesCloseTimer: null,
            q: '',
            searchOpen: false,
            searching: false,
            results: [],
            resultCos: {},   // cosméticos equipados por id (para el ícono en resultados)
            menuOpen: false,
            levelInfo: null,
            levelLoading: false,
            _lastLevelAt: 0,
            notifCount: 0,
            _notifChannel: null,
            _connChannel: null,
            notifOpen: false,
            notifItems: [],
            notifLoading: false,
            notifProfiles: {},
            notifCos: {},    // cosméticos equipados por id (para el ícono del emisor)
            _notifCountDebounce: null,
            _notifMenuDebounce: null,
            isAdminUser: false,
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
                return;
            }
            this.levelLoading = true;
            try {
                await fetchLevelThresholds();
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
                    // Íconos reales de cada resultado (borde + ícono equipado)
                    try {
                        const ids = filtered.map(u => u.id).filter(Boolean)
                        this.resultCos = ids.length ? await getEquippedCosmeticsBatch(ids) : {}
                    } catch { this.resultCos = {} }
                }
            } finally {
                this.searching = false
                this.searchOpen = true
            }
        },
        // Props de avatar (ícono/borde equipado) para un usuario dado, listo para <UserAvatar>.
        avatarPropsFor(u, cosMap) {
            const c = (cosMap || {})[u?.id] || {}
            const name = u?.display_name || u?.username || u?.email || '?'
            return {
                avatarUrl: u?.avatar_url || '',
                initial: (name.trim()[0] || '?').toUpperCase(),
                frameKey: c.frameKey || 'none',
                iconGlyph: c.iconGlyph || '',
                iconBg: c.iconBg || 'emerald',
            }
        },
        userLabel(u) { return u?.display_name || u?.username || u?.email || 'Usuario' },
        goUser(u) {
            if (!u?.id) return
            this.q = ''
            this.results = []
            this.searchOpen = false
            this.$router.push(`/u/${u.id}`)
        },
        avatarInitial() {
            const name = this.user?.display_name || this.user?.email || '?'
            const letter = name.trim()[0] || '?'
            return letter.toUpperCase()
        },
        async loadEquipped() {
            const id = this.user?.id
            if (!id) { this.equipped = { frameKey: 'none', iconGlyph: '', iconBg: 'emerald', framePremium: false }; return }
            try {
                const { getEquippedCosmetics } = await import('../services/cosmetics')
                const e = await getEquippedCosmetics(id)
                if (e) this.equipped = { frameKey: e.frameKey || 'none', iconGlyph: e.iconGlyph || '', iconBg: e.iconBg || 'emerald', framePremium: !!e.framePremium }
            } catch { /* sin cosméticos: queda el default */ }
        },
        // Dropdown controls (less sensitive hover)
        onInfoEnter() {
            if (this._infoCloseTimer) { clearTimeout(this._infoCloseTimer); this._infoCloseTimer = null }
            this.infoOpen = true
            this.playOpen = false
            this.leaguesOpen = false
        },
        onInfoLeave() {
            if (this._infoCloseTimer) clearTimeout(this._infoCloseTimer)
            this._infoCloseTimer = setTimeout(() => { this.infoOpen = false }, 220)
        },
        onPlayEnter() {
            if (this._playCloseTimer) { clearTimeout(this._playCloseTimer); this._playCloseTimer = null }
            this.playOpen = true
            this.infoOpen = false
            this.leaguesOpen = false
        },
        onPlayLeave() {
            if (this._playCloseTimer) clearTimeout(this._playCloseTimer)
            this._playCloseTimer = setTimeout(() => { this.playOpen = false }, 220)
        },
        onLeaguesEnter() {
            if (this._leaguesCloseTimer) { clearTimeout(this._leaguesCloseTimer); this._leaguesCloseTimer = null }
            this.leaguesOpen = true
            this.infoOpen = false
            this.playOpen = false
        },
        onLeaguesLeave() {
            if (this._leaguesCloseTimer) clearTimeout(this._leaguesCloseTimer)
            this._leaguesCloseTimer = setTimeout(() => { this.leaguesOpen = false }, 220)
        },
        async loadNotifCount() {
            if (this._notifCountDebounce) clearTimeout(this._notifCountDebounce)
            this._notifCountDebounce = setTimeout(async () => {
                try {
                    // Unread notifications (excl. connection_request) + pending connection requests
                    const [{ count }, { data: incoming }] = await Promise.all([
                        fetchUnreadCount(),
                        listIncomingRequests(),
                    ])
                    const pending = (incoming || []).length
                    this.notifCount = (count || 0) + pending
                } catch { this.notifCount = 0 }
            }, 200)
        },
        setupNotifRealtime() {
            if (!this.user?.id) return
            if (this._notifChannel) { try { this._notifChannel.unsubscribe() } catch {} this._notifChannel = null }
            if (this._connChannel) { try { this._connChannel.unsubscribe() } catch {} this._connChannel = null }
            const ch = supabase.channel(`notifications:${this.user.id}`)
            ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `to_user=eq.${this.user.id}` }, () => {
                this.loadNotifCount()
                if (this.notifOpen) this.loadNotifMenu()
            })
            // Also react to updates (e.g., read status) to refresh badge when dropdown is open
            ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `to_user=eq.${this.user.id}` }, () => {
                if (this.notifOpen) this.loadNotifMenu()
            })
            ch.subscribe()
            this._notifChannel = ch

            // Connections realtime to reflect pending requests instantly
            const cch = supabase.channel(`connections:${this.user.id}`)
            // New incoming pending request
            cch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'connections', filter: `user_b=eq.${this.user.id}` }, () => {
                try { playNotifySound() } catch {}
                this.loadNotifCount(); if (this.notifOpen) this.loadNotifMenu()
            })
            // Status changes (pending -> accepted/blocked) should also refresh
            cch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'connections', filter: `user_b=eq.${this.user.id}` }, () => {
                this.loadNotifCount(); if (this.notifOpen) this.loadNotifMenu()
            })
            cch.subscribe()
            this._connChannel = cch
            // Fallback polling in case realtime is disabled
            try { clearInterval(this._pollInterval) } catch {}
            this._pollInterval = setInterval(() => this.loadNotifCount(), 20000)
        },
        async loadNotifMenu() {
            if (this._notifMenuDebounce) clearTimeout(this._notifMenuDebounce)
            this._notifMenuDebounce = setTimeout(async () => {
                if (!this.user?.id) return
                this.notifLoading = true
                try {
                    const [{ data: incoming }, { data: notifs }] = await Promise.all([
                        listIncomingRequests(),
                        listNotifications(12),
                    ])
                    // Map to consumable entries (requests)
                    const reqs = (incoming || []).map(r => ({
                        kind: 'request',
                        id: r.id,
                        from: r.user_a,
                        created_at: r.created_at,
                    }))
                    // Map notification logs we want to show in dropdown
                    const logs = (notifs || [])
                      .filter(n => n?.type && n.type !== 'connection_request')
                      .map(n => ({ kind: 'log', id: n.id, type: n.type, from: n.from_user, created_at: n.created_at, read: n.read, payload: n.payload }))
                    // Merge: requests first, then latest logs
                    const items = [...reqs, ...logs].slice(0, 12)
                    this.notifItems = items
                    // Fetch sender profiles for better text
                    const ids = Array.from(new Set(items.map(i => i.from).filter(Boolean)))
                    if (ids.length) {
                        const [{ data: profiles }, cos] = await Promise.all([
                            getPublicProfilesByIds(ids),
                            getEquippedCosmeticsBatch(ids).catch(() => ({})),
                        ])
                        const map = {}
                        for (const p of profiles || []) map[p.id] = p
                        this.notifProfiles = map
                        this.notifCos = cos || {}
                    } else {
                        this.notifProfiles = {}
                        this.notifCos = {}
                    }
                } finally {
                    this.notifLoading = false
                }
            }, 200)
        },
        // Al abrir el panel, marcar como leídas las notificaciones (no las solicitudes),
        // así el contador baja solo sin tener que pasar el cursor por cada una.
        async markVisibleRead() {
            const unread = (this.notifItems || []).filter(n => n.kind === 'log' && n.id && !n.read)
            if (!unread.length) return
            for (const n of unread) n.read = true
            try { await Promise.all(unread.map(n => markAsRead(n.id))) } catch {}
            this.loadNotifCount()
        },
        toggleNotif() {
            this.notifOpen = !this.notifOpen
            if (this.notifOpen) {
                this.menuOpen = false
                this.loadNotifMenu()
                // esperar a que cargue el menú y recién ahí marcar leídas
                setTimeout(() => { if (this.notifOpen) this.markVisibleRead() }, 500)
            }
        },
        nameFor(id) { const p = this.notifProfiles?.[id] || {}; return p.display_name || p.email || 'Usuario' },
        notifSender(n) { return this.notifProfiles?.[n?.from] || { id: n?.from } },
        fmtNotifLine(n) {
            // For request items
            const who = this.nameFor(n.from)
            return `${who} quiere conectarse con vos`
        },
        fmtLogSuffix(n) {
            if (n.type === 'friend_accepted') return `y vos ya son amigos 🎉`
            if (n.type === 'friend_added') return `te agregó como amigo 🤝`
            if (n.type === 'friend_removed') {
                const initiator = n?.payload?.initiator_id
                return initiator && initiator === this.user?.id ? `— cancelaste la conexión` : `dejó de seguirte`
            }
            return 'tuvo actividad'
        },
        fmtNotifWhen(ts) {
            const d = new Date(ts)
            const now = Date.now()
            const diffMs = now - d.getTime()
            const oneHour = 60 * 60 * 1000
            const oneDay = 24 * oneHour
            if (diffMs < oneDay) {
                if (diffMs < oneHour) {
                    const mins = Math.max(1, Math.round(diffMs / (60 * 1000)))
                    return `Hace ${mins}m`
                }
                const hrs = Math.max(1, Math.round(diffMs / oneHour))
                return `Hace ${hrs}h`
            }
            // mm/dd as per example (10/26)
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            return `${mm}/${dd}`
        },
        async acceptConn(id) {
            try { await acceptRequest(id); await this.loadNotifMenu(); await this.loadNotifCount() } catch {}
        },
        async rejectConn(id) {
            try { await blockRequest(id); await this.loadNotifMenu(); await this.loadNotifCount() } catch {}
        },
        async markNotif(n) {
            try { if (n?.kind==='log' && n.id && !n.read) { await markAsRead(n.id); n.read = true; await this.loadNotifCount() } } catch {}
        },
        async checkAdmin() {
            try {
                this.isAdminUser = await isAdmin();
            } catch (error) {
                console.error('Error verificando admin:', error);
                this.isAdminUser = false;
            }
        }
    },
    computed: {
        rewardCount() {
            return getUnclaimedCount()
        },
        progressPercent() {
            return computeProgressPercentSync(this.levelInfo);
        },
        xpNow() {
            return this.levelInfo?.xp_total ?? 0;
        },
        levelProgress() {
            return computeLevelProgress(this.levelInfo);
        }
    },
    mounted() {
                    subscribeToAuthStateChanges(userState => { this.user = userState; this.loadEquipped(); });
                    // Close menus on outside click
                    this._onDocClick = (e) => {
                        // Puede haber dos disparadores (avatar desktop + mobile): cerrar
                        // solo si el click cae fuera de TODOS los menús/botones de usuario.
                        const userMenus = Array.from(this.$el.querySelectorAll('[data-user-menu]'))
                        const userBtns = Array.from(this.$el.querySelectorAll('[data-user-button]'))
                        const insideUser = userMenus.some(m => m.contains(e.target)) || userBtns.some(b => b.contains(e.target))
                        if (this.menuOpen && !insideUser) {
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
                        const leaguesMenu = this.$el.querySelector('[data-leagues-menu]')
                        const leaguesBtn = this.$el.querySelector('[data-leagues-button]')
                        if (this.leaguesOpen && leaguesMenu && !leaguesMenu.contains(e.target) && leaguesBtn && !leaguesBtn.contains(e.target)) {
                            this.leaguesOpen = false
                        }
                    }
                    document.addEventListener('click', this._onDocClick)
                    this._onKeyDown = (e) => {
                        if (e.key === 'Escape') {
                            this.menuOpen = false
                            this.notifOpen = false
                            this.searchOpen = false
                            this.infoOpen = false
                            this.playOpen = false
                            this.leaguesOpen = false
                        }
                    }
                    document.addEventListener('keydown', this._onKeyDown)
                    // Watch menu open to fetch level lazily
                    this.$watch('menuOpen', (open) => { if (open) this.loadLevelIfNeeded() })
                    // Notifications: load and subscribe when auth ready.
                    // immediate:true → si el usuario ya estaba logueado al montar (sin F5),
                    // igual carga el contador y se suscribe (antes solo corría tras un cambio).
                    this.$watch(() => this.user?.id, async (id) => {
                        if (id) {
                            await this.loadNotifCount();
                            this.setupNotifRealtime();
                            this.checkAdmin();
                        }
                    }, { immediate: true })
                    // Clear search box when navigating to a user profile
                    this.$watch(() => this.$route.fullPath, (p) => {
                        if (p?.startsWith?.('/u/')) {
                            this.q = ''
                            this.results = []
                            this.searchOpen = false
                        }
                        this.infoOpen = false
                        this.playOpen = false
                        this.leaguesOpen = false
                        this.notifOpen = false
                    })
                    // Extend outside-click close for notifications
                    const orig = this._onDocClick
                    this._onDocClick = (e) => {
                        orig(e)
                        const menu = this.$el.querySelector('[data-notif-menu]')
                        const btn = this.$el.querySelector('[data-notif-button]')
                        if (this.notifOpen && menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
                            this.notifOpen = false
                        }
                    }
        },
        unmounted() {
            document.removeEventListener('click', this._onDocClick)
            document.removeEventListener('keydown', this._onKeyDown)
            try { if (this._notifChannel) this._notifChannel.unsubscribe() } catch {}
            try { if (this._connChannel) this._connChannel.unsubscribe() } catch {}
            try { clearInterval(this._pollInterval) } catch {}
            if (this._notifCountDebounce) clearTimeout(this._notifCountDebounce)
            if (this._notifMenuDebounce) clearTimeout(this._notifMenuDebounce)
    }
}
</script>

<template>
    <header class="sticky top-0 z-40">
        <div class="border-b border-white/10 bg-gradient-to-b from-slate-900/70 to-slate-900/30 backdrop-blur supports-[backdrop-filter]:bg-slate-900/40">
            <nav class="container mx-auto flex items-center justify-between px-4 py-4 gap-3">
                <RouterLink to="/" class="flex-none">
                    <GoaldemyLogo variant="full" size="sm" :animated="true" />
                </RouterLink>
                <!-- Mobile controls: notifications + menu button -->
                <div class="lg:hidden flex items-center gap-2 flex-1 justify-end">
                    <!-- Rewards icon (mobile) -->
                    <RouterLink to="/rewards" class="relative inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-slate-200 hover:border-white/20" aria-label="Recompensas">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
                        <span v-if="rewardCount>0" class="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white text-[11px] grid place-items-center">{{ rewardCount>9?'9+':rewardCount }}</span>
                    </RouterLink>
                    <!-- Notifications icon (mobile) -->
                    <button @click="$router.push('/notifications')" class="relative inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-slate-200 hover:border-white/20" aria-label="Notificaciones">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="text-slate-200"><path d="M14 18.5a2 2 0 1 1-4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 9a6 6 0 1 1 12 0c0 2.28.67 3.6 1.2 4.38.4.6.6.9.6 1.12 0 .83-.67 1.5-1.5 1.5H5.7A1.7 1.7 0 0 1 4 14.3c0-.22.2-.52.6-1.12C5.13 12.6 6 11.28 6 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        <span v-if="notifCount>0" class="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[11px] grid place-items-center">{{ notifCount>9?'9+':notifCount }}</span>
                    </button>
                    <!-- Menu button -->
                    <button @click="toggle" class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:border-white/20 hover:text-white">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span>Menú</span>
                    </button>
                </div>

                <ul class="hidden lg:flex items-center gap-4 text-slate-200">
                    <!-- Reto del día — entrada destacada (funnel público) -->
                    <li>
                        <RouterLink to="/reto" class="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-bold text-cyan-300 transition hover:border-cyan-300/60 hover:text-cyan-200 hover:bg-cyan-500/15">
                            <span class="relative flex h-2 w-2">
                                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                                <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
                            </span>
                            Reto del día
                        </RouterLink>
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
                                <RouterLink @click="playOpen=false" to="/reto" class="mt-1 block rounded-lg p-2 hover:bg-white/5">
                                    <div class="text-sm text-slate-100 font-medium">Reto del día</div>
                                    <p class="text-slate-400 text-xs">El desafío diario abierto para compartir. Sin login.</p>
                                </RouterLink>
                            </div>
                        </div>
                    </li>
                    <li><RouterLink class="hover:text-white transition-colors" to="/leaderboards">Ranking</RouterLink></li>
                    <li><RouterLink class="inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 transition-colors" to="/pricing"><span>⭐</span> Premium</RouterLink></li>
                    <!-- Ligas dropdown (hover) -->
                    <li class="relative"
                        @mouseenter="onLeaguesEnter"
                        @mouseleave="onLeaguesLeave">
                        <button data-leagues-button class="inline-flex items-center gap-1 px-0 py-1.5 text-slate-200 hover:text-white">
                            Ligas
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="text-slate-400"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                        </button>
                        <div v-if="leaguesOpen" data-leagues-menu class="absolute left-0 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden z-30"
                             @mouseenter="onLeaguesEnter" @mouseleave="onLeaguesLeave">
                            <!-- World Cup - Featured -->
                            <RouterLink @click="leaguesOpen=false" to="/leagues/world-cup" class="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold hover:bg-amber-500/10 text-amber-300 border-b border-white/10 bg-amber-500/5 transition-colors">
                                <svg class="w-5 h-5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3zm2.36 0l1.14 5h7l1.14-5H7.36zM4 9v1a4 4 0 003.5 3.97V15h9v-1.03A4 4 0 0020 10V9H4z"/></svg>
                                <div class="flex-1">
                                    <div>Copa del Mundo 2026</div>
                                    <div class="text-[10px] font-normal text-amber-400/70 uppercase tracking-wider">EN VIVO</div>
                                </div>
                                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            </RouterLink>
                            <!-- Paused domestic leagues -->
                            <div class="px-3 pt-3 pb-1">
                                <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ligas domésticas — Próximamente</span>
                            </div>
                            <div class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 cursor-default border-b border-white/5 opacity-50">
                                <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/dark/47.png" alt="Premier League" class="w-4 h-4 object-contain grayscale" />
                                Premier League
                            </div>
                            <div class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 cursor-default border-b border-white/5 opacity-50">
                                <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/dark/87.png" alt="La Liga" class="w-4 h-4 object-contain grayscale" />
                                La Liga
                            </div>
                            <div class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 cursor-default border-b border-white/5 opacity-50">
                                <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/dark/55.png" alt="Serie A" class="w-4 h-4 object-contain grayscale" />
                                Serie A
                            </div>
                            <div class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 cursor-default border-b border-white/5 opacity-50">
                                <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/dark/54.png" alt="Bundesliga" class="w-4 h-4 object-contain grayscale" />
                                Bundesliga
                            </div>
                            <div class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 cursor-default border-b border-white/5 opacity-50">
                                <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/dark/53.png" alt="Ligue 1" class="w-4 h-4 object-contain grayscale" />
                                Ligue 1
                            </div>
                            <div class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 cursor-default opacity-50">
                                <img src="https://images.fotmob.com/image_resources/logo/leaguelogo/dark/112.png" alt="Liga Profesional" class="w-4 h-4 object-contain grayscale" />
                                Liga Profesional
                            </div>
                        </div>
                    </li>
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
                            <RouterLink @click="infoOpen=false" to="/teams" class="block px-4 py-3 text-sm font-medium hover:bg-white/5 text-slate-200">Equipos y Jugadores</RouterLink>
                            <RouterLink @click="infoOpen=false" to="/about/me" class="block px-4 py-3 text-sm font-medium hover:bg-white/5 text-slate-200">¿Quién soy?</RouterLink>
                            <RouterLink @click="infoOpen=false" to="/about/goaldemy" class="block px-4 py-3 text-sm font-medium hover:bg-white/5 text-slate-200">¿Qué es Goaldemy?</RouterLink>
                            <RouterLink @click="infoOpen=false" to="/about/objetivo" class="block px-4 py-3 text-sm font-medium hover:bg-white/5 text-slate-200">Objetivo</RouterLink>
                        </div>
                    </li>
                    <!-- Search -->
                    <li class="relative w-44 xl:w-56">
                        <div class="relative" data-search-box>
                            <input type="search" v-model="q" @input="onSearchInput" placeholder="Buscar usuarios" class="searchbox w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20" />
                            <svg class="absolute right-2 top-1.5 h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        </div>
                        <div v-if="searchOpen" data-search-dropdown class="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl">
                            <ul>
                                <li v-for="u in results" :key="u.id" @click="goUser(u)" class="px-2.5 py-2 hover:bg-white/5 cursor-pointer text-sm flex items-center gap-2.5 rounded-lg">
                                    <UserAvatar :size="34" v-bind="avatarPropsFor(u, resultCos)" />
                                    <span class="truncate text-slate-100 font-medium">{{ userLabel(u) }}</span>
                                </li>
                                <li v-if="!results.length && !searching" class="px-3 py-2 text-slate-400 text-sm">Sin resultados</li>
                                <li v-if="searching" class="px-3 py-2 text-slate-400 text-sm">Buscando…</li>
                            </ul>
                        </div>
                    </li>
                    <!-- User dropdown / login button -->
                    <template v-if="user.id === null">
                            <li>
                                <RouterLink class="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-600" to="/login">
                                    Acceder
                                </RouterLink>
                            </li>
                    </template>
                    <template v-else>
                        <!-- Rewards icon -->
                        <li>
                            <RouterLink to="/rewards" class="relative inline-flex items-center justify-center rounded-full border border-white/10 px-2 py-1.5 hover:border-white/20 text-slate-200" aria-label="Recompensas">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
                                <span v-if="rewardCount>0" class="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white text-[11px] grid place-items-center">{{ rewardCount>9?'9+':rewardCount }}</span>
                            </RouterLink>
                        </li>
                        <!-- Shop icon -->
                        <li>
                            <RouterLink to="/tienda" class="relative inline-flex items-center justify-center rounded-full border border-white/10 px-2 py-1.5 hover:border-amber-400/40 text-slate-200" aria-label="Tienda">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                            </RouterLink>
                        </li>
                        <!-- Notifications dropdown -->
                        <li class="relative">
                            <button data-notif-button aria-label="Notificaciones" @click.stop="toggleNotif" class="relative inline-flex items-center justify-center rounded-full border border-white/10 px-2 py-1.5 hover:border-white/20">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="text-slate-200"><path d="M14 18.5a2 2 0 1 1-4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 9a6 6 0 1 1 12 0c0 2.28.67 3.6 1.2 4.38.4.6.6.9.6 1.12 0 .83-.67 1.5-1.5 1.5H5.7A1.7 1.7 0 0 1 4 14.3c0-.22.2-.52.6-1.12C5.13 12.6 6 11.28 6 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                                <span v-if="notifCount>0" class="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[11px] grid place-items-center">{{ notifCount>9?'9+':notifCount }}</span>
                            </button>
                            <div v-if="notifOpen" data-notif-menu class="absolute right-0 mt-2 w-96 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden z-50">
                                <div class="p-3">
                                    <h4 class="text-slate-400 text-xs uppercase tracking-wider mb-2">Notificaciones</h4>
                                    <div v-if="notifLoading" class="text-slate-400 text-sm">Cargando…</div>
                                    <div v-else-if="!notifItems.length" class="text-slate-400 text-sm">Sin notificaciones</div>
                                    <ul v-else class="flex flex-col gap-1.5 max-h-80 overflow-auto pr-1">
                                        <li v-for="n in notifItems" :key="n.id"
                                            class="relative rounded-xl border p-2.5 flex items-center gap-2.5 transition-colors"
                                            :class="(n.kind==='request' || !n.read) ? 'border-emerald-400/25 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.02]'">
                                            <router-link :to="`/u/${n.from}`" @click="notifOpen=false" class="shrink-0">
                                                <UserAvatar :size="40" v-bind="avatarPropsFor(notifSender(n), notifCos)" />
                                            </router-link>
                                            <!-- Requests -->
                                            <template v-if="n.kind==='request'">
                                                <div class="min-w-0 flex-1">
                                                    <div class="text-slate-100 text-[13px] leading-snug">
                                                        <router-link :to="`/u/${n.from}`" @click="notifOpen=false" class="font-bold text-white hover:underline">{{ nameFor(n.from) }}</router-link>
                                                        <span class="text-slate-300">&nbsp;quiere ser tu amigo</span>
                                                    </div>
                                                    <div class="text-[11px] text-slate-500 mt-0.5">{{ fmtNotifWhen(n.created_at) }}</div>
                                                </div>
                                                <div class="flex items-center gap-1 shrink-0">
                                                    <button @click.stop="acceptConn(n.id)" title="Aceptar" class="inline-flex items-center justify-center rounded-full bg-emerald-500 text-white hover:brightness-110 w-8 h-8 shadow-lg shadow-emerald-500/25 transition active:scale-95">
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                                    </button>
                                                    <button @click.stop="rejectConn(n.id)" title="Rechazar" class="inline-flex items-center justify-center rounded-full border border-white/15 text-slate-400 hover:text-white hover:border-white/30 w-8 h-8 transition active:scale-95">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                                    </button>
                                                </div>
                                            </template>
                                            <!-- Logs -->
                                            <template v-else>
                                                <div class="min-w-0 flex-1">
                                                    <div class="text-slate-100 text-[13px] leading-snug">
                                                        <router-link :to="`/u/${n.from}`" @click="notifOpen=false" class="font-bold text-white hover:underline">{{ nameFor(n.from) }}</router-link>
                                                        <span class="text-slate-300">&nbsp;{{ fmtLogSuffix(n) }}</span>
                                                    </div>
                                                    <div class="text-[11px] text-slate-500 mt-0.5">{{ fmtNotifWhen(n.created_at) }}</div>
                                                </div>
                                                <span v-if="!n.read" class="shrink-0 h-2 w-2 rounded-full bg-emerald-400"></span>
                                            </template>
                                        </li>
                                    </ul>
                                    <div class="mt-3 flex justify-end">
                                        <router-link @click="notifOpen=false" to="/notifications" class="text-slate-300 hover:text-white text-sm">Ver todas</router-link>
                                    </div>
                                </div>
                            </div>
                        </li>
                        <!-- User avatar dropdown (desktop) -->
                        <li class="relative">
                            <button data-user-button aria-label="Menú de usuario" @click.stop="menuOpen = !menuOpen" class="inline-flex items-center rounded-full hover:opacity-90 hover:scale-105 transition active:scale-95">
                                <UserAvatar :size="38" :avatar-url="user.avatar_url" :initial="avatarInitial()" :frame-key="equipped.frameKey" :icon-glyph="equipped.iconGlyph" :icon-bg="equipped.iconBg" :frame-premium="equipped.framePremium" />
                            </button>
                            <div v-if="menuOpen" data-user-menu class="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden z-50">
                                <!-- Cabecera: avatar + nivel/XP -->
                                <div class="px-3 py-3 border-b border-white/10">
                                    <div class="flex items-center gap-2.5">
                                        <UserAvatar :size="40" :avatar-url="user.avatar_url" :initial="avatarInitial()" :frame-key="equipped.frameKey" :icon-glyph="equipped.iconGlyph" :icon-bg="equipped.iconBg" :frame-premium="equipped.framePremium" />
                                        <div class="min-w-0">
                                            <div class="font-display font-bold text-white truncate leading-tight">{{ user.display_name || user.email || 'Mi cuenta' }}</div>
                                            <div class="text-[11px] text-slate-400">Nivel {{ levelInfo?.level ?? 1 }} · {{ xpNow }} XP</div>
                                        </div>
                                    </div>
                                    <div class="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (progressPercent||0) + '%' }"></div>
                                    </div>
                                </div>
                                <RouterLink @click="menuOpen=false" to="/profile" class="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/5 text-slate-200 transition-colors">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Ver perfil
                                </RouterLink>
                                <RouterLink @click="menuOpen=false" to="/profile-edit" class="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/5 text-slate-200 transition-colors">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"/></svg>
                                    Personalizar perfil
                                </RouterLink>
                                <RouterLink v-if="isAdminUser" @click="menuOpen=false" to="/admin" class="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-amber-500/10 text-amber-400 border-t border-white/10 transition-colors">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z"/></svg>
                                    Panel Admin
                                </RouterLink>
                                <button @click="handleLogout" class="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-sm hover:bg-rose-500/10 hover:text-rose-300 text-slate-200 border-t border-white/10 transition-colors">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
                                    Cerrar sesión
                                </button>
                            </div>
                        </li>
                    </template>
                </ul>
            </nav>

            <!-- Mobile header menu options -->
            <transition name="fade-slide">
                <div v-if="isOpen" class="lg:hidden border-t border-white/10">
                    <ul class="container mx-auto px-4 py-3 flex flex-col gap-3 text-slate-200">
                        <!-- Row: searchbar - user dropdown -->
                        <li>
                            <div class="flex items-center gap-2">
                                <div class="relative flex-1" data-search-box>
                                    <input type="search" v-model="q" @input="onSearchInput" placeholder="Buscar usuarios" class="searchbox w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20" />
                                    <div v-if="searchOpen" data-search-dropdown class="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl">
                                        <ul>
                                            <li v-for="u in results" :key="u.id" @click="isOpen=false; goUser(u)" class="px-2.5 py-2 hover:bg-white/5 cursor-pointer text-sm flex items-center gap-2.5 rounded-lg">
                                                <UserAvatar :size="34" v-bind="avatarPropsFor(u, resultCos)" />
                                                <span class="truncate text-slate-100 font-medium">{{ userLabel(u) }}</span>
                                            </li>
                                            <li v-if="!results.length && !searching" class="px-3 py-2 text-slate-400 text-sm">Sin resultados</li>
                                            <li v-if="searching" class="px-3 py-2 text-slate-400 text-sm">Buscando…</li>
                                        </ul>
                                    </div>
                                </div>

                                <div class="relative flex-none">
                                    <template v-if="user.id === null">
                                        <RouterLink @click="isOpen=false" to="/login" class="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-slate-200 hover:border-white/20">Acceder</RouterLink>
                                    </template>
                                    <template v-else>
                                        <button data-user-button aria-label="Menú de usuario" @click.stop="menuOpen = !menuOpen" class="inline-flex items-center gap-2 rounded-full border border-white/10 px-2 py-1.5 text-sm text-slate-200 hover:border-white/20">
                                            <UserAvatar :size="28" :avatar-url="user.avatar_url" :initial="avatarInitial()" :frame-key="equipped.frameKey" :icon-glyph="equipped.iconGlyph" :icon-bg="equipped.iconBg" :frame-premium="equipped.framePremium" />
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="text-slate-400"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                                        </button>
                                        <div v-if="menuOpen" data-user-menu class="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden z-50">
                                            <div class="px-3 py-3 border-b border-white/10">
                                                <div v-if="!levelInfo && levelLoading" class="mt-1 h-2 rounded bg-white/10 overflow-hidden">
                                                    <div class="h-full w-1/3 bg-emerald-500 animate-pulse"></div>
                                                </div>
                                                <div v-else-if="levelInfo">
                                                    <div class="mt-1 flex items-center justify-between text-xs text-slate-300">
                                                        <span>Nivel {{ levelInfo.level ?? 1 }}</span>
                                                        <span class="text-slate-200 font-medium">{{ xpNow }} XP</span>
                                                    </div>
                                                    <div class="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                                        <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" :style="{ width: (progressPercent||0) + '%' }"></div>
                                                    </div>
                                                    <div class="mt-1 text-[11px] text-slate-400">
                                                        <template v-if="levelInfo.level >= 30">Nivel máximo alcanzado</template>
                                                        <template v-else>{{ levelProgress.earned }}/{{ levelProgress.range }} XP</template>
                                                    </div>
                                                </div>
                                                <div v-else>
                                                    <div class="mt-1 flex items-center justify-between text-xs text-slate-300">
                                                        <span>Nivel 1</span>
                                                        <span class="text-slate-200 font-medium">0 XP</span>
                                                    </div>
                                                    <div class="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                                        <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700" style="width: 0%"></div>
                                                    </div>
                                                    <div class="mt-1 text-[11px] text-slate-400">Jugá para ganar XP</div>
                                                </div>
                                            </div>
                                            <RouterLink @click="isOpen=false; menuOpen=false" to="/profile" class="block px-3 py-2 text-sm hover:bg-white/5 text-slate-200">Ver Perfil</RouterLink>
                                            <RouterLink v-if="isAdminUser" @click="isOpen=false; menuOpen=false" to="/admin" class="block px-3 py-2 text-sm hover:bg-amber-500/10 text-amber-400 border-t border-white/10">
                                                Panel Admin
                                            </RouterLink>
                                            <button @click="handleLogout" class="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-slate-200">Cerrar sesión</button>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </li>

                        <!-- Nav items -->
                        <li>
                            <RouterLink @click="isOpen=false" to="/reto" class="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2.5 font-bold text-cyan-300 hover:bg-cyan-500/15">
                                <span class="relative flex h-2 w-2">
                                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                                    <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
                                </span>
                                Reto del día
                            </RouterLink>
                        </li>
                        <li>
                            <details class="group">
                                <summary class="cursor-pointer hover:text-white">Jugar</summary>
                                <ul class="mt-1 pl-3 flex flex-col gap-1 text-slate-300">
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/play/points">Jugar por puntos</RouterLink></li>
                                    <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/reto">Reto del día</RouterLink></li>
                                </ul>
                            </details>
                        </li>
                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/leaderboards">Ranking</RouterLink></li>
                        <li><RouterLink @click="isOpen=false" class="flex items-center gap-1.5 font-semibold text-amber-300 hover:text-amber-200" to="/pricing"><span>⭐</span> Premium</RouterLink></li>
                        <li>
                            <details class="group">
                                <summary class="cursor-pointer hover:text-white">Ligas</summary>
                                <ul class="mt-1 pl-3 flex flex-col gap-1 text-slate-300">
                                    <li><RouterLink @click="isOpen=false" class="flex items-center gap-2 text-amber-300 font-semibold hover:text-amber-200" to="/leagues/world-cup"><svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3h14l-1.5 5H20a1 1 0 011 1v1a5 5 0 01-3.5 4.77V16a1 1 0 01-1 1h-1.1l.6 3H8l.6-3H7.5a1 1 0 01-1-1v-1.23A5 5 0 013 10V9a1 1 0 011-1h2.5L5 3zm2.36 0l1.14 5h7l1.14-5H7.36zM4 9v1a4 4 0 003.5 3.97V15h9v-1.03A4 4 0 0020 10V9H4z"/></svg> Copa del Mundo 2026</RouterLink></li>
                                    <li class="mt-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Próximamente</li>
                                    <li class="text-slate-500 cursor-default opacity-50">Premier League</li>
                                    <li class="text-slate-500 cursor-default opacity-50">La Liga</li>
                                    <li class="text-slate-500 cursor-default opacity-50">Serie A</li>
                                    <li class="text-slate-500 cursor-default opacity-50">Bundesliga</li>
                                    <li class="text-slate-500 cursor-default opacity-50">Ligue 1</li>
                                    <li class="text-slate-500 cursor-default opacity-50">Liga Profesional</li>
                                </ul>
                            </details>
                        </li>
                        <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/notifications">Notificaciones</RouterLink></li>
                                                <li>
                                                    <details class="group">
                                                        <summary class="cursor-pointer hover:text-white">Info</summary>
                                                        <ul class="mt-1 pl-3 flex flex-col gap-1 text-slate-300">
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/teams">Equipos y Jugadores</RouterLink></li>
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/about/me">¿Quién soy?</RouterLink></li>
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/about/goaldemy">¿Qué es Goaldemy?</RouterLink></li>
                                                            <li><RouterLink @click="isOpen=false" class="block hover:text-white" to="/about/objetivo">Objetivo</RouterLink></li>
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
