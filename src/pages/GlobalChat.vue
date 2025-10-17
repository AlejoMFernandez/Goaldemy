<script>
import AppH1 from '../components/AppH1.vue';
import AppButton from '../components/AppButton.vue';
import { fetchLastGlobalChatMessages, saveGlobalChatMessage, suscribeToGlobalChatMessages } from '../services/global-chat';
import { subscribeToAuthStateChanges } from '../services/auth';
import { formatShortDate } from '../services/formatters';

let unsubscribeAuth = () => {};
let unsubscribeChat = () => {};

export default {
  name: 'GlobalChat',
  components: {
    AppH1,
    AppButton
  },
  data() {
    return {
      messages: [],
      newMessage: {
        content: '',
      },
      user: {
        id: '',
        email: ''
      }
    };
  },
  methods: {
    async handleSubmit() {
      const raw = this.newMessage.content || ''
      // Trim trailing whitespace/newlines; block empty messages
      const trimmedEnd = raw.replace(/\s+$/g, '')
      if (trimmedEnd.trim().length === 0) return
      await saveGlobalChatMessage({
        sender_id: this.user.id,
        email: this.user.email,
        content: trimmedEnd
      })
      this.newMessage.content = ''
    },
    formatShortDate,
  },
  async mounted() {
    unsubscribeAuth = subscribeToAuthStateChanges(userState => this.user = userState); 

    unsubscribeChat = suscribeToGlobalChatMessages(async newMessage => {
      try{
        this.messages.push(newMessage);
        await this.$nextTick();

        this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight;
      } catch(error){
        console.error(error);
      }
    });
    
    this.messages = await fetchLastGlobalChatMessages();

    await this.$nextTick();
    this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight;
  },
  unmounted() {
    unsubscribeAuth();
    unsubscribeChat();
  }
};
</script>

<template>
  <div>
    <AppH1>Chat general</AppH1>
    <div class="flex flex-col md:flex-row gap-6">
      <section
        class="card w-full md:w-9/12 max-h-[60vh] overflow-y-auto p-4"
        ref="chatContainer"
      >
        <h2 class="sr-only">Lista de mensajes</h2>
        <ol class="relative flex flex-col gap-4 items-start">
            <li
              v-for="message in messages"
              :key="message.id"
              class="w-fit max-w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-slate-100 shadow-sm"
            >
              <div class="m-0 text-sm font-semibold text-slate-200"><span>{{ message.email }}</span></div>
              <div class="my-1 whitespace-pre-line">{{ message.content }}</div>
              <!-- hora formateada a: dia/mes SIN AÑO hora:minutos -->
              <div class="m-0 text-xs font-light text-slate-400">{{ formatShortDate(message.created_at) }}</div>
            </li>
        </ol>
      </section>
      <section class="md:w-3/12 w-full">
        <h2 class="mb-4 text-2xl">Enviar mensaje</h2>
        <form action="#" @submit.prevent="handleSubmit" class="card card-hover p-4 space-y-4">
          <div>
            <span class="label">Correo electrónico</span>
            {{ user.email }}
          </div>
          <div>
            <label for="content" class="label">Contenido</label>
            <textarea
              required
              id="content"
              class="input min-h-40"
              placeholder="Escribe tu mensaje"
              v-model="newMessage.content"
              @keydown.enter.exact.prevent="handleSubmit"
            ></textarea>
          </div>
          <AppButton type="submit">Enviar</AppButton>
        </form>
      </section>
    </div>
  </div>
</template>