<script>
import AppButton from '../../components/common/AppButton.vue';
import SearchSelect from '../../components/common/SearchSelect.vue';
import LegalModal from '../../components/legal/LegalModal.vue';
import FulvoLogo from '../../components/FulvoLogo.vue';
import GamesFan from '../../components/auth/GamesFan.vue';
import { login, register, continueWithGoogle } from '../../services/auth';
import { flagUrl } from '../../services/countries';
import countriesMap from '../../codeCOUNTRYS.json';
import { getAllPlayers, getAllTeams } from '../../services/players';
import { pushErrorToast } from '../../stores/notifications';

export default {
  name: 'AuthPage',
  components: {
    AppButton,
    SearchSelect,
    LegalModal,
    FulvoLogo,
    GamesFan,
  },
  data() {
    const countryOptions = Object.entries(countriesMap)
      .map(([code, name]) => ({ value: code.toLowerCase(), label: name, image: flagUrl(code) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    // includeExcluded: true — el picker de "jugador favorito" es solo cosmético
    // para el perfil (no afecta ningún juego), así que acá sí mostramos TODOS
    // los jugadores de todos los equipos, incluidos Boca/River/Racing (que
    // getAllPlayers() excluye por defecto para no romper el balance de los juegos).
    const players = getAllPlayers({ includeExcluded: true }).map(p => ({ value: p.name, label: p.name, image: p.image }))
    const teams = getAllTeams().map(t => ({ value: t.name, label: t.name, image: t.logo }))
    return {
      mode: 'login',
      direction: 1, // 1 = login→register (avanza), -1 = register→login (retrocede)
      loading: false,
      error: '',
      notice: '',
      // Resalta el borde del input en rojo en vez de un banner que empuja el
      // resto del form hacia abajo — el texto del error va solo por toast (efímero).
      fieldError: { name: false, email: false, password: false },
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
      legalModalOpen: false,
      legalModalType: 'terms',
    };
  },
  created() {
    this.mode = this.$route.path === '/register' ? 'register' : 'login'
  },
  computed: {
    // Feedback visual en tiempo real del campo "Confirmar contraseña":
    // borde verde si coincide, rojo si no — recién una vez que el usuario
    // empezó a escribir ahí (no marca error con el campo vacío).
    confirmBorderColor() {
      if (!this.user.confirm) return null
      return this.user.confirm === this.user.password ? '#10b981' : '#f87171'
    },
    // Vista previa de la sección "Armá tu perfil": banderín/escudo/foto de lo
    // que el usuario ya eligió, para que se sienta como ir completando una figurita.
    selectedFlagUrl() {
      return this.user.nationality_code ? flagUrl(this.user.nationality_code) : ''
    },
    selectedTeamImage() {
      const t = this.teams.find(t => t.value === this.user.favorite_team)
      return t?.image || ''
    },
    selectedPlayerImage() {
      const p = this.players.find(p => p.value === this.user.favorite_player)
      return p?.image || ''
    },
    hasAnyProfilePick() {
      return !!(this.user.nationality_code || this.user.favorite_team || this.user.favorite_player)
    }
  },
  watch: {
    '$route.path'(newPath) {
      const wanted = newPath === '/register' ? 'register' : 'login'
      if (this.mode !== wanted) {
        this.direction = wanted === 'register' ? 1 : -1
        this.mode = wanted
      }
      this.resetScroll()
    }
  },
  methods: {
    // Al cambiar entre login/register, tanto el scroll de la página (mobile)
    // como el scroll interno de la columna del form (desktop) deben arrancar
    // siempre arriba — si no, quedaba en la posición donde estaba el form
    // anterior (ej. a mitad del registro) y el usuario veía el nuevo form
    // "cortado" arriba.
    resetScroll() {
      this.$nextTick(() => {
        window.scrollTo({ top: 0 })
        if (this.$refs.formScroll) this.$refs.formScroll.scrollTop = 0
      })
    },
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
      this.fieldError = { name: false, email: false, password: false }
      const target = m === 'register' ? '/register' : '/login'
      if (this.$route.path !== target) this.$router.replace(target)
      this.resetScroll()
    },
    async handleSubmit() {
      if (this.mode === 'login') return this.handleLogin()
      return this.handleRegister()
    },
    async handleLogin() {
      this.fieldError = { name: false, email: false, password: false }
      try {
        this.loading = true
        this.error = ''
        await login(this.user.email, this.user.password);
        this.$router.push('/profile');
      } catch (error) {
        console.error(error);
        this.error = error?.message || 'No se pudo iniciar sesión.'
        // No sabemos si falló el email o la contraseña — resaltamos los dos.
        this.fieldError.email = true
        this.fieldError.password = true
      }
      this.loading = false;
    },
    async handleRegister() {
      this.fieldError = { name: false, email: false, password: false }
      try {
        this.loading = true;
        this.error = ''
        this.notice = ''
        if (!(this.user.display_name || '').trim()) {
          this.error = 'El nombre es obligatorio.'
          this.fieldError.name = true
          try { pushErrorToast(this.error) } catch {}
          return
        }
        if ((this.user.password || '').length < 6) {
          this.error = 'Tu contraseña es muy corta. Debe tener al menos 6 caracteres.'
          this.fieldError.password = true
          try { pushErrorToast(this.error) } catch {}
          return
        }
        if (this.user.password !== this.user.confirm) {
          this.error = 'Las contraseñas no coinciden.'
          // El campo "Confirmar" ya se resalta solo en vivo (confirmBorderColor).
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
        this.notice = 'Te enviamos un correo para confirmar tu cuenta. Verificá tu email para continuar.'
        this.$router.push('/verify-email');
      } catch (error) {
        console.error(error);
        this.error = error?.message || 'No se pudo registrar.'
        this.fieldError.email = true
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
    },
    openLegal(type) {
      this.legalModalType = type
      this.legalModalOpen = true
    }
  }
}
</script>

<template>
  <RouterLink to="/" aria-label="Volver" class="fixed top-4 left-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:text-white transition">
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
  </RouterLink>
  <!-- Mobile: header con el logo, pegajoso (sticky top-0) — se queda fijo
       arriba de TODO todo el tiempo, no es una card, ocupa el ancho completo
       de la pantalla (-mx-4 cancela el padding lateral de <main>). -->
  <div ref="mobileHeader" class="lg:hidden sticky top-0 z-30 -mx-4 px-4 py-5 text-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-b border-white/10">
    <FulvoLogo variant="full" size="md" class="justify-center" />
  </div>

  <!-- Mobile: abanico de portadas — pantalla completa (no card), en flujo
       normal (no pegajoso): al scrollear se va tapando por el form, que sí
       es pegajoso y la "pisa" progresivamente hasta asentarse justo debajo
       del header con el logo. -->
  <div class="lg:hidden relative -mx-4 px-4 pt-6 pb-28 overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/80 text-center">
    <div aria-hidden="true" class="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl"></div>
    <div aria-hidden="true" class="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl"></div>
    <GamesFan class="relative z-10 w-full max-w-sm mx-auto" />
  </div>

  <div class="w-full -mt-16 lg:mt-0 lg:max-w-4xl lg:h-[min(680px,88vh)] lg:grid lg:grid-cols-[1.15fr_1fr] lg:rounded-2xl lg:border lg:border-white/10 lg:overflow-hidden lg:bg-[#0b1220]">

    <!-- Panel visual — solo desktop (≥1024px), mobile no cambia. Altura fija
         del panel derecho (columna hermana): este NUNCA se estira ni scrollea,
         solo se centra en su propia altura. -->
    <div class="hidden lg:flex relative flex-col items-center justify-center gap-8 h-full overflow-hidden border-r border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-800/80 px-10 py-10">
      <div aria-hidden="true" class="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl"></div>
      <div aria-hidden="true" class="pointer-events-none absolute -bottom-16 -right-20 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl"></div>

      <div class="relative z-10 text-center px-4">
        <FulvoLogo variant="full" size="lg" class="justify-center" />
        <p class="mt-4 text-slate-300 text-base max-w-[260px] mx-auto">Entrená tu conocimiento de fútbol, sumá XP y desbloqueá logros.</p>
      </div>

      <GamesFan class="relative z-10 w-full max-w-sm" />
    </div>

    <!-- Columna del form: única columna que scrollea si el contenido no entra.
         En mobile es pantalla completa (no card) y pegajosa: arranca pisando
         el abanico (el margen negativo que logra ese pisado va en el
         CONTENEDOR de acá arriba, no en este div — si va acá, el margen
         negativo achica la altura que el propio contenedor le calcula a este
         hijo sticky, y con eso el sticky se queda sin "recorrido" para
         mantenerse pegado y se despega enseguida) y al scrollear queda fija
         justo debajo del header del logo. En desktop es la mitad derecha de
         la card. -->
    <div ref="formScroll" class="relative z-20 sticky top-[88px] -mx-4 rounded-t-2xl border-t border-white/10 bg-[#0b1220] px-6 pt-8 pb-10 shadow-2xl shadow-black/50 lg:static lg:z-auto lg:mx-0 lg:rounded-none lg:border-0 lg:max-w-none lg:h-full lg:overflow-y-auto lg:bg-transparent lg:shadow-none lg:px-10 lg:py-10">
    <div class="lg:my-auto">
    <!-- Toggle fijo: solo mobile — en desktop se cambia de modo con los links de abajo -->
    <div class="mb-3 flex rounded-full bg-white/5 border border-white/10 p-1 lg:hidden">
      <button type="button" @click="setMode('login')" :class="tabClass('login')">Iniciar sesión</button>
      <button type="button" @click="setMode('register')" :class="tabClass('register')">Crear cuenta</button>
    </div>

    <Transition :name="direction === 1 ? 'auth-forward' : 'auth-back'" mode="out-in">
      <div :key="mode">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold">{{ mode === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta en FULVO' }}</h1>
          <p class="text-slate-300 text-sm">{{ mode === 'login' ? 'Volvé a jugar y seguir sumando XP' : 'Unite para jugar, sumar XP y desbloquear logros' }}</p>
        </div>

        <p v-if="notice" class="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{{ notice }}</p>

        <!-- LOGIN -->
        <form v-if="mode === 'login'" action="#" @submit.prevent="handleSubmit" class="space-y-4">
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
              @input="fieldError.email = false"
              :style="fieldError.email ? { borderColor: '#f87171' } : {}"
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
              @input="fieldError.password = false"
              :style="fieldError.password ? { borderColor: '#f87171' } : {}"
            />
          </div>
          <div class="flex justify-end -mt-2">
            <RouterLink to="/forgot-password" class="text-sm text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">
              ¿Olvidaste tu contraseña?
            </RouterLink>
          </div>

          <div class="pt-2 space-y-4">
            <AppButton type="submit" class="w-full" :disabled="loading">Acceder</AppButton>
            <div class="flex items-center gap-3 text-slate-400 text-xs my-5">
              <div class="h-px flex-1 bg-white/10"></div>
              <span>o</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>
            <button type="button" @click="handleGoogle" :disabled="loading" class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-slate-100 hover:bg-white/10 disabled:opacity-60">
              <img src="/social/google.svg" alt="Google" class="w-5 h-5" />
              <span>Iniciar sesión con Google</span>
            </button>
          </div>
        </form>

        <!-- REGISTER -->
        <form v-else action="#" @submit.prevent="handleSubmit" class="space-y-4">
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
                @input="fieldError.name = false"
                :style="fieldError.name ? { borderColor: '#f87171' } : {}"
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
                @input="fieldError.email = false"
                :style="fieldError.email ? { borderColor: '#f87171' } : {}"
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
                @input="fieldError.password = false"
                :style="fieldError.password ? { borderColor: '#f87171' } : {}"
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
                :style="confirmBorderColor ? { borderColor: confirmBorderColor } : {}"
              />
            </div>
          </div>
          <!-- Campos opcionales -->
          <div class="mt-2 p-4 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.07] via-white/[0.03] to-cyan-500/[0.07]">
            <div class="flex items-center gap-2 mb-1">
              <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              <p class="text-sm font-semibold text-white">Armá tu perfil</p>
              <span class="text-xs text-slate-400">(opcional)</span>
            </div>
            <p class="text-xs text-slate-400 mb-3">Elegí tu selección, tu club y tu ídolo — se van a ver en tu perfil.</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <SearchSelect label="Nacionalidad" :show-images="true" :img-size="26" img-shape="flag" v-model="user.nationality_code" :options="countryOptions" placeholder="Escribe 3 letras para buscar tu país" />
              </div>
              <div>
                <SearchSelect label="Equipo favorito" :show-images="true" :img-size="40" img-shape="badge" v-model="user.favorite_team" :options="teams" placeholder="Escribe 3 letras para filtrar" />
              </div>
              <div class="md:col-span-2">
                <SearchSelect label="Jugador favorito" :show-images="true" :img-size="40" v-model="user.favorite_player" :options="players" placeholder="Escribe 3 letras para filtrar" />
              </div>
            </div>

            <!-- Figurita: tira de lo que ya elegiste -->
            <div v-if="hasAnyProfilePick" class="mt-4 flex items-center justify-center gap-3 rounded-xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 py-3">
              <template v-if="selectedFlagUrl">
                <img :src="selectedFlagUrl" alt="" class="w-11 h-8 rounded-sm object-cover" />
              </template>
              <span v-if="selectedFlagUrl && (selectedTeamImage || selectedPlayerImage)" class="text-slate-500 text-lg leading-none">+</span>
              <template v-if="selectedTeamImage">
                <img :src="selectedTeamImage" alt="" class="w-11 h-11 rounded-md object-contain" />
              </template>
              <span v-if="selectedTeamImage && selectedPlayerImage" class="text-slate-500 text-lg leading-none">+</span>
              <template v-if="selectedPlayerImage">
                <img :src="selectedPlayerImage" alt="" class="w-11 h-11 rounded-full object-contain" />
              </template>
            </div>
          </div>

          <div class="pt-2 space-y-4">
            <AppButton type="submit" class="w-full" :disabled="loading">Crear cuenta</AppButton>
            <div class="flex items-center gap-3 text-slate-400 text-xs my-5">
              <div class="h-px flex-1 bg-white/10"></div>
              <span>o</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>
            <button type="button" @click="handleGoogle" :disabled="loading" class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-slate-100 hover:bg-white/10 disabled:opacity-60">
              <img src="/social/google.svg" alt="Google" class="w-5 h-5" />
              <span>Registrarse con Google</span>
            </button>
          </div>
        </form>
      </div>
    </Transition>

    <p v-if="mode === 'login'" class="mt-4 text-center text-sm text-slate-300">¿No tenés cuenta? <button type="button" class="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline" @click="setMode('register')">Creála</button></p>
    <p v-else class="mt-4 text-center text-sm text-slate-300">¿Ya tenés cuenta? <button type="button" class="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline" @click="setMode('login')">Accedé</button></p>

    <p v-if="mode === 'register'" class="mt-3 text-center text-xs text-slate-400">
      Al crear tu cuenta, aceptás nuestros
      <button type="button" @click="openLegal('terms')" class="text-slate-300 underline-offset-2 hover:underline hover:text-slate-200">Términos y Condiciones</button>
      y nuestra
      <button type="button" @click="openLegal('privacy')" class="text-slate-300 underline-offset-2 hover:underline hover:text-slate-200">Política de Privacidad</button>.
    </p>
    <p v-else class="mt-3 text-center text-xs text-slate-400">
      <button type="button" @click="openLegal('terms')" class="underline-offset-2 hover:underline hover:text-slate-200">Términos y Condiciones</button>
      ·
      <button type="button" @click="openLegal('privacy')" class="underline-offset-2 hover:underline hover:text-slate-200">Política de Privacidad</button>
    </p>
    </div>
    <!-- /lg:my-auto -->
    </div>
    <!-- /Columna del form -->
  </div>

  <LegalModal :open="legalModalOpen" :type="legalModalType" @close="legalModalOpen = false" />
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
