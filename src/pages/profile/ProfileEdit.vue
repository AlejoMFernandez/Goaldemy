<script>
import AppButton from '../../components/common/AppButton.vue';
import { subscribeToAuthStateChanges, updateAuthUserData } from '../../services/auth';
import { supabase } from '../../services/supabase';
import countriesMap from '../../codeCOUNTRYS.json';
import { flagUrl } from '../../services/countries';
import SearchSelect from '../../components/common/SearchSelect.vue';
import { getAllPlayers, getAllTeams } from '../../services/players';
import CosmeticsCollection from '../../components/profile/CosmeticsCollection.vue';
import { ACCOUNT_DELETION_ENABLED, DELETE_CONFIRM_WORD, deleteMyAccount } from '../../services/account';

let unsubscribeAuth = () => {};

export default {
  name: 'ProfileEdit',
  components: { AppButton, SearchSelect, CosmeticsCollection },
  data() {
    return {
      user: null,
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
      _debounceTimer: null,
      // Zona de peligro: borrar cuenta (doble confirmación)
      accountDeletionEnabled: ACCOUNT_DELETION_ENABLED,
      deleteConfirmWord: DELETE_CONFIRM_WORD,
      deleteOpen: false,
      deleteText: '',
      deleting: false,
      deleteError: '',
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
    },
    cancelDelete() {
      this.deleteOpen = false;
      this.deleteText = '';
      this.deleteError = '';
    },
    async confirmDelete() {
      if (this.deleteText.trim() !== this.deleteConfirmWord || this.deleting) return;
      this.deleting = true;
      this.deleteError = '';
      const res = await deleteMyAccount(this.deleteText);
      this.deleting = false;
      if (!res.ok) {
        this.deleteError = res.error;
        return;
      }
      this.$router.replace('/');
    }
  },
  mounted() {
    let initialized = false
    unsubscribeAuth = subscribeToAuthStateChanges(userState => {
      if (initialized) {
        this.user = userState
        return
      }
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
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
        initialized = true
      }, 100)
    });
  },
  unmounted() {
    unsubscribeAuth();
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <button type="button" @click="$router.push('/profile')"
            class="group inline-flex items-center gap-1.5 mb-3 text-slate-400 hover:text-white transition">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"><path d="M15 18l-6-6 6-6" /></svg>
      <span class="text-sm">Perfil</span>
    </button>

    <CosmeticsCollection class="block" :avatar-url="user?.avatar_url || ''" :name="formData.display_name" :initial="avatarInitial">
      <template #datos>
        <form @submit.prevent="handleSubmit" class="space-y-4">
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

        <!-- Zona de peligro: borrar cuenta (requisito de Apple). Doble confirmación: abrir + tipear BORRAR. -->
        <section v-if="accountDeletionEnabled" class="mt-10 rounded-xl border border-red-500/30 bg-red-500/5 p-4" aria-labelledby="danger-zone-title">
          <h2 id="danger-zone-title" class="text-sm font-semibold text-red-300">Zona de peligro</h2>
          <p class="mt-1 text-sm text-slate-400">
            Borrar tu cuenta elimina para siempre tu progreso, XP, logros, Fichas, Balones, cosméticos y mensajes.
            Si tenés un plan pago, se cancela. No se puede deshacer.
          </p>

          <button v-if="!deleteOpen" type="button" @click="deleteOpen = true"
                  class="mt-3 inline-flex items-center rounded-lg border border-red-500/50 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 transition">
            Borrar mi cuenta
          </button>

          <div v-else class="mt-3 space-y-3">
            <label for="delete-confirm" class="label">
              Para confirmar, escribí <strong class="text-red-300">{{ deleteConfirmWord }}</strong>
            </label>
            <input id="delete-confirm" v-model="deleteText" type="text" class="input" autocomplete="off"
                   autocapitalize="characters" spellcheck="false" :placeholder="deleteConfirmWord" :disabled="deleting" />
            <p v-if="deleteError" class="text-sm text-red-400" role="alert">{{ deleteError }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" @click="confirmDelete"
                      :disabled="deleteText.trim() !== deleteConfirmWord || deleting"
                      class="inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition">
                {{ deleting ? 'Borrando…' : 'Borrar mi cuenta para siempre' }}
              </button>
              <button type="button" @click="cancelDelete" :disabled="deleting"
                      class="inline-flex items-center rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white transition">
                Cancelar
              </button>
            </div>
          </div>
        </section>
      </template>
    </CosmeticsCollection>
  </div>
</template>

