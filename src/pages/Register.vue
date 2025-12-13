<script>
import AppH1 from '../components/common/AppH1.vue';
import AppButton from '../components/common/AppButton.vue';
import { register } from '../services/auth';
import { flagUrl } from '../services/countries';
import countriesMap from '../codeCOUNTRYS.json';
import SearchSelect from '../components/common/SearchSelect.vue';
import { getAllPlayers, getAllTeams } from '../services/players';
import { pushErrorToast, pushSuccessToast } from '../stores/notifications';

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
  const players = getAllPlayers().map(p => ({ value: p.name, label: p.name, image: p.image }))
  const teams = getAllTeams().map(t => ({ value: t.name, label: t.name, image: t.logo }))
    return {
      user:{
        display_name: '',
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
        if (!(this.user.display_name || '').trim()) {
          this.error = 'El nombre es obligatorio.'
          try { pushErrorToast(this.error) } catch {}
          return
        }
        // Feedback: reforzar restricción mínima de 6 caracteres en cliente
        if ((this.user.password || '').length < 6) {
          try { pushErrorToast('Tu contraseña es muy corta. Debe tener al menos 6 caracteres.') } catch {}
          return
        }
        if (this.user.password !== this.user.confirm) {
          this.error = 'Las contraseñas no coinciden.'
          try { pushErrorToast(this.error) } catch {}
          return
        }
        const profile = {
          display_name: this.user.display_name.trim(),
          nationality_code: this.user.nationality_code || null,
          favorite_team: this.user.favorite_team?.trim() || null,
          favorite_player: this.user.favorite_player?.trim() || null,
        }
        await register(this.user.email, this.user.password, profile);
        this.notice = '✅ Te enviamos un correo para confirmar tu cuenta. Verificá tu email para continuar.'
        try { pushSuccessToast('Cuenta creada! Verificá tu email') } catch {}
        this.$router.push('/verify-email');
      } catch(error){
        console.error(error);
        this.error = error?.message || 'No se pudo registrar.'
        try { pushErrorToast(this.error) } catch {}
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>

<template>
  <RouterLink to="/" class="fixed top-4 left-4 z-50 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 hover:bg-white/10">
    <span aria-hidden>←</span>
    <span>Volver</span>
  </RouterLink>
  <div class="w-full max-w-md">
    <div class="text-center mb-6">
      <img src="/iconclaro.png" alt="Goaldemy" class="mx-auto h-auto w-12 mb-2" />
      <h1 class="text-2xl font-bold">Crear cuenta en GOALDEMY</h1>
      <p class="text-slate-300 text-sm">Unite para jugar, sumar XP y desbloquear logros</p>
    </div>

    <form action="#" @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
      <div class="grid grid-cols-1 gap-3">
        <div>
          <label for="display_name" class="label">Nombre</label>
          <input
            required
            type="text"
            class="input"
            id="display_name"
            placeholder="Tu nombre"
            v-model="user.display_name"
            autocomplete="name"
          />
        </div>
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
            autocomplete="email"
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
            autocomplete="new-password"
          />
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
            autocomplete="new-password"
          />
        </div>
      </div>
      <!-- Campos opcionales -->
      <div class="card mt-2 p-4 bg-white/0 border border-white/10">
        <p class="text-xs uppercase tracking-wide text-slate-400 mb-3">Opcional</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <SearchSelect label="Equipo favorito" :show-images="true" v-model="user.favorite_team" :options="teams" placeholder="Escribe 3 letras para filtrar" />
        </div>
        <div class="md:col-span-2">
          <SearchSelect label="Jugador favorito" :show-images="true" v-model="user.favorite_player" :options="players" placeholder="Escribe 3 letras para filtrar" />
        </div>
        </div>
      </div>
      
      <div class="pt-2 space-y-3">
        <AppButton type="submit" class="w-full">Crear cuenta</AppButton>
        <!-- Divider -->
        <div class="flex items-center gap-3 text-slate-400 text-xs my-5">
          <div class="h-px flex-1 bg-white/10"></div>
          <span>o</span>
          <div class="h-px flex-1 bg-white/10"></div>
        </div>
        <button type="button" class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-slate-100 hover:bg-white/10">
          <img src="/social/google.png" alt="Google" class="w-5 h-5" />
          <span>Registrarse con Google</span>
        </button>
      </div>
    </form>
    <p class="mt-4 text-center text-sm text-slate-300">¿Ya tenés cuenta? <RouterLink class="text-sky-300 hover:text-sky-200" to="/login">Acceder</RouterLink></p>
  </div>
</template>

