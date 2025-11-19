<script>
import AppH1 from '../components/AppH1.vue'
import AppButton from '../components/AppButton.vue'
import { updatePassword } from '../services/auth'

export default {
  name: 'ResetPassword',
  components: { AppH1, AppButton },
  data() {
    return {
      loading: false,
      success: false,
      error: '',
      user: {
        password: '',
        confirm: ''
      }
    }
  },
  methods: {
    async handleSubmit() {
      this.error = ''
      if ((this.user.password || '').length < 6) {
        this.error = 'La contraseña debe tener al menos 6 caracteres.'
        return
      }
      if (this.user.password !== this.user.confirm) {
        this.error = 'Las contraseñas no coinciden.'
        return
      }
      try {
        this.loading = true
        await updatePassword(this.user.password)
        this.success = true
        setTimeout(() => this.$router.push('/login'), 1500)
      } catch (e) {
        this.error = e?.message || 'No pudimos actualizar la contraseña.'
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
      <h1 class="text-2xl font-bold">Restablecer contraseña</h1>
      <p class="text-slate-300 text-sm">Ingresá una nueva contraseña para tu cuenta.</p>
    </div>

    <form @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
      <div>
        <label class="label">Nueva contraseña</label>
        <input v-model="user.password" type="password" class="input" placeholder="••••••••" />
      </div>
      <div>
        <label class="label">Confirmar contraseña</label>
        <input v-model="user.confirm" type="password" class="input" placeholder="••••••••" />
      </div>
      <AppButton type="submit" class="w-full" :disabled="loading">Actualizar</AppButton>
      <p v-if="error" class="text-rose-300 text-sm">{{ error }}</p>
      <p v-if="success" class="text-emerald-300 text-sm">¡Listo! Redirigiendo al login…</p>
    </form>
  </div>
</template>
