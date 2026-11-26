<script>
import AppButton from '../../components/common/AppButton.vue';
import SearchSelect from '../../components/common/SearchSelect.vue';
import LegalModal from '../../components/legal/LegalModal.vue';
import { getPendingGuestSummary } from '../../services/guest-play';
import { login, register, continueWithGoogle } from '../../services/auth';
import { flagUrl } from '../../services/countries';
import countriesMap from '../../codeCOUNTRYS.json';
import { getAllPlayers, getAllTeams } from '../../services/players';
import { pushErrorToast, pushSuccessToast } from '../../stores/notifications';

export default {
  name: 'AuthPage',
  components: {
    AppButton,
    SearchSelect,
    LegalModal,
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
      // UI v4 (sin cambios de lógica)
      showPass: false,
      profileOpen: false,
      guestXp: 0,
    };
  },
  created() {
    this.mode = this.$route.path === '/register' ? 'register' : 'login'
  },
  mounted() {
    try { this.guestXp = getPendingGuestSummary().xp || 0 } catch { this.guestXp = 0 }
    window.addEventListener('pageshow', this.onPageShow)
    // Volviste del link de confirmación de email (?confirmed=1): avisar acá
    // y a cualquier otra pestaña que haya quedado esperando en /verify-email.
    if (this.$route.query.confirmed === '1') {
      pushSuccessToast('¡Cuenta confirmada! Ya podés entrar')
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('fulvo-auth')
          bc.postMessage({ type: 'email-confirmed' })
          bc.close()
        }
      } catch {}
      const { confirmed, ...rest } = this.$route.query
      this.$router.replace({ path: this.$route.path, query: rest })
    }
  },
  beforeUnmount() {
    window.removeEventListener('pageshow', this.onPageShow)
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
    },
    // Si volvés con el botón Atrás del navegador después de tocar "Google",
    // Chrome restaura esta página desde la bfcache con `loading` todavía en
    // true (no vuelve a montar el componente) → el form queda inutilizable
    // hasta refrescar con F5. `pageshow` con `persisted:true` detecta ese
    // caso y libera el estado trabado.
    onPageShow(e) {
      if (e.persisted) {
        this.loading = false
        this.error = ''
      }
    }
  }
}
</script>

<template>
  <section class="au">
    <div class="au-glow" aria-hidden="true"></div>
    <svg class="au-pitch" width="390" height="200" viewBox="0 0 390 200" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2"><circle cx="195" cy="40" r="96"/><path d="M0 40h390"/></g></svg>

    <div class="au-in">
      <!-- Barra: cerrar · logo · ahora no -->
      <div class="flex items-center justify-between">
        <RouterLink to="/" class="au-x" aria-label="Cerrar y seguir como invitado">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </RouterLink>
        <span class="flex items-center gap-2">
          <img src="/iconclaro.png" alt="" width="29" height="38" class="h-[38px] w-auto drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]" />
          <span class="au-brand">FULVO</span>
        </span>
        <RouterLink to="/" class="au-later">Ahora no</RouterLink>
      </div>

      <Transition name="au-txt" mode="out-in">
        <div :key="mode" class="flex flex-col gap-1">
          <h1 class="au-h1">{{ mode === 'login' ? 'Volvé a la cancha' : 'Guardá tu progreso' }}</h1>
          <p class="au-sub">{{ mode === 'login' ? 'Entrá con tu cuenta y seguí donde dejaste: nivel, racha y vestuario.' : 'Creá tu cuenta para no perder tu nivel, tu racha y tus cosméticos en ningún celu.' }}</p>
        </div>
      </Transition>

      <!-- Lo ganado como invitado (guest-play.js) -->
      <div v-if="guestXp > 0" class="au-guest" role="status">
        <span class="au-guest-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#052e16" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/></svg></span>
        <span class="flex-1 text-[12.5px] leading-snug text-emerald-100">Lo que ganaste como invitado se guarda</span>
        <span class="au-guest-xp">+{{ guestXp.toLocaleString('es-AR') }} XP</span>
      </div>

      <p v-if="notice" class="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{{ notice }}</p>

      <form :aria-label="mode === 'login' ? 'Entrar con email' : 'Crear cuenta con email'" class="flex flex-col gap-3" action="#" @submit.prevent="handleSubmit">
        <div class="au-tabs" role="tablist" aria-label="Tipo de acceso">
          <button type="button" role="tab" class="au-tab" :class="mode === 'login' ? 'is-on' : ''" :aria-selected="mode === 'login'" @click="setMode('login')">Entrar</button>
          <button type="button" role="tab" class="au-tab" :class="mode === 'register' ? 'is-on' : ''" :aria-selected="mode === 'register'" @click="setMode('register')">Crear cuenta</button>
        </div>

        <div v-if="mode === 'register'" class="au-field au-open">
          <label for="display_name" class="au-label">Nombre de usuario</label>
          <input id="display_name" v-model="user.display_name" required type="text" class="au-input" placeholder="Cómo te ven los demás" autocomplete="nickname" aria-describedby="au-name-hint"
            :class="fieldError.name ? 'is-bad' : ''" @input="fieldError.name = false" />
          <span id="au-name-hint" class="au-hint">Así te ven en el ranking y en Social.</span>
        </div>

        <div class="au-field">
          <label :for="mode === 'login' ? 'email' : 'reg_email'" class="au-label">Email</label>
          <input :id="mode === 'login' ? 'email' : 'reg_email'" v-model="user.email" required type="email" inputmode="email" class="au-input" autocomplete="email" autocapitalize="none" placeholder="vos@mail.com"
            :class="fieldError.email ? 'is-bad' : ''" @input="fieldError.email = false" />
        </div>

        <div class="au-field">
          <label :for="mode === 'login' ? 'password' : 'reg_password'" class="au-label">Contraseña</label>
          <span class="relative block">
            <input :id="mode === 'login' ? 'password' : 'reg_password'" v-model="user.password" required :type="showPass ? 'text' : 'password'" class="au-input pr-[52px]"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :placeholder="mode === 'login' ? 'Tu contraseña' : 'Mínimo 6 caracteres'"
              :class="fieldError.password ? 'is-bad' : ''" @input="fieldError.password = false" />
            <button type="button" class="au-eye" :class="showPass ? 'is-on' : ''" :aria-label="showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="showPass"
              :aria-controls="mode === 'login' ? 'password' : 'reg_password'" @click="showPass = !showPass">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path v-if="!showPass" d="M4 4l16 16"/></svg>
            </button>
          </span>
          <RouterLink v-if="mode === 'login'" to="/forgot-password" class="au-forgot">¿Olvidaste tu contraseña?</RouterLink>
        </div>

        <div v-if="mode === 'register'" class="au-field au-open">
          <label for="confirm" class="au-label">Repetí la contraseña</label>
          <input id="confirm" v-model="user.confirm" required :type="showPass ? 'text' : 'password'" class="au-input" autocomplete="new-password" placeholder="La misma de arriba"
            :style="confirmBorderColor ? { borderColor: confirmBorderColor } : {}" />
        </div>

        <!-- Opcional: armá tu perfil -->
        <div v-if="mode === 'register'" class="au-extra">
          <button type="button" class="au-extra-btn" :aria-expanded="profileOpen" aria-controls="au-extra-body" @click="profileOpen = !profileOpen">
            <span class="flex-1 text-left"><strong class="text-white text-sm">Armá tu perfil</strong> <span class="text-xs text-slate-400">(opcional)</span></span>
            <span v-if="hasAnyProfilePick" class="flex items-center gap-1.5">
              <img v-if="selectedFlagUrl" :src="selectedFlagUrl" alt="" class="w-6 h-4 rounded-sm object-cover" />
              <img v-if="selectedTeamImage" :src="selectedTeamImage" alt="" class="w-6 h-6 object-contain" />
              <img v-if="selectedPlayerImage" :src="selectedPlayerImage" alt="" class="w-6 h-6 rounded-full object-contain" />
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="text-slate-400 transition-transform" :class="profileOpen ? 'rotate-180' : ''" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div v-show="profileOpen" id="au-extra-body" class="flex flex-col gap-3 px-3 pb-3">
            <p class="text-xs text-slate-400">Tu selección, tu club y tu ídolo se ven en tu perfil.</p>
            <SearchSelect label="Nacionalidad" :show-images="true" :img-size="26" img-shape="flag" v-model="user.nationality_code" :options="countryOptions" placeholder="Escribí 3 letras para buscar tu país" />
            <SearchSelect label="Equipo favorito" :show-images="true" :img-size="40" img-shape="badge" v-model="user.favorite_team" :options="teams" placeholder="Escribí 3 letras para filtrar" />
            <SearchSelect label="Jugador favorito" :show-images="true" :img-size="40" v-model="user.favorite_player" :options="players" placeholder="Escribí 3 letras para filtrar" />
          </div>
        </div>

        <button type="submit" class="au-submit" :disabled="loading">
          <template v-if="loading">{{ mode === 'login' ? 'ENTRANDO…' : 'CREANDO…' }}</template>
          <template v-else>{{ mode === 'login' ? 'ENTRAR' : (guestXp > 0 ? 'CREAR CUENTA Y GUARDAR' : 'CREAR CUENTA') }}</template>
        </button>
      </form>

      <div class="au-or" aria-hidden="true"><span></span>o seguí con<span></span></div>

      <button type="button" class="au-google" :disabled="loading" @click="handleGoogle">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Continuar con Google
      </button>

      <p class="au-legal">Al continuar aceptás los <button type="button" @click="openLegal('terms')">Términos</button> y la <button type="button" @click="openLegal('privacy')">Política de privacidad</button> de FULVO.</p>
    </div>

    <LegalModal :open="legalModalOpen" :type="legalModalType" @close="legalModalOpen = false" />
  </section>
</template>

<style scoped>
.au { position: relative; width: 100%; max-width: 28rem; margin: 0 auto; min-height: 100dvh; color: #f1f5f9; }
@media (min-width: 1024px) { .au { min-height: 0; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); background: #0b1220; overflow: hidden; } }
.au-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(60% 22% at 50% 6%, rgba(16,185,129,0.2), transparent 72%); }
.au-pitch { position: absolute; left: 50%; top: 0; transform: translateX(-50%); pointer-events: none; }
.au-in { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 8px 2px calc(18px + env(safe-area-inset-bottom, 0px)); }
@media (min-width: 1024px) { .au-in { padding: 18px 22px 22px; } }
.au-x { width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #fff; display: grid; place-items: center; }
.au-brand { font-family: Montserrat, var(--font-sans); font-weight: 800; font-size: 22px; letter-spacing: -0.3px; }
.au-later { min-height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: flex-end; font-size: 13px; font-weight: 700; color: #94a3b8; }
.au-h1 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 26px; line-height: 1.1; }
.au-sub { margin: 0; font-size: 13.5px; line-height: 1.4; color: #94a3b8; }
.au-guest { border-radius: 14px; padding: 8px 12px 8px 8px; display: flex; align-items: center; gap: 10px; background: linear-gradient(110deg, rgba(52,211,153,0.16), rgba(34,211,238,0.08) 70%); border: 1px solid rgba(52,211,153,0.4); }
.au-guest-ic { width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px; background: linear-gradient(135deg, #34d399, #22d3ee); display: grid; place-items: center; }
.au-guest-xp { font-family: var(--font-shout); font-weight: 800; font-size: 22px; color: #6ee7b7; white-space: nowrap; }
.au-tabs { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
.au-tab { min-height: 44px; border-radius: 10px; color: #94a3b8; font-family: var(--font-shout); font-weight: 800; font-size: 18px; letter-spacing: .5px; text-transform: uppercase; transition: background .2s ease, color .2s ease, box-shadow .2s ease; }
.au-tab.is-on { background: linear-gradient(180deg, #1e293b, #172033); box-shadow: inset 0 0 0 1px rgba(251,191,36,0.5), 0 4px 10px rgba(0,0,0,0.3); color: #fde68a; }
.au-field { display: flex; flex-direction: column; gap: 5px; }
.au-label { font-size: 12px; font-weight: 700; color: #cbd5e1; }
.au-input { min-height: 48px; width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: #0b1220; color: #f1f5f9; font-size: 15px; padding: 0 12px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
.au-input::placeholder { color: #475569; }
.au-input:focus { border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,0.25); }
.au-input.is-bad { border-color: #f87171; }
.au-hint { font-size: 11.5px; color: #64748b; }
.au-eye { position: absolute; right: 2px; top: 2px; width: 44px; height: 44px; border-radius: 10px; color: #94a3b8; display: grid; place-items: center; }
.au-eye.is-on { color: #fbbf24; }
.au-forgot { align-self: flex-end; min-height: 32px; display: flex; align-items: center; font-size: 12.5px; font-weight: 700; color: #fbbf24; }
.au-extra { border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: linear-gradient(135deg, rgba(16,185,129,0.06), rgba(255,255,255,0.02), rgba(34,211,238,0.06)); }
.au-extra-btn { width: 100%; min-height: 48px; padding: 0 12px; display: flex; align-items: center; gap: 8px; }
.au-submit { min-height: 54px; border-radius: 14px; border-bottom: 4px solid #b45309; background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%); color: #1c1206; font-family: var(--font-shout); font-weight: 800; font-style: italic; font-size: 22px; letter-spacing: 1px; }
.au-submit:active:not(:disabled) { transform: translateY(2px); border-bottom-width: 2px; }
.au-submit:disabled { opacity: .7; }
.au-or { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 700; color: #64748b; }
.au-or > span { flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
.au-google { min-height: 48px; border-radius: 14px; background: #fff; color: #1f2937; font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 10px; }
.au-google:disabled { opacity: .6; }
.au-legal { margin: 4px 0 0; text-align: center; font-size: 11.5px; line-height: 1.5; color: #64748b; }
.au-legal button { color: #fbbf24; font-weight: 600; min-height: 24px; }
.au-open { animation: au-open .25s ease-out both; }
@keyframes au-open { from { opacity: 0; transform: translateY(-6px); } }
.au-txt-enter-active, .au-txt-leave-active { transition: opacity .16s ease; }
.au-txt-enter-from, .au-txt-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .au-open { animation: none; }
  .au-tab, .au-input { transition: none; }
}
</style>
