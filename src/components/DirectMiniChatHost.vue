<script>
import { dmsUiState, toggleCollapseMiniChat, closeMiniChat } from '../stores/dms-ui'
import DirectMiniChat from './DirectMiniChat.vue'
import { getPublicProfile } from '../services/user-profiles'

export default {
  name: 'DirectMiniChatHost',
  components: { DirectMiniChat },
  data() {
    return { profiles: {} }
  },
  computed: {
    windows() { return dmsUiState.windows }
  },
  methods: {
    async ensureProfile(id) {
      if (this.profiles[id]) return this.profiles[id]
      try { const { data } = await getPublicProfile(id); this.profiles[id] = data || { id }; return this.profiles[id] } catch { this.profiles[id] = { id }; return this.profiles[id] }
    },
    onClose(peerId) { toggleCollapseMiniChat(peerId) },
    expand(peerId) { toggleCollapseMiniChat(peerId) },
    remove(peerId) { closeMiniChat(peerId) }
  },
  async mounted() {
    // Preload existing profiles
    for (const w of dmsUiState.windows) await this.ensureProfile(w.peerId)
    // Watch for new windows to fetch their profiles
    this.$watch(() => dmsUiState.windows.map(w => w.peerId).join(','), async () => {
      for (const w of dmsUiState.windows) if (!this.profiles[w.peerId]) await this.ensureProfile(w.peerId)
    })
  }
}
</script>

<template>
  <!-- Host pinned near bottom-right (left of the dock); windows spread to the left -->
  <div class="hidden sm:flex fixed bottom-0 right-[420px] z-40 gap-3 items-end">
    <template v-for="(w, idx) in windows" :key="w.peerId">
      <!-- Collapsed pill -->
  <button v-if="w.collapsed" class="bg-slate-900/95 backdrop-blur rounded-t-2xl rounded-b-none border border-white/10 border-b-0 shadow-xl p-2 pr-3 flex items-center gap-2 hover:bg-white/5" @click="expand(w.peerId)">
        <img v-if="profiles[w.peerId]?.avatar_url" :src="profiles[w.peerId].avatar_url" class="h-7 w-7 rounded-full" alt="avatar" />
        <div v-else class="h-7 w-7 rounded-full bg-slate-700 grid place-items-center text-xs text-slate-200">{{ ((profiles[w.peerId]?.display_name || profiles[w.peerId]?.email || '?').trim()[0] || '?').toUpperCase() }}</div>
        <div class="text-sm text-slate-100 truncate max-w-[180px]">{{ profiles[w.peerId]?.display_name || profiles[w.peerId]?.email || w.peerId }}</div>
        <button @click.stop="remove(w.peerId)" class="ml-1 rounded-md h-7 w-7 grid place-items-center hover:bg-white/5" aria-label="Cerrar">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M19 13H5v-2h14z"/></svg>
        </button>
      </button>
      <!-- Expanded mini chat -->
      <transition name="slide-up">
        <div v-if="!w.collapsed">
          <DirectMiniChat :peer-id="w.peerId" :on-close="() => onClose(w.peerId)" :on-remove="() => remove(w.peerId)" />
        </div>
      </transition>
    </template>
  </div>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active { transition: transform .18s ease, opacity .18s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(8px); opacity: 0; }
</style>
