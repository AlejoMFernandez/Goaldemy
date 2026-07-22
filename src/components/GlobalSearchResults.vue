<script>
import UserAvatar from './common/UserAvatar.vue'

export default {
  name: 'GlobalSearchResults',
  components: { UserAvatar },
  props: {
    results: { type: Object, default: () => ({ users: [], players: [], teams: [], competitions: [] }) },
    resultCos: { type: Object, default: () => ({}) },
    searching: { type: Boolean, default: false },
    query: { type: String, default: '' },
  },
  emits: ['goUser', 'goPlayer', 'goTeam', 'goCompetition'],
  computed: {
    total() {
      const r = this.results || {}
      return (r.users?.length || 0) + (r.players?.length || 0) + (r.teams?.length || 0) + (r.competitions?.length || 0)
    },
  },
  methods: {
    avatarPropsFor(u) {
      const c = (this.resultCos || {})[u?.id] || {}
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
    playerImg(p) { return p?.image || `https://images.fotmob.com/image_resources/playerimages/${p?.id}.png` },
    teamLogo(t) { return t?.logo || `https://images.fotmob.com/image_resources/logo/teamlogo/${t?.id}.png` },
    compLogo(c) { return `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${c?.id}.png` },
    onImgHide(e) { e.target.style.visibility = 'hidden' },
  },
}
</script>

<template>
  <div>
    <div v-if="searching && !total" class="px-3 py-6 text-center text-sm text-slate-400">Buscando…</div>
    <div v-else-if="query.trim().length < 2" class="px-3 py-6 text-center text-sm text-slate-500">
      Escribí para buscar jugadores, equipos, usuarios y competiciones.
    </div>
    <div v-else-if="!total" class="px-3 py-6 text-center text-sm text-slate-400">Sin resultados para “{{ query }}”.</div>

    <div v-else class="flex flex-col gap-3">
      <!-- Jugadores -->
      <section v-if="results.players?.length">
        <h5 class="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Jugadores</h5>
        <button v-for="p in results.players" :key="'p'+p.id" @click="$emit('goPlayer', p)"
          class="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 transition">
          <img :src="playerImg(p)" :alt="p.name" @error="onImgHide" class="h-8 w-8 rounded-full object-cover bg-white/5 flex-none" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-slate-100">{{ p.name }}</div>
            <div class="truncate text-[11px] text-slate-500">{{ p.teamName }}</div>
          </div>
          <span class="text-[10px] text-slate-600">Jugador</span>
        </button>
      </section>

      <!-- Equipos -->
      <section v-if="results.teams?.length">
        <h5 class="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Equipos</h5>
        <button v-for="t in results.teams" :key="'t'+t.id" @click="$emit('goTeam', t)"
          class="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 transition">
          <img :src="teamLogo(t)" :alt="t.name" @error="onImgHide" class="h-8 w-8 object-contain flex-none" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{{ t.name }}</span>
          <span class="text-[10px] text-slate-600">Equipo</span>
        </button>
      </section>

      <!-- Competiciones -->
      <section v-if="results.competitions?.length">
        <h5 class="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Competiciones</h5>
        <button v-for="c in results.competitions" :key="'c'+c.id" @click="$emit('goCompetition', c)"
          class="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 transition">
          <img :src="compLogo(c)" :alt="c.name" @error="onImgHide" class="h-8 w-8 object-contain flex-none" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-slate-100">{{ c.name }}</div>
            <div class="truncate text-[11px] text-slate-500">{{ c.country }}</div>
          </div>
          <span class="text-[10px] text-slate-600">Competición</span>
        </button>
      </section>

      <!-- Usuarios -->
      <section v-if="results.users?.length">
        <h5 class="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Usuarios</h5>
        <button v-for="u in results.users" :key="'u'+u.id" @click="$emit('goUser', u)"
          class="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 transition">
          <UserAvatar :size="32" v-bind="avatarPropsFor(u)" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{{ userLabel(u) }}</span>
          <span class="text-[10px] text-slate-600">Usuario</span>
        </button>
      </section>
    </div>
  </div>
</template>
