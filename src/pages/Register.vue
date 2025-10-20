<script>
import AppH1 from '../components/AppH1.vue';
import AppButton from '../components/AppButton.vue';
import { register } from '../services/auth';
import { flagUrl } from '../services/countries';
import countriesMap from '../codeCOUNTRYS.json';
import SearchSelect from '../components/SearchSelect.vue';
import { getAllPlayers, getAllTeams } from '../services/players';

export default {
  name: 'Register',
  components: {
    AppH1,
    AppButton,
    SearchSelect,
  },
  data() {
    const countries = Object.entries(countriesMap).map(([code, name]) => ({ code: code.toLowerCase(), name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const players = getAllPlayers().map(p => ({ value: p.name, label: p.name }))
    const teams = getAllTeams().map(t => ({ value: t.name, label: t.name }))
    return {
      user:{
        email: '',
        password: '',
        confirm: '',
        nationality_code: '',
        favorite_team: '',
        favorite_player: '',
      },
      countries,
      players,
      teams,
      loading: false,
      error: '',
      notice: '',
    };
  },
  methods: {
    flagUrl,
    async handleSubmit() {
      try{
        this.loading = true;
        this.error = ''
        this.notice = ''
        if ((this.user.password || '').length < 6) {
          this.error = 'La contraseña debe tener al menos 6 caracteres.'
          return
        }
        if (this.user.password !== this.user.confirm) {
          this.error = 'Las contraseñas no coinciden.'
          return
        }
        const profile = {
          nationality_code: this.user.nationality_code || null,
          favorite_team: this.user.favorite_team?.trim() || null,
          favorite_player: this.user.favorite_player?.trim() || null,
        }
        await register(this.user.email, this.user.password, profile);
        this.notice = 'Revisá tu correo para confirmar tu cuenta.'
        this.$router.push('/profile');
      } catch(error){
        console.error(error);
        this.error = error?.message || 'No se pudo registrar.'
      } finally {
        this.loading = false;
      }
    },
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <AppH1>Registrarse</AppH1>

    <form action="#" @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
      <div class="grid grid-cols-1 gap-3">
        <div>
          <label for="email" class="label">Correo electrónico</label>
          <input
            autofocus
            required
            type="email"
            class="input"
            id="email"
            placeholder="tu@email.com"
            v-model="user.email"
          />
        </div>
        <div>
          <label for="password" class="label">Contraseña</label>
          <input
            required
            type="password"
            class="input"
            id="password"
            placeholder="••••••••"
            v-model="user.password"
          />
          <p class="text-xs text-slate-400 mt-1">Debe tener 6 caracteres o más.</p>
        </div>
        <div>
          <label for="confirm" class="label">Confirmar contraseña</label>
          <input
            required
            type="password"
            class="input"
            id="confirm"
            placeholder="••••••••"
            v-model="user.confirm"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        <div>
          <label for="nationality" class="label">Nacionalidad</label>
          <div class="flex items-center gap-2">
            <img v-if="user.nationality_code" :src="flagUrl(user.nationality_code, 24)" :alt="user.nationality_code" width="24" height="16" class="rounded ring-1 ring-white/10" />
            <select id="nationality" v-model="user.nationality_code" class="select w-full">
              <option value="">— Selecciona un país —</option>
              <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <div>
          <SearchSelect label="Equipo favorito" v-model="user.favorite_team" :options="teams" placeholder="Escribe 3 letras para filtrar" />
        </div>
        <div class="md:col-span-2">
          <SearchSelect label="Jugador favorito" v-model="user.favorite_player" :options="players" placeholder="Escribe 3 letras para filtrar" />
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{{ error }}</p>
      <p v-if="notice" class="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">{{ notice }}</p>
      <div class="pt-2">
        <AppButton type="submit">Registrarse</AppButton>
      </div>
    </form>
  </div>
</template>