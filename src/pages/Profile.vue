<script>
import AppH1 from '../components/AppH1.vue';
import { subscribeToAuthStateChanges } from '../services/auth';
import { getUserLevel } from '../services/xp';
import { getUserAchievements } from '../services/achievements';
import { getUserXpByGame } from '../services/games';
import { getPublicProfile } from '../services/user-profiles';
import ProfileHeaderCard from '../components/profile/ProfileHeaderCard.vue';
import AchievementsCard from '../components/profile/AchievementsCard.vue';
// XpByGameCard inlined into XpDonutChart list
import XpDonutChart from '../components/profile/XpDonutChart.vue';
import ProgressCard from '../components/profile/ProgressCard.vue';
import ConnectionsCard from '../components/profile/ConnectionsCard.vue';
import CommunityCard from '../components/profile/CommunityCard.vue';

let unsubscribeAuth = () => {};

export default {
  name: 'Profile',
  components: { AppH1, ProfileHeaderCard, AchievementsCard, XpDonutChart, ProgressCard, ConnectionsCard, CommunityCard },
  data() {
    return {
      // This holds the profile being viewed (own or other user's)
      user: {
        id: null,
        email: null,
        display_name: null,
        bio: null,
        career: null,
      },
      // Authenticated user's id (used when no :id param)
      currentAuthId: null,
      levelInfo: null,
      levelLoading: false,
      achievements: [],
      achLoading: false,
      xpByGame: [],
      xpByGameLoading: false,
      // Placeholders for future community data
      followerCount: 0,
      followingCount: 0,
      groupCount: 0,
      forumsCount: 0,
      messagesCount: 0,
      discussionsStartedCount: 0,
    };
  },
  computed: {
    avatarInitial() {
      if (!this.user || !this.user.email) return '?';
      const letter = this.user.email.trim()[0] || '?';
      return letter.toUpperCase();
    },
    displayName() {
      return this.user?.display_name || this.user?.email || '—';
    },
    progressPercent() {
      if (!this.levelInfo) return 0;
      if (!this.levelInfo.next_level_xp) return 100;
      const completed = this.levelInfo.next_level_xp - (this.levelInfo.xp_to_next ?? 0);
      const denom = this.levelInfo.next_level_xp || 1;
      const pct = Math.max(0, Math.min(100, Math.round((completed / denom) * 100)));
      return pct;
    },
    xpNow() {
      return this.levelInfo?.xp_total ?? 0;
    },
  },
  mounted() {
    // Subscribe to auth to know the default profile id when there's no :id param
    unsubscribeAuth = subscribeToAuthStateChanges(async (userState) => {
      console.debug('[Profile.vue] auth state:', userState?.id)
      this.currentAuthId = userState?.id || null
      // Reload if viewing own profile and auth changed
      this.ensureLoad()
    });
    // Initial load
    this.ensureLoad()
    // React to route changes (/u/:id)
    this.$watch(() => this.$route.params.id, () => this.ensureLoad())
  },
  unmounted() {
    unsubscribeAuth();
  },
  methods: {
    async ensureLoad() {
      const paramId = this.$route.params.id
      const targetId = paramId || this.currentAuthId
      if (!targetId) {
        // Anonymous and no target id
        this.user = { id: null, email: null, display_name: null, bio: null, career: null }
        this.levelInfo = null
        this.achievements = []
        this.xpByGame = []
        return
      }
      await this.loadFor(targetId)
    },
    async loadFor(userId) {
      try {
        // Load public profile info for display (works for own and others)
        const { data: profile, error } = await getPublicProfile(userId)
        if (error) console.error('[Profile.vue] getPublicProfile error:', error)
        // Fall back: at least set id when not found
        this.user = profile ? { ...profile, id: userId } : { id: userId }
      } catch (e) {
        console.error('[Profile.vue] getPublicProfile exception:', e)
        this.user = { id: userId }
      }

      // Level
      this.levelLoading = true
      try {
        const { data, error } = await getUserLevel(userId)
        if (error) console.error('getUserLevel error:', error)
        this.levelInfo = Array.isArray(data) ? data[0] : data
      } catch (e) {
        console.error('getUserLevel exception:', e)
        this.levelInfo = null
      } finally {
        this.levelLoading = false
      }

      // Achievements
      this.achLoading = true
      try {
        const { data: ach, error: achErr } = await getUserAchievements(userId)
        if (achErr) console.error('load achievements error:', achErr)
        this.achievements = ach || []
      } catch (e) {
        console.error('achievements exception:', e)
        this.achievements = []
      } finally {
        this.achLoading = false
      }

      // XP by game
      this.xpByGameLoading = true
      try {
        const { data: xpRows, error: xpErr } = await getUserXpByGame(userId)
        // Silenciar el caso esperado de RPC inexistente que ya cubrimos con fallback
        if (xpErr && !(xpErr.code === 'PGRST202' || /Could not find the function/i.test(xpErr.message || ''))) {
          console.error('load xp by game error:', xpErr)
        }
        this.xpByGame = xpRows || []
      } catch (e) {
        // Evitar ruido si el backend no tiene el RPC todavía
        if (!(e?.code === 'PGRST202' || /Could not find the function/i.test(e?.message || ''))) {
          console.error('xp by game exception:', e)
        }
        this.xpByGame = []
      } finally {
        this.xpByGameLoading = false
      }
    }
  }
};
</script>

<template>
  <div class="mx-auto max-w-5xl pb-8">
    <div class="mb-4 flex items-center justify-between gap-2">
      <AppH1>Mi Perfil</AppH1>
    <router-link v-if="($route.params.id || currentAuthId) === currentAuthId" to="/profile-edit" class="text-sm text-blue-500 hover:underline">Editar perfil</router-link>
    </div>

  <section class="grid gap-4 md:grid-cols-12">

      <!-- Columna izquierda: avatar, nombre, carrera, bio -->
      <div class="flex flex-col gap-4 md:col-span-8">
        <ProfileHeaderCard
          :avatar-initial="avatarInitial"
          :avatar-url="user.avatar_url"
          :display-name="displayName"
          :email="user.email"
          :nationality-code="user.nationality_code"
          :favorite-team="user.favorite_team"
          :favorite-player="user.favorite_player"
          :career="user.career"
          :bio="user.bio"
        />
  <AchievementsCard :achievements="achievements" :loading="achLoading" />
  <XpDonutChart :items="xpByGame" :loading="xpByGameLoading" />
        <div class="rounded-lg border border-white/10 p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Detalles del usuario</p>
          <ul class="mt-1 text-slate-300 text-sm space-y-1 list-disc list-inside">
            <li>Compañía: —</li>
            <li>Localidad: —</li>
            <li>Social media: —</li>
            <li>Teléfono: —</li>
            <li>Work email: —</li>
          </ul>
        </div>
      </div>

      <!-- Columna derecha: nivel, XP, achievements y progreso -->
      <div class="flex flex-col gap-4 md:col-span-4">
  <ProgressCard :level-info="levelInfo" :loading="levelLoading" :xp-now="xpNow" :progress-percent="progressPercent" :achievements-count="achievements.length" />
        <ConnectionsCard :follower-count="followerCount" :following-count="followingCount" :group-count="groupCount" />
        <CommunityCard :forums-count="forumsCount" :messages-count="messagesCount" :discussions-started-count="discussionsStartedCount" />
      </div>
      
    </section>
  </div>
</template>