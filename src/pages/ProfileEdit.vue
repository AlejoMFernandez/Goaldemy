<script>
import AppH1 from '../components/AppH1.vue';
import AppButton from '../components/AppButton.vue';
import { subscribeToAuthStateChanges, updateAuthUserData } from '../services/auth';
import { supabase } from '../services/supabase';
<<<<<<< HEAD
=======
import countriesMap from '../codeCOUNTRYS.json';
import { flagUrl } from '../services/countries';
import SearchSelect from '../components/SearchSelect.vue';
import { getAllPlayers, getAllTeams } from '../services/players';
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)

let unsubscribeAuth = () => {};

export default {
  name: 'ProfileEdit',
  components: {
    AppH1,
<<<<<<< HEAD
    AppButton
=======
    AppButton,
    SearchSelect,
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
  },
  data() {
    return {
      formData: {
        display_name: '',
        bio: '',
        career: '',
        avatar_url: '',
<<<<<<< HEAD
      },
      avatarFile: null,
      loading: false,
=======
        nationality_code: '',
        favorite_team: '',
        favorite_player: '',
      },
      avatarFile: null,
      loading: false,
      countries: Object.entries(countriesMap).map(([code, name]) => ({ code: code.toLowerCase(), name })).sort((a,b) => a.name.localeCompare(b.name,'es')),
      players: getAllPlayers().map(p => ({ value: p.name, label: p.name })),
      teams: getAllTeams().map(t => ({ value: t.name, label: t.name })),
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
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
    async handleSubmit(){
      try {
        this.loading = true;
        // If user selected an avatar image, upload it first
        if (this.avatarFile) {
          const ext = this.avatarFile.name.split('.').pop()
          const path = `avatars/${this.user.id}.${ext}`
          const { error: upErr } = await supabase.storage.from('avatars').upload(path, this.avatarFile, { upsert: true, contentType: this.avatarFile.type })
          if (upErr) throw upErr
          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
          this.formData.avatar_url = pub?.publicUrl || ''
        }
        await updateAuthUserData(this.formData);
        this.$router.push('/profile');
      } catch (error) {

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
        avatar_url: userState.avatar_url ?? '',
<<<<<<< HEAD
=======
        nationality_code: userState.nationality_code ?? '',
        favorite_team: userState.favorite_team ?? '',
        favorite_player: userState.favorite_player ?? '',
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
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
      <div>
        <label class="label">Avatar</label>
        <div class="flex items-center gap-3">
          <img v-if="formData.avatar_url" :src="formData.avatar_url" alt="avatar" class="w-12 h-12 rounded-lg object-cover border border-white/10" />
          <input type="file" accept="image/*" @change="e => avatarFile = e.target.files?.[0] || null" />
        </div>
        <p class="text-xs text-slate-400 mt-1">JPG/PNG. Se mostrará en tu perfil y rankings.</p>
      </div>
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
<<<<<<< HEAD
=======
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
>>>>>>> d0aeee3 (Opciones en Registro, agregado de logros y fix de XP)
      <!-- redireccionamos a perfil -->
      <AppButton type="submit">Guardar cambios</AppButton>
    </form>
  </div>
</template>