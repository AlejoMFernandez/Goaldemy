<script>
import ProfileHeaderCard from '../components/profile/ProfileHeaderCard.vue'
import { getPublicProfile } from '../services/user-profiles'

export default {
  name: 'UserPublic',
  components: { ProfileHeaderCard },
  data() {
    return { user: null, loading: true }
  },
  async mounted() {
    const id = this.$route.params.id
    try {
      const { data, error } = await getPublicProfile(id)
      if (error) console.error(error)
      this.user = data
    } catch (e) {
      this.user = null
    } finally {
      this.loading = false
    }
  },
  computed: {
    avatarInitial() {
      const email = this.user?.email || ''
      return email ? email[0].toUpperCase() : '?'
    },
    displayName() {
      return this.user?.display_name || this.user?.email || '—'
    }
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl pb-8">
    <div v-if="loading" class="text-slate-300">Cargando…</div>
    <template v-else>
      <ProfileHeaderCard
        :avatar-initial="avatarInitial"
        :avatar-url="user?.avatar_url"
        :display-name="displayName"
        :email="user?.email"
        :career="user?.career"
        :bio="user?.bio"
      />
    </template>
  </section>
</template>

<style scoped>
</style>