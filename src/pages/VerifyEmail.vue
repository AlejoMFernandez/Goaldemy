<script>
import AppH1 from '../components/common/AppH1.vue';
import AppButton from '../components/common/AppButton.vue';
import { resendVerificationEmail, getAuthUser } from '../services/auth';

export default {
  name: 'VerifyEmail',
  components: { AppH1, AppButton },
  data() {
    const user = getAuthUser();
    return {
      loading: false,
      email: user?.email || '',
      sent: false,
      error: ''
    }
  },
  methods: {
    async resend() {
      if (!this.email) {
        this.error = 'Ingresá tu email para reenviar el enlace.'
        return
      }
      try {
        this.loading = true
        this.error = ''
        await resendVerificationEmail(this.email)
        this.sent = true
      } catch (e) {
        this.error = e?.message || 'No pudimos reenviar el correo.'
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
      <h1 class="text-2xl font-bold">Verificá tu correo</h1>
      <p class="text-slate-300 text-sm">Te enviamos un enlace para confirmar tu cuenta.</p>
    </div>

    <div class="card card-hover p-6 space-y-4">
      <p class="text-slate-300 text-sm">
        Si no lo recibiste, revisá la carpeta de spam o reenviá el correo a continuación.
      </p>
      <label class="label">Correo</label>
      <input v-model="email" type="email" class="input" placeholder="tu@email.com" />
      <AppButton class="w-full" :disabled="loading" @click="resend">
        Reenviar verificación
      </AppButton>
      <p v-if="sent" class="text-emerald-300 text-sm">Listo, te lo reenviamos 🎉</p>
      <p v-if="error" class="text-rose-300 text-sm">{{ error }}</p>

      <p class="text-slate-300 text-sm">¿Ya confirmaste? <RouterLink to="/login" class="text-sky-300 hover:text-sky-200">Iniciar sesión</RouterLink></p>
    </div>
  </div>
</template>


