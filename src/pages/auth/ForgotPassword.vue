<script>
import AppButton from '../../components/common/AppButton.vue';
import { resetPasswordForEmail } from '../../services/auth';
import { pushErrorToast } from '../../stores/notifications';

export default {
  name: 'ForgotPassword',
  components: { AppButton },
  data() {
    return {
      email: '',
      loading: false,
      error: '',
      sent: false,
    };
  },
  methods: {
    async handleSubmit() {
      if (!this.email) {
        this.error = 'Ingresá tu email para enviar el enlace de reseteo.';
        try { pushErrorToast(this.error) } catch {}
        return;
      }
      try {
        this.loading = true;
        this.error = '';
        await resetPasswordForEmail(this.email);
        this.sent = true;
      } catch (e) {
        console.error(e);
        this.error = e?.message || 'No pudimos enviar el email de reseteo.';
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>

<template>
  <RouterLink to="/login" class="fixed top-4 left-4 z-50 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 hover:bg-white/10">
    <span aria-hidden>←</span>
    <span>Volver</span>
  </RouterLink>
  <div class="w-full max-w-lg">
    <div class="text-center mb-6">
      <img src="/iconclaro.png" alt="Fulvo" class="mx-auto h-auto w-12 mb-2" />
    </div>

    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold">Recuperar contraseña</h1>
      <p class="text-slate-300 text-sm">Te enviamos un enlace para elegir una nueva contraseña.</p>
    </div>

    <p v-if="error" class="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ error }}</p>

    <div v-if="sent" class="card card-hover p-6 space-y-4 text-center">
      <p class="text-emerald-300">✅ Te enviamos un email a <strong>{{ email }}</strong> con el enlace para recuperar tu contraseña.</p>
      <p class="text-slate-300 text-sm">Si no lo ves, revisá la carpeta de spam.</p>
      <RouterLink to="/login" class="inline-block text-sm text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">Volver a iniciar sesión</RouterLink>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
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
          v-model="email"
        />
      </div>
      <AppButton type="submit" class="w-full" :disabled="loading">Enviar enlace</AppButton>
      <p class="text-center text-sm text-slate-300">¿Ya te acordaste? <RouterLink to="/login" class="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">Iniciar sesión</RouterLink></p>
    </form>
  </div>
</template>
