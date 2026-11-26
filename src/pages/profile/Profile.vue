<script>
/**
 * PERFIL (diseño V4 · V4Perfil.dc.html)
 * Vestuario primero (banner, ícono + borde, título), nivel, las tres medallas
 * (Logros · Rango · Racha) y, pegadas a ellas, las cuatro tarjetas con la info
 * real del perfil: Sobre (país, amigos, redes, bio) · Favoritos · Logros
 * destacados · Su juego. Sin Fichas/Balones ni "últimos jugados".
 * Sirve para /profile (el tuyo) y /u/:id (el de otro).
 */
import { subscribeToAuthStateChanges } from '../../services/auth';
import { getUserLevel, fetchLevelThresholds, resolveLevelProgress, getUserMaxStreakByGame } from '../../services/xp';
import { getUserAchievements, getAchievementsCatalog } from '../../services/achievements';
import { getUserXpByGame, friendlyNameForSlug } from '../../services/games';
import { getPublicProfile, updateFeaturedAchievements, getPublicProfilesByIds } from '../../services/user-profiles';
import { getStatusWith, sendRequest, disconnectWith, listConnections } from '../../services/connections';
import { pushErrorToast, pushSuccessToast } from '../../stores/notifications';
import { checkAndUnlockSpecials } from '../../services/special-badges';
import { findTeamByName, findPlayerByName } from '../../services/players';
import { getEquippedCosmetics, titleClass } from '../../services/cosmetics';
import BannerScene from '../../components/common/BannerScene.vue';
import { getPlanBadge } from '../../services/premium';
import { getTierForLevel, tierGlow } from '../../services/tiers';
import { achievementIcon } from '../../services/achievement-icons';
import { GAME_ART, GAME_POSTER_META, BALL_SVG } from '../../services/game-art';
import { supabase } from '../../services/supabase';
import { tap } from '../../services/haptics';
import { RARITY as ACH_RARITY } from '../../components/achievements/logros-data';
import AchievementMedal from '../../components/achievements/AchievementMedal.vue';
import FeaturedAchievementsModal from '../../components/profile/FeaturedAchievementsModal.vue';
import ReferralCard from '../../components/profile/ReferralCard.vue';
import UserAvatar from '../../components/common/UserAvatar.vue';

let unsubscribeAuth = () => {};

const POSITION_LABEL = { 0: 'Arquero', 1: 'Defensor', 2: 'Mediocampista', 3: 'Delantero' };
const regionNames = (() => { try { return new Intl.DisplayNames(['es'], { type: 'region' }) } catch { return null } })();

export default {
  name: 'Profile',
  components: { AchievementMedal, BannerScene, FeaturedAchievementsModal, ReferralCard, UserAvatar },
  data() {
    return {
      user: { id: null, email: null, display_name: null, bio: null },
      currentAuthId: null,
      levelInfo: null,
      levelLoading: true,
      equippedFrameKey: 'none',
      equippedTitleText: '',
      equippedIconGlyph: '',
      equippedBannerKey: 'default',
      equippedIconBg: 'emerald',
      equippedFramePremium: false,
      equippedBannerPremium: false,
      equippedTitleRarity: 'common',
      equippedTitlePremium: false,
      equippedDailyStreak: 0,
      equippedFrameLevel: null,
      viewedPlanSlug: 'free',
      achievements: [],
      achTotal: 0,
      achLoading: true,
      xpByGame: [],
      maxStreaks: [],
      streaksMap: {},
      dailyStreak: null,
      favTeamLogo: '',
      favTeamId: '',
      favPlayerImage: '',
      favPlayerPos: '',
      socials: [],
      conn: { state: 'none', row: null },
      connBusy: false,
      connectionsList: [],
      connectionsLoading: false,
      _loading: false,
      _lastLoadedUserId: null,
      _debounceTimer: null,
      featuredAchievements: [],
      showFeaturedModal: false,
      ACH_RARITY,
    };
  },
  computed: {
    titleCls() { return titleClass(this.equippedTitleRarity, this.equippedTitlePremium) },
    avatarInitial() {
      const n = (this.user?.display_name || this.user?.email || '').trim()
      return n ? n[0].toUpperCase() : '?'
    },
    displayName() { return this.user?.display_name || (this.user?.email ? this.user.email.split('@')[0] : '') || '—' },
    isSelf() { return (this.$route.params.id || this.currentAuthId) === this.currentAuthId },
    canConnect() { return !this.isSelf && !!this.currentAuthId && !!this.user?.id },
    level() { return Number(this.levelInfo?.level) || 1 },
    levelProgress() { return resolveLevelProgress(this.levelInfo) },
    levelPct() { return this.levelProgress.percent || 0 },
    levelXpText() {
      const p = this.levelProgress
      if (!p.range || p.xpToNext == null) return ''
      const nf = new Intl.NumberFormat('es-AR')
      return `${nf.format(p.range - p.xpToNext)} / ${nf.format(p.range)} XP`
    },
    nextLevel() { return this.level >= 100 ? null : this.level + 1 },
    tier() { return getTierForLevel(this.level) },
    tierColor() { return tierGlow(this.tier) },
    planBadge() {
      if (this.viewedPlanSlug === 'legend') return { label: 'LEGEND', bg: 'linear-gradient(180deg,#fcd34d,#b45309)', color: '#1c1206' }
      if (this.viewedPlanSlug === 'pro') return { label: 'PRO', bg: 'linear-gradient(180deg,#e879f9,#a21caf)', color: '#fff' }
      return null
    },
    countryCode() { return (this.user?.nationality_code || '').toLowerCase() },
    countryName() {
      const c = this.countryCode
      if (!c || c.length !== 2) return ''
      try { return regionNames?.of(c.toUpperCase()) || '' } catch { return '' }
    },
    friendsCount() { return this.connectionsList.length },
    featured() {
      const all = (this.achievements || []).slice().sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))
      const byCode = new Map(all.map(a => [a?.achievements?.code, a]))
      const picked = (this.featuredAchievements || []).map(c => byCode.get(c)).filter(Boolean)
      return (picked.length ? picked : all).slice(0, 3).map(a => {
        const code = a.achievements.code
        const { icon, rarity } = achievementIcon(code)
        return { code, name: a.achievements.name || code, icon, rarity: ACH_RARITY[rarity] ? rarity : 'common' }
      })
    },
    topGame() {
      const g = (this.xpByGame || []).filter(r => (r.xp || 0) > 0 && r.id !== 'unknown').sort((a, b) => (b.xp || 0) - (a.xp || 0))[0]
      if (!g) return null
      let slug = GAME_ART[g.id] ? g.id : ''
      if (!slug) slug = Object.keys(GAME_ART).find(s => friendlyNameForSlug(s) === g.name) || ''
      const meta = GAME_POSTER_META[slug] || null
      return {
        name: g.name || friendlyNameForSlug(slug),
        xp: g.xp || 0,
        art: slug ? GAME_ART[slug] : BALL_SVG,
        bg: meta ? `linear-gradient(160deg, ${meta.c1}, ${meta.c2})` : 'linear-gradient(160deg,#334155,#0f172a)',
        streak: this.streaksMap[g.id] || 0,
      }
    },
    medals() {
      return [
        { key: 'logros', to: this.isSelf ? '/logros' : null, label: 'Logros', value: this.achLoading ? '–' : `${this.achievements.length} / ${this.achTotal || '–'}`, big: this.achLoading ? '–' : String(this.achievements.length) },
        { key: 'racha', to: this.isSelf ? '/racha' : null, label: 'Racha', value: this.dailyStreak == null ? '–' : `${this.dailyStreak} ${this.dailyStreak === 1 ? 'día' : 'días'}`, big: this.dailyStreak == null ? '–' : String(this.dailyStreak) },
      ]
    },
  },
  mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges((userState) => {
      this.currentAuthId = userState?.id || null
      this.ensureLoad()
    });
    this.ensureLoad()
    this.$watch(() => this.$route.params.id, () => this.ensureLoad())
  },
  unmounted() {
    unsubscribeAuth();
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  },
  methods: {
    ensureLoad() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this._doLoad(), 50);
    },
    async _doLoad() {
      const targetId = this.$route.params.id || this.currentAuthId
      if (this._loading || targetId === this._lastLoadedUserId) return;
      if (!targetId) { this._lastLoadedUserId = null; return }
      this._loading = true
      this._lastLoadedUserId = targetId
      try { await this.loadFor(targetId) } finally { this._loading = false }
    },
    async loadFor(userId) {
      const isSelf = (this.$route.params.id || this.currentAuthId) === this.currentAuthId
      this.levelLoading = true
      this.achLoading = true

      const loadIdentity = async () => {
        try {
          const { data: profile, error } = await getPublicProfile(userId)
          if (error) console.error('[Profile] getPublicProfile:', error)
          this.user = profile ? { ...profile, id: userId } : { id: userId }
          this.featuredAchievements = profile?.featured_achievements || []
          try {
            const team = this.user?.favorite_team ? findTeamByName(this.user.favorite_team) : null
            this.favTeamLogo = team?.logo || ''
            this.favTeamId = team?.id || ''
          } catch {}
          try {
            const player = this.user?.favorite_player ? findPlayerByName(this.user.favorite_player) : null
            this.favPlayerImage = player?.image || ''
            this.favPlayerPos = POSITION_LABEL[player?.positionId] || ''
          } catch {}
          const s = []
          if (this.user?.instagram_url) s.push({ type: 'instagram', url: this.user.instagram_url, label: 'Instagram' })
          if (this.user?.x_url) s.push({ type: 'x', url: this.user.x_url, label: 'X' })
          if (this.user?.linkedin_url) s.push({ type: 'linkedin', url: this.user.linkedin_url, label: 'LinkedIn' })
          if (this.user?.github_url) s.push({ type: 'github', url: this.user.github_url, label: 'GitHub' })
          this.socials = s
        } catch (e) {
          console.error('[Profile] getPublicProfile exception:', e)
          this.user = { id: userId }
        }
      }
      const loadCosmeticsAndPlan = async () => {
        try {
          const eq = await getEquippedCosmetics(userId)
          this.equippedFrameKey = eq.frameKey
          this.equippedTitleText = eq.titleText
          this.equippedIconGlyph = eq.iconGlyph
          this.equippedBannerKey = eq.bannerKey
          this.equippedIconBg = eq.iconBg
          this.equippedFramePremium = eq.framePremium
          this.equippedBannerPremium = eq.bannerPremium
          this.equippedTitleRarity = eq.titleRarity || 'common'
          this.equippedTitlePremium = !!eq.titlePremium
          this.equippedDailyStreak = eq.dailyStreak || 0
          this.equippedFrameLevel = eq.frameLevel ?? null
        } catch {}
        try { this.viewedPlanSlug = (await getPlanBadge(userId)).plan || 'free' } catch { this.viewedPlanSlug = 'free' }
      }
      const loadLevel = async () => {
        try {
          await fetchLevelThresholds().catch(() => {})
          const { data, error } = await getUserLevel(userId)
          if (error) console.error('[Profile] getUserLevel:', error)
          this.levelInfo = Array.isArray(data) ? data[0] : data
        } catch { this.levelInfo = null } finally { this.levelLoading = false }
      }
      const loadAchievements = async () => {
        try {
          const [{ data: ach }, catalog] = await Promise.all([getUserAchievements(userId), getAchievementsCatalog().catch(() => ({}))])
          const codes = new Set(Object.keys(catalog || {}))
          // Solo los logros del catálogo activo (los retirados no suman al X / total)
          this.achievements = (ach || []).filter(r => !codes.size || !r?.achievements?.code || codes.has(r.achievements.code))
          this.achTotal = codes.size
        } catch { this.achievements = [] } finally { this.achLoading = false }
      }
      const loadXpByGame = async () => {
        try { const { data } = await getUserXpByGame(userId); this.xpByGame = data || [] } catch { this.xpByGame = [] }
      }
      const loadMaxStreaks = async () => {
        try {
          const { data } = await getUserMaxStreakByGame(userId)
          this.maxStreaks = data || []
          const map = {}
          for (const r of this.maxStreaks) if (r && r.id) map[r.id] = r.streak || 0
          this.streaksMap = map
        } catch { this.maxStreaks = []; this.streaksMap = {} }
      }
      const loadDailyStreak = async () => {
        try {
          const { data } = await supabase.from('user_profiles').select('daily_streak').eq('id', userId).maybeSingle()
          this.dailyStreak = Number(data?.daily_streak) || 0
        } catch { this.dailyStreak = null }
      }

      await Promise.all([
        loadIdentity(), loadCosmeticsAndPlan(), loadLevel(), loadAchievements(),
        loadXpByGame(), loadMaxStreaks(), loadDailyStreak(),
        this.loadConnections(userId).catch(() => {}),
      ])

      // Dependiente: necesita xpByGame/maxStreaks ya resueltos arriba.
      try {
        const res = await checkAndUnlockSpecials(userId, this.xpByGame, this.maxStreaks, isSelf)
        const r = res?.results || {}
        if ([r.streak_dual_100, r.xp_multi_5k_3].some(x => x && x.data === true)) {
          const { data: ach } = await getUserAchievements(userId)
          this.achievements = ach || this.achievements
        }
      } catch {}
      if (!isSelf) { try { await this.refreshConn() } catch {} }
    },
    async refreshConn() {
      if (!this.user?.id) return
      try { this.conn = await getStatusWith(this.user.id) } catch {}
    },
    async onConnect() {
      if (!this.canConnect) return
      tap()
      if (this.conn?.state === 'pending_in') { this.$router.push('/notifications'); return }
      if (this.conn?.state === 'connected') { this.$router.push('/messages/' + this.user.id); return }
      if (this.conn?.state === 'pending_out') return
      this.connBusy = true
      try { await sendRequest(this.user.id); await this.refreshConn() } catch (e) { pushErrorToast(e?.message || 'No se pudo conectar') } finally { this.connBusy = false }
    },
    async onDisconnect() {
      if (!this.canConnect) return
      this.connBusy = true
      try { await disconnectWith(this.user.id); await this.refreshConn(); await this.loadConnections(this.user.id) } catch (e) { pushErrorToast(e?.message || 'No se pudo desconectar') } finally { this.connBusy = false }
    },
    async loadConnections(userId) {
      this.connectionsLoading = true
      try {
        const { data: rows } = await listConnections(userId)
        const others = (rows || []).map(r => (r.user_a === userId ? r.user_b : r.user_a)).filter(Boolean)
        if (!others.length) { this.connectionsList = []; return }
        const { data: profiles } = await getPublicProfilesByIds(others)
        this.connectionsList = profiles || []
      } finally { this.connectionsLoading = false }
    },
    haptic() { tap() },
    go(to) { if (!to) return; tap(); this.$router.push(to) },
    async saveFeaturedAchievements(codes) {
      try {
        await updateFeaturedAchievements(this.currentAuthId, codes)
        this.featuredAchievements = codes
        this.showFeaturedModal = false
        pushSuccessToast('Logros destacados actualizados')
      } catch (e) {
        console.error('[Profile] save featured:', e)
        pushErrorToast('Error al guardar logros destacados')
      }
    },
  },
};
</script>

<template>
  <div class="pf relative -mx-6 -mt-10 lg:mx-auto lg:mt-0 lg:max-w-xl pb-6">
    <!-- Banner equipado -->
    <BannerScene role="region" aria-label="Banner equipado" class="h-[168px] lg:rounded-b-3xl" :style-key="equippedBannerKey" :premium="equippedBannerPremium" contain :top-reserve="58">
      <div class="absolute top-3.5 left-3.5 right-3.5 flex justify-end gap-2">
        <template v-if="isSelf">
          <RouterLink to="/coleccion" class="pf-chip min-h-[44px] px-3.5 rounded-full flex items-center gap-1.5 text-[13px] font-bold text-white" @click="haptic">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>Vestuario
          </RouterLink>
          <RouterLink to="/profile-edit" aria-label="Editar perfil" class="pf-chip w-11 h-11 rounded-full grid place-items-center text-white" @click="haptic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
          </RouterLink>
        </template>
        <template v-else-if="canConnect">
          <button v-if="conn.state === 'connected'" type="button" class="pf-chip min-h-[44px] px-3.5 rounded-full text-[13px] font-bold text-white" @click="onConnect">Mensaje</button>
          <button type="button" :disabled="connBusy || conn.state === 'pending_out'"
            :aria-label="conn.state === 'connected' ? 'Dejar de ser amigos' : conn.state === 'pending_out' ? 'Solicitud enviada' : conn.state === 'pending_in' ? 'Responder solicitud' : 'Agregar amigo'"
            class="pf-chip min-w-[44px] h-11 px-3 rounded-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-white disabled:opacity-60"
            @click="conn.state === 'connected' ? onDisconnect() : onConnect()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="4" /><path d="M2 21c1-4 3.6-6 7-6s6 2 7 6" /><path v-if="conn.state === 'connected'" d="M16 11h6" /><path v-else-if="conn.state === 'none'" d="M19 8v6M16 11h6" /><path v-else d="M16.5 11.5l2 2 3.5-4" /></svg>
            <span v-if="conn.state === 'pending_out'">Enviada</span>
            <span v-else-if="conn.state === 'pending_in'">Responder</span>
          </button>
        </template>
      </div>
    </BannerScene>

    <!-- Identidad: ícono + borde, nombre y título -->
    <section aria-label="Identidad" class="relative -mt-[54px] flex flex-col items-center text-center px-4">
      <span class="relative">
        <UserAvatar :size="108" :avatar-url="user.avatar_url || ''" :initial="avatarInitial" :frame-key="equippedFrameKey" :icon-glyph="equippedIconGlyph" :icon-bg="equippedIconBg" :frame-premium="equippedFramePremium"
          :level="equippedFrameLevel ?? (Number(levelInfo?.level) || null)" :streak="equippedDailyStreak" class="pf-avatar" />
        <span v-if="planBadge" class="pf-plan" :style="{ background: planBadge.bg, color: planBadge.color }">{{ planBadge.label }}</span>
      </span>
      <h1 class="mt-4 font-display font-bold text-2xl leading-[1.1] text-slate-100 max-w-full truncate">{{ displayName }}</h1>
      <span v-if="equippedTitleText" class="pf-title mt-2 text-[17px]" :class="titleCls">{{ equippedTitleText }}</span>
    </section>

    <!-- Nivel -->
    <section aria-label="Nivel" class="mx-[18px] mt-3.5 flex items-center gap-2.5">
      <span class="pf-lvl">NV {{ level }}</span>
      <span class="relative flex-1 h-[18px] rounded-full bg-white/[0.08] border border-white/10 overflow-hidden block" role="progressbar" :aria-valuenow="levelPct" aria-valuemin="0" aria-valuemax="100" :aria-label="`Progreso al nivel ${nextLevel || level}`">
        <span class="pf-xpfill block h-full" :style="{ width: (levelLoading ? 0 : levelPct) + '%' }"></span>
        <span class="absolute inset-0 grid place-items-center font-bug font-extrabold text-[13px] [text-shadow:0_1px_2px_#000]">{{ levelXpText }}</span>
      </span>
      <span v-if="nextLevel" class="font-bug font-extrabold text-base text-slate-500">{{ nextLevel }}</span>
    </section>

    <!-- Medallas: Logros · Rango · Racha (el rango lleva a El camino) -->
    <section aria-label="Tus números" class="relative mt-4 h-[172px] flex justify-center items-start gap-[23px]">
      <component :is="medals[0].to ? 'button' : 'div'" type="button" class="pf-medal mt-[22px]" @click="go(medals[0].to)" :aria-label="`Logros: ${medals[0].value}`">
        <span class="pf-disc w-20 h-20" style="background: radial-gradient(circle at 50% 35%, #c084fc, #7e22ce); box-shadow: 0 8px 24px rgba(168,85,247,0.35)"><span class="pf-big">{{ medals[0].big }}</span></span>
        <span class="text-[11px] text-slate-400">{{ medals[0].label }}</span>
        <span class="font-bug font-extrabold text-base leading-none">{{ medals[0].value }}</span>
      </component>
      <button type="button" class="pf-medal" :aria-label="`Rango ${tier?.label}. Ver El camino`" @click="go('/camino')">
        <span class="pf-disc pf-rank w-32 h-32" :style="{ boxShadow: `0 8px 24px ${tierColor}66` }">
          <img v-if="tier" :src="tier.image" alt="" width="64" height="74" class="w-16 h-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
        </span>
        <span class="text-[11px] text-slate-400">Rango</span>
        <span class="font-bug font-extrabold text-base leading-none flex items-center gap-0.5">{{ tier?.label }}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-amber-400" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
      </button>
      <component :is="medals[1].to ? 'button' : 'div'" type="button" class="pf-medal mt-[22px]" @click="go(medals[1].to)" :aria-label="`Racha: ${medals[1].value}`">
        <span class="pf-disc w-20 h-20" style="background: radial-gradient(circle at 50% 35%, #fb923c, #c2410c); box-shadow: 0 8px 24px rgba(249,115,22,0.35)"><span class="pf-big">{{ medals[1].big }}</span></span>
        <span class="text-[11px] text-slate-400">{{ medals[1].label }}</span>
        <span class="font-bug font-extrabold text-base leading-none">{{ medals[1].value }}</span>
      </component>
    </section>

    <!-- Las 4 tarjetas, pegadas al bloque del rango -->
    <div class="flex flex-col gap-3 -mt-1">
      <!-- 1 · Sobre -->
      <section :aria-label="`Sobre ${displayName}`" class="pf-card mx-3.5 flex flex-col gap-2.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span v-if="countryName" class="pf-pill h-[30px] pl-2 pr-3">
            <img :src="`https://flagcdn.com/w40/${countryCode}.png`" alt="" width="20" height="14" class="w-5 h-3.5 rounded-[3px] object-cover ring-1 ring-white/15" />{{ countryName }}
          </span>
          <RouterLink :to="isSelf ? '/social' : (conn.state === 'connected' ? '/messages/' + user.id : '/social')" class="pf-pill min-h-[30px] px-3 no-underline" @click="haptic">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.7.8 2.7 2.5 3 5.2" /></svg>
            <strong class="font-bug font-extrabold text-base text-white">{{ connectionsLoading ? '–' : friendsCount }}</strong> {{ friendsCount === 1 ? 'amigo' : 'amigos' }}
          </RouterLink>
          <span v-if="socials.length" class="ml-auto flex gap-1.5">
            <a v-for="s in socials" :key="s.type" :href="s.url" target="_blank" rel="noopener" :aria-label="`${s.label} de ${displayName}`" class="pf-soc">
              <svg v-if="s.type === 'instagram'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" /></svg>
              <svg v-else-if="s.type === 'x'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 3h3.2l-7 8 8.3 10h-6.5l-5-6.2L4.8 21H1.6l7.5-8.6L1.2 3h6.6l4.5 5.7zM16.4 19.2h1.8L6.6 4.7H4.7z" /></svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>
            </a>
          </span>
        </div>
        <p v-if="user.bio" class="m-0 text-sm leading-[1.45] text-slate-300 break-words">{{ user.bio }}</p>
        <RouterLink v-else-if="isSelf" to="/profile-edit" class="text-[13px] font-bold text-amber-400 min-h-[32px] flex items-center">Contá algo de vos en tu bio</RouterLink>
      </section>

      <!-- 2 · Favoritos -->
      <section aria-label="Favoritos" class="pf-card mx-3.5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="m-0 font-display font-bold text-base">Favoritos</h2>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#f43f5e" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.9 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.6 3.4 4.4 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" /></svg>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="pf-fav">
            <span class="relative w-12 h-12 shrink-0 rounded-full overflow-hidden grid place-items-center" style="background: radial-gradient(circle at 50% 30%, #6366f1, #1e1b4b); box-shadow: inset 0 0 0 2px rgba(199,210,254,0.35)">
              <img v-if="favPlayerImage" :src="favPlayerImage" alt="" class="w-full h-full object-cover" loading="lazy" />
              <svg v-else width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="19" r="8" fill="rgba(226,232,240,0.85)" /><path d="M8 48c1.5-10 8-15 16-15s14.5 5 16 15z" fill="rgba(226,232,240,0.85)" /></svg>
            </span>
            <span class="min-w-0 flex flex-col gap-0.5">
              <span class="text-[10px] font-bold tracking-[0.8px] uppercase text-indigo-300">Jugador</span>
              <span class="font-bug font-extrabold text-lg leading-none truncate">{{ user.favorite_player || 'Sin elegir' }}</span>
              <span v-if="favPlayerPos" class="text-[11px] text-slate-400">{{ favPlayerPos }}</span>
            </span>
          </div>
          <component :is="favTeamId ? 'RouterLink' : 'div'" :to="favTeamId ? `/team/${favTeamId}` : undefined" class="pf-fav no-underline text-inherit">
            <span class="w-12 h-12 shrink-0 grid place-items-center">
              <img v-if="favTeamLogo" :src="favTeamLogo" alt="" class="w-11 h-11 object-contain" loading="lazy" />
              <svg v-else width="40" height="46" viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2L37 8v14c0 11-7.5 18.5-17 22C10.5 40.5 3 33 3 22V8z" fill="#1e293b" stroke="#64748b" stroke-width="2" /></svg>
            </span>
            <span class="min-w-0 flex flex-col gap-0.5">
              <span class="text-[10px] font-bold tracking-[0.8px] uppercase text-amber-300">Club</span>
              <span class="font-bug font-extrabold text-lg leading-none truncate">{{ user.favorite_team || 'Sin elegir' }}</span>
              <span v-if="favTeamId" class="text-[11px] text-slate-400">Ver plantel</span>
            </span>
          </component>
        </div>
      </section>

      <!-- 3 · Logros destacados -->
      <section aria-label="Logros destacados" class="pf-card mx-3.5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="m-0 font-display font-bold text-base">Logros destacados</h2>
          <span class="flex items-center">
            <button v-if="isSelf && achievements.length" type="button" class="min-h-[44px] -my-2 px-2 text-xs font-bold text-slate-300" @click="showFeaturedModal = true">Cambiar</button>
            <RouterLink v-if="isSelf" to="/logros" class="min-h-[44px] -my-2 -mr-1 px-1 flex items-center text-xs font-bold text-amber-400">Ver {{ achTotal ? 'los ' + achTotal : 'todos' }}</RouterLink>
          </span>
        </div>
        <div v-if="achLoading" class="grid grid-cols-3 gap-2.5"><span v-for="n in 3" :key="n" class="h-[100px] rounded-xl bg-white/5 animate-pulse"></span></div>
        <p v-else-if="!featured.length" class="m-0 py-2 text-center text-[13px] text-slate-400">{{ isSelf ? 'Conseguí tu primer logro para destacarlo acá.' : 'Todavía no tiene logros.' }}</p>
        <div v-else class="grid grid-cols-3 gap-2.5">
          <div v-for="m in featured" :key="m.code" class="flex flex-col items-center gap-1.5 text-center">
            <AchievementMedal :icon="m.icon" :rarity="m.rarity" state="done" size="lg" />
            <span class="text-xs font-bold leading-[1.2]">{{ m.name }}</span>
            <span class="text-[10px] font-extrabold tracking-[0.5px]" :style="{ color: ACH_RARITY[m.rarity].color }">{{ ACH_RARITY[m.rarity].label }}</span>
          </div>
        </div>
      </section>

      <!-- 4 · Su juego -->
      <section aria-label="Su juego" class="pf-card mx-3.5 !p-3 flex items-center gap-3">
        <template v-if="topGame">
          <span class="pf-game" :style="{ background: topGame.bg }" v-html="topGame.art" aria-hidden="true"></span>
          <span class="flex-1 min-w-0 flex flex-col gap-[3px]">
            <span class="text-[10px] font-bold tracking-[0.8px] uppercase text-slate-400">{{ isSelf ? 'Tu juego' : 'Su juego' }}</span>
            <span class="font-bug font-extrabold italic text-[22px] leading-none uppercase truncate">{{ topGame.name }}</span>
            <span class="text-xs text-slate-400">{{ new Intl.NumberFormat('es-AR').format(topGame.xp) }} XP</span>
          </span>
          <span v-if="topGame.streak" class="shrink-0 px-2.5 py-2 rounded-xl flex flex-col items-center" style="background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.4)">
            <span class="font-bug font-extrabold text-2xl leading-none text-orange-300">{{ topGame.streak }}</span>
            <span class="text-[10px] font-bold text-orange-200">mejor racha</span>
          </span>
        </template>
        <p v-else class="m-0 flex-1 py-2 text-center text-[13px] text-slate-400">{{ isSelf ? 'Jugá unas partidas y acá aparece tu juego.' : 'Todavía no jugó.' }}</p>
      </section>

      <ReferralCard v-if="isSelf" class="mx-3.5" />
    </div>

    <FeaturedAchievementsModal v-if="showFeaturedModal" :achievements="achievements" :current-featured="featuredAchievements"
      @save="saveFeaturedAchievements" @cancel="showFeaturedModal = false" />
  </div>
</template>

<style scoped>
.pf-chip { background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(4px); }
.pf-avatar { filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.5)); }
.pf-plan {
  position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); min-width: 60px; padding: 2px 8px; border-radius: 6px;
  border: 2px solid #0b1220; font-family: var(--font-bug); font-weight: 800; font-size: 11px; letter-spacing: 1px; text-align: center;
}
.pf-title { max-width: 100%; }
.pf-lvl {
  height: 30px; padding: 0 10px; border-radius: 8px; background: linear-gradient(180deg, #818cf8, #4f46e5); border: 1.5px solid #c7d2fe;
  display: flex; align-items: center; font-family: var(--font-bug); font-weight: 800; font-size: 18px; white-space: nowrap;
}
.pf-xpfill { background: linear-gradient(90deg, #34d399, #22d3ee, #818cf8); transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
.pf-medal { display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: 0; padding: 0; color: inherit; font-family: inherit; cursor: pointer; }
div.pf-medal { cursor: default; }
.pf-medal:active .pf-disc { transform: scale(0.96); }
.pf-disc { border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: transform 0.15s ease; }
.pf-rank { background: repeating-conic-gradient(from 0deg, #fbbf24 0 10deg, #f59e0b 10deg 20deg); }
.pf-big { font-family: var(--font-bug); font-weight: 800; font-size: 28px; color: #fff; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3); }
.pf-card {
  padding: 14px; border-radius: 18px; background: linear-gradient(160deg, #111a2e, rgba(17, 26, 46, 0.6));
  border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.pf-pill {
  display: flex; align-items: center; gap: 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08); font-size: 13px; font-weight: 600; color: #e2e8f0;
}
.pf-soc {
  width: 30px; height: 30px; border-radius: 50%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex; align-items: center; justify-content: center; color: #cbd5e1; position: relative;
}
.pf-soc::after { content: ''; position: absolute; inset: -7px; }
.pf-fav {
  display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 14px; min-width: 0;
  background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);
}
.pf-game {
  width: 62px; height: 68px; flex-shrink: 0; border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.pf-game :deep(svg) { width: 52px; height: 52px; }
.font-bug { font-family: var(--font-bug); }
@media (prefers-reduced-motion: reduce) {
  .pf-xpfill, .pf-disc { transition: none; }
}
</style>
