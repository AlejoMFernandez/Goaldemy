<script>
import AppH1 from '../components/AppH1.vue';
import AppButton from '../components/AppButton.vue';
import { login, resetPasswordForEmail } from '../services/auth';
import { pushErrorToast, pushSuccessToast } from '../stores/notifications';

export default {
  name: 'Login',
  components: {
    AppH1,
    AppButton
  },
  data() {
    return {
      loading: false,
      user:{
        email: '',
        password: '',
      },
      error: ''
    };
  },
  methods: {
    async handleSubmit() {
      try{
        this.loading = true;
        this.error = ''
        await login(this.user.email, this.user.password);
        this.$router.push('/profile');
      } catch(error){
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
        // Success toast ya se muestra en auth.js
      } catch (e) {
        console.error(e)
        const msg = e?.message || 'No pudimos enviar el email de reseteo.'
        this.error = msg
        try { pushErrorToast(msg) } catch {}
      } finally {
        this.loading = false
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
      <h1 class="text-2xl font-bold">Iniciar sesión en GOALDEMY</h1>
      <p class="text-slate-300 text-sm">Volvé a jugar y seguir sumando XP</p>
    </div>

    <form action="#" @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
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
        <button type="button" @click="handleResetPassword" class="text-sm text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline disabled:opacity-60" :disabled="loading">
          ¿Olvidaste tu contraseña?
        </button>
      </div>
      
      
      <div class="pt-2 space-y-3">
        <AppButton type="submit" class="w-full">Acceder</AppButton>
        <!-- Divider -->
        <div class="flex items-center gap-3 text-slate-400 text-xs my-5">
          <div class="h-px flex-1 bg-white/10"></div>
          <span>o</span>
          <div class="h-px flex-1 bg-white/10"></div>
        </div>
        <button type="button" class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-slate-100 hover:bg-white/10">
          <img src="/social/google.png" alt="Google" class="w-5 h-5" />
          <span>Iniciar sesión con Google</span>
        </button>
      </div>
    </form>
    <p class="mt-4 text-center text-sm text-slate-300">¿No tienes cuenta? <RouterLink to="/register" class="text-sky-300 hover:text-sky-200">Créala</RouterLink></p>
  </div>
</template>