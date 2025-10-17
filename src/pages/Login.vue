<script>
import AppH1 from '../components/AppH1.vue';
import AppButton from '../components/AppButton.vue';
import { login, resetPasswordForEmail } from '../services/auth';

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
        this.error = 'Ingresá tu email para enviar el enlace de reseteo.'
        return
      }
      try {
        this.loading = true
        this.error = ''
        await resetPasswordForEmail(this.user.email)
        this.error = 'Te enviamos un email con el enlace para restablecer tu contraseña.'
      } catch (e) {
        console.error(e)
        this.error = e?.message || 'No pudimos enviar el email de reseteo.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <AppH1>Iniciar sesión</AppH1>

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
      <p v-if="error" class="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{{ error }}</p>
      <div class="pt-2 flex justify-between items-center">
        <AppButton type="submit">Acceder</AppButton>
        <button type="button" @click="handleResetPassword" class="text-slate-300 hover:text-white text-sm underline-offset-2 hover:underline disabled:opacity-60" :disabled="loading">¿Olvidaste tu contraseña?</button>
      </div>
    </form>
  </div>
</template>