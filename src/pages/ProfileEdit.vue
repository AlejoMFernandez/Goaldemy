<script>
import AppH1 from '../components/AppH1.vue';
import AppButton from '../components/AppButton.vue';
import { subscribeToAuthStateChanges, updateAuthUserData } from '../services/auth';
import { supabase } from '../services/supabase';
import countriesMap from '../codeCOUNTRYS.json';
import { flagUrl } from '../services/countries';
import SearchSelect from '../components/SearchSelect.vue';
import { getAllPlayers, getAllTeams } from '../services/players';

let unsubscribeAuth = () => {};

export default {
  name: 'ProfileEdit',
  components: { AppH1, AppButton, SearchSelect },
  data() {
    return {
      formData: {
        display_name: '',
        bio: '',
        career: '',
        nationality_code: '',
        favorite_team: '',
        favorite_player: '',
        linkedin_url: '',
        github_url: '',
        x_url: '',
        instagram_url: '',
      },
      loading: false,
      countries: Object.entries(countriesMap).map(([code, name]) => ({ code: code.toLowerCase(), name })).sort((a,b) => a.name.localeCompare(b.name,'es')),
      players: getAllPlayers().map(p => ({ value: p.name, label: p.name })),
      teams: getAllTeams().map(t => ({ value: t.name, label: t.name })),
    }
  },
  computed: {
    avatarInitial() {
      if (!this.user?.email) return '?';
      const letter = this.user.email.trim()[0] || '?';
      return letter.toUpperCase();
    }
  },
  methods: {
    flagUrl,
    async handleSubmit(){
      try {
        this.loading = true;
        await updateAuthUserData(this.formData);
        this.$router.push('/profile');
      } catch (error) {
        console.error('[ProfileEdit] save profile failed:', error)
        alert(error?.message || 'No se pudo guardar el perfil')
      }
      this.loading = false;
    }
  },
  mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(userState => {
      this.formData = {
        display_name: userState.display_name ?? '',
        bio: userState.bio ?? '',
        career: userState.career ?? '',
  nationality_code: userState.nationality_code ?? '',
  favorite_team: userState.favorite_team ?? '',
  favorite_player: userState.favorite_player ?? '',
  linkedin_url: userState.linkedin_url ?? '',
  github_url: userState.github_url ?? '',
  x_url: userState.x_url ?? '',
  instagram_url: userState.instagram_url ?? '',
      }
      this.user = userState
    });
  },
  unmounted() {
    unsubscribeAuth();
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <AppH1>Editar mi Perfil</AppH1>

    <form @submit.prevent="handleSubmit" class="card card-hover p-6 space-y-4"> 
      <!-- Avatar upload removed intentionally to keep visual style consistent -->
      <div>
        <label for="display_name" class="label">Nombre para mostrar</label>
        <input
          autofocus
          type="text"
          class="input"
          id="display_name"
          placeholder="Tu nombre"
          v-model="formData.display_name"
        />
      </div>      
      <div>
        <label for="bio" class="label">Biografía</label>
        <textarea
          type="text"
          class="input"
          id="bio"
          placeholder="Tu biografía"
          v-model="formData.bio"
        >
        </textarea>
      </div>      
      <div>
        <label for="career" class="label">Carrera</label>
        <input
          type="text"
          class="input"
          id="career"
          placeholder="Tu carrera"
          v-model="formData.career"
        />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="label" for="nationality">Nacionalidad</label>
          <div class="flex items-center gap-2">
            <img v-if="formData.nationality_code" :src="flagUrl(formData.nationality_code, 24)" :alt="formData.nationality_code" width="24" height="16" class="rounded ring-1 ring-white/10" />
            <select id="nationality" v-model="formData.nationality_code" class="select w-full">
              <option value="">— Selecciona un país —</option>
              <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <div>
          <SearchSelect label="Equipo favorito" v-model="formData.favorite_team" :options="teams" placeholder="Escribe 3 letras para filtrar" />
        </div>
      </div>
      <div>
        <SearchSelect label="Jugador favorito" v-model="formData.favorite_player" :options="players" placeholder="Escribe 3 letras para filtrar" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label for="linkedin" class="label">LinkedIn</label>
          <input
            id="linkedin"
            type="url"
            class="input"
            placeholder="https://www.linkedin.com/in/tuusuario"
            v-model="formData.linkedin_url"
          />
        </div>
        <div>
          <label for="github" class="label">GitHub</label>
          <input
            id="github"
            type="url"
            class="input"
            placeholder="https://github.com/tuusuario"
            v-model="formData.github_url"
          />
        </div>
        <div>
          <label for="xurl" class="label">X (Twitter)</label>
          <input
            id="xurl"
            type="url"
            class="input"
            placeholder="https://x.com/tuusuario"
            v-model="formData.x_url"
          />
        </div>
        <div>
          <label for="instagram" class="label">Instagram</label>
          <input
            id="instagram"
            type="url"
            class="input"
            placeholder="https://instagram.com/tuusuario"
            v-model="formData.instagram_url"
          />
        </div>
      </div>
      <!-- redireccionamos a perfil -->
      <AppButton type="submit">Guardar cambios</AppButton>
    </form>
  </div>
</template>