<script>
import AppButton from '../../components/common/AppButton.vue';
import SearchSelect from '../../components/common/SearchSelect.vue';
import { login, register, resetPasswordForEmail, continueWithGoogle } from '../../services/auth';
import { flagUrl } from '../../services/countries';
import countriesMap from '../../codeCOUNTRYS.json';
import { getAllPlayers, getAllTeams } from '../../services/players';
import { pushErrorToast } from '../../stores/notifications';

export default {
  name: 'AuthPage',
  components: {
    AppButton,
    SearchSelect,
  },
  data() {
    const countryOptions = Object.entries(countriesMap)
      .map(([code, name]) => ({ value: code.toLowerCase(), label: name, image: flagUrl(code) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    const players = getAllPlayers().map(p => ({ value: p.name, label: p.name, image: p.image }))
    const teams = getAllTeams().map(t => ({ value: t.name, label: t.name, image: t.logo }))
    return {
      mode: 'login',
      direction: 1, // 1 = login→register (avanza), -1 = register→login (retrocede)
      loading: false,
      error: '',
      notice: '',
      user: {
        display_name: '',
        email: '',
        password: '',
        confirm: '',
        nationality_code: '',
        favorite_team: '',
        favorite_player: '',
      },
      countryOptions,
      players,
      teams,
    };
  },
  created() {
    this.mode = this.$route.path === '/register' ? 'register' : 'login'
  },
  watch: {
    '$route.path'(newPath) {
      const wanted = newPath === '/register' ? 'register' : 'login'
      if (this.mode !== wanted) {
        this.direction = wanted === 'register' ? 1 : -1
        this.mode = wanted
      }
    }
  },
  methods: {
    tabClass(m) {
      return [
        'flex-1 rounded-full py-2 text-sm font-semibold transition',
        this.mode === m
          ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25'
          : 'text-slate-300 hover:text-white'
      ]
    },
    setMode(m) {
      if (this.mode === m) return
      this.direction = m === 'register' ? 1 : -1
      this.mode = m
      this.error = ''
      this.notice = ''
      const target = m === 'register' ? '/register' : '/login'
      if (this.$route.path !== target) this.$router.replace(target)
    },
    async handleSubmit() {
      if (this.mode === 'login') return this.handleLogin()
      return this.handleRegister()
    },
    async handleLogin() {
      try {
        this.loading = true
        this.error = ''
        await login(this.user.email, this.user.password);
        this.$router.push('/profile');
      } catch (error) {
        console.error(error);
        this.error = error?.message || 'No se pudo iniciar sesión.'
      }
      this.loading = false;
    },
    async handleResetPassword() {
      if (!this.user.email) {
        const msg = 'Ingresá tu email para enviar el enlace de reseteo.'
        this.error = msg
        try { pushErrorToast(msg) } catch {}
        return
      }
      try {
        this.loading = true
        this.error = ''
        await resetPasswordForEmail(this.user.email)
      } catch (e) {
        console.error(e)
        const msg = e?.message || 'No pudimos enviar el email de reseteo.'
        this.error = msg
        try { pushErrorToast(msg) } catch {}
      } finally {
        this.loading = false
      }
    },
    async handleRegister() {
      try {
        this.loading = true;
        this.error = ''
        this.notice = ''
        if (!(this.user.display_name || '').trim()) {
          this.error = 'El nombre es obligatorio.'
          try { pushErrorToast(this.error) } catch {}
          return
        }
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
        this.$router.push('/verify-email');
      } catch (error) {
        console.error(error);
        this.error = error?.message || 'No se pudo registrar.'
        try { pushErrorToast(this.error) } catch {}
      } finally {
        this.loading = false;
      }
    },
    async handleGoogle() {
      try {
        this.loading = true
        this.error = ''
        await continueWithGoogle('/profile')
      } catch (e) {
        console.error(e)
        this.error = e?.message || 'No se pudo continuar con Google.'
        this.loading = false
      }
      // Si tuvo éxito, Supabase redirige el navegador a Google — no hace falta apagar loading.
    }
  }
}
</script>

<template>
  <RouterLink to="/" class="fixed top-4 left-4 z-50 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 hover:bg-white/10">
    <span aria-hidden>←</span>
    <span>Volver</span>
  </RouterLink>
  <div class="w-full max-w-lg">
    <div class="text-center mb-6">
      <img src="/iconclaro.png" alt="Fulvo" class="mx-auto h-auto w-12 mb-2" />
    </div>

    <!-- Toggle fijo: no se anima, solo el contenido de abajo -->
    <div class="mb-5 flex rounded-full bg-white/5 border border-white/10 p-1">
      <button type="button" @click="setMode('login')" :class="tabClass('login')">Iniciar sesión</button>
      <button type="button" @click="setMode('register')" :class="tabClass('register')">Crear cuenta</button>
    </div>

    <Transition :name="direction === 1 ? 'auth-forward' : 'auth-back'" mode="out-in">
      <div :key="mode">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold">{{ mode === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta en FULVO' }}</h1>
          <p class="text-slate-300 text-sm">{{ mode === 'login' ? 'Volvé a jugar y seguir sumando XP' : 'Unite para jugar, sumar XP y desbloquear logros' }}</p>
        </div>

        <p v-if="error" class="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ error }}</p>
        <p v-if="notice" class="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{{ notice }}</p>

        <!-- LOGIN -->
        <form v-if="mode === 'login'" action="#" @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
          <div>
            <label for="email" class="label">Correo electrónico</label>
            <input
              autofocus
              required
              type="email"
              class="input"
              id="email"
              autocomplete="email"
              autocapitalize="none"
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
              autocomplete="current-password"
              placeholder="••••••••"
              v-model="user.password"
            />
          </div>
          <div class="flex justify-end -mt-2">
            <button type="button" @click="handleResetPassword" class="text-sm text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline disabled:opacity-60" :disabled="loading">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <div class="pt-2 space-y-3">
            <AppButton type="submit" class="w-full" :disabled="loading">Acceder</AppButton>
            <div class="flex items-center gap-3 text-slate-400 text-xs my-5">
              <div class="h-px flex-1 bg-white/10"></div>
              <span>o</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>
            <button type="button" @click="handleGoogle" :disabled="loading" class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-slate-100 hover:bg-white/10 disabled:opacity-60">
              <img src="/social/google.png" alt="Google" class="w-5 h-5" />
              <span>Iniciar sesión con Google</span>
            </button>
          </div>
        </form>

        <!-- REGISTER -->
        <form v-else action="#" @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
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
              <label for="reg_email" class="label">Correo electrónico</label>
              <input
                autofocus
                required
                type="email"
                class="input"
                id="reg_email"
                placeholder="tu@email.com"
                v-model="user.email"
                autocomplete="email"
              />
            </div>
            <div>
              <label for="reg_password" class="label">Contraseña</label>
              <input
                required
                type="password"
                class="input"
                id="reg_password"
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
                <SearchSelect label="Nacionalidad" :show-images="true" v-model="user.nationality_code" :options="countryOptions" placeholder="Escribe 3 letras para buscar tu país" />
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
            <AppButton type="submit" class="w-full" :disabled="loading">Crear cuenta</AppButton>
            <div class="flex items-center gap-3 text-slate-400 text-xs my-5">
              <div class="h-px flex-1 bg-white/10"></div>
              <span>o</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>
            <button type="button" @click="handleGoogle" :disabled="loading" class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-slate-100 hover:bg-white/10 disabled:opacity-60">
              <img src="/social/google.png" alt="Google" class="w-5 h-5" />
              <span>Registrarse con Google</span>
            </button>
          </div>
        </form>
      </div>
    </Transition>

    <p v-if="mode === 'login'" class="mt-4 text-center text-sm text-slate-300">¿No tenés cuenta? <button type="button" class="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline" @click="setMode('register')">Creála</button></p>
    <p v-else class="mt-4 text-center text-sm text-slate-300">¿Ya tenés cuenta? <button type="button" class="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline" @click="setMode('login')">Accedé</button></p>
  </div>
</template>

<style scoped>
/* Transición interna entre login/register: crossfade + slide direccional.
   El wrapper externo (App.vue) no se entera del cambio de ruta porque
   ambas rutas comparten meta.authGroup, así que este es el único movimiento. */
.auth-forward-enter-from { opacity: 0; transform: translateX(28px); }
.auth-forward-enter-active { transition: opacity 260ms ease, transform 260ms cubic-bezier(.22,1,.36,1); }
.auth-forward-leave-to { opacity: 0; transform: translateX(-28px); }
.auth-forward-leave-active { transition: opacity 180ms ease, transform 180ms ease; }

.auth-back-enter-from { opacity: 0; transform: translateX(-28px); }
.auth-back-enter-active { transition: opacity 260ms ease, transform 260ms cubic-bezier(.22,1,.36,1); }
.auth-back-leave-to { opacity: 0; transform: translateX(28px); }
.auth-back-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
</style>
