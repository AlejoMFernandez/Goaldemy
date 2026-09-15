import './style.css';
import { createApp } from 'vue';
import router from './router/router.js';
import App from './App.vue';
import { initAchievementsRealtime } from './services/achievements-realtime.js';
import { initLevelUpRealtime } from './services/levelup-realtime.js';
import { installGlobalErrorHandler } from './services/errors.js';
import { pushErrorToast, pushSuccessToast, pushInfoToast } from './stores/notifications.js';

// Install global error handlers (toasts)
try { installGlobalErrorHandler() } catch {}

// Helper de consola SOLO en dev — probar los 3 tipos de toast sin pelearse con
// el cache de módulos de Vite (un import("...") suelto desde devtools a veces
// resuelve una instancia separada del store, desconectada de la app real).
// Uso en la consola del navegador: __toast.error('texto'), __toast.success(...), __toast.info(...)
if (import.meta.env.DEV) {
  window.__toast = { error: pushErrorToast, success: pushSuccessToast, info: pushInfoToast }
}

const app = createApp(App);
app.use(router);
app.mount('#app');

// Kick realtime after initial navigation to avoid interfering with login redirects
router.isReady().then(() => {
	try { initAchievementsRealtime(); } catch { /* ignore */ }
	try { initLevelUpRealtime(); } catch { /* ignore */ }
});
