<script>
import AppH1 from '../components/AppH1.vue';
import AppButton from '../components/AppButton.vue';
import { register } from '../services/auth';

export default {
  name: 'Register',
  components: {
    AppH1,
    AppButton
  },
  data() {
    return {
      user:{
        email: '',
        password: '',
      },
      loading: false,
      error: '',
      notice: '',
    };
  },
  methods: {
    async handleSubmit() {
      try{
        this.loading = true;
        this.error = ''
        this.notice = ''
        if ((this.user.password || '').length < 6) {
          this.error = 'La contraseña debe tener al menos 6 caracteres.'
          return
        }
        await register(this.user.email, this.user.password);
        this.notice = 'Revisá tu correo para confirmar tu cuenta.'
        this.$router.push('/profile');
      } catch(error){
        console.error(error);
        this.error = error?.message || 'No se pudo registrar.'
      }
      this.loading = false;
    },
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <AppH1>Registrarse</AppH1>

    <form action="#" @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4">
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
      <p v-if="error" class="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{{ error }}</p>
      <p v-if="notice" class="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">{{ notice }}</p>
      <div class="pt-2">
        <AppButton type="submit">Registrarse</AppButton>
      </div>
    </form>
  </div>
</template>