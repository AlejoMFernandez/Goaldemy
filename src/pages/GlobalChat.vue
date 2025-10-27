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
    isOwn(msg) {
      return !!msg && (msg.sender_id === this.user.id || msg.email === this.user.email)
    },
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
    <section class="card p-0 overflow-hidden">
      <!-- Chat messages area -->
      <div class="flex flex-col h-[60vh] sm:h-[70vh]">
        <div class="flex-1 overflow-y-auto p-4" ref="chatContainer">
          <h2 class="sr-only">Lista de mensajes</h2>
          <ol class="relative flex flex-col gap-3 items-start">
              <li
                v-for="message in messages"
                :key="message.id"
                :class="[
                  'w-fit max-w-[90%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-slate-100 shadow-sm border',
                  isOwn(message)
                    ? 'ml-auto bg-emerald-500/15 border-emerald-400/30'
                    : 'bg-white/5 border-white/10'
                ]"
              >
                        <div class="m-0 text-xs sm:text-xs font-semibold text-slate-300" v-if="!isOwn(message)"><span>{{ message.display_name || message.email }}</span></div>
                <div class="whitespace-pre-line break-words text-sm">{{ message.content }}</div>
                        <div class="m-0 text-[11px] text-slate-400" :class="isOwn(message) ? 'text-right' : 'text-left'">{{ formatShortDate(message.created_at) }}</div>
              </li>
          </ol>
        </div>
        <!-- Input bar (WhatsApp-like) -->
        <form action="#" @submit.prevent="handleSubmit" class="p-2 bg-slate-900/60 border-t border-white/10">
          <div class="flex items-center gap-2">
            <div class="flex-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-3 pr-1.5 py-1.5">
              <input
                v-model="newMessage.content"
                type="text"
                placeholder="Escribe un mensaje"
                class="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-400"
                @keydown.enter.exact.prevent="handleSubmit"
              />
              <button type="submit" class="shrink-0 rounded-full bg-[oklch(0.62_0.21_270)] hover:brightness-110 text-white h-10 w-10 grid place-items-center">
                <!-- paper plane icon -->
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>