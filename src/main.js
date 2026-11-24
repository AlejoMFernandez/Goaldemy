// Fuentes self-hosted (@fontsource): sin Google Fonts, andan offline en la app
// nativa/PWA y no filtran IPs a terceros. Sólo subsets latin + latin-ext y los
// pesos que de verdad usa la app (ver --font-* en style.css, FulvoLogo y AppSplash).
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-ext-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-ext-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-ext-800.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-ext-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/space-grotesk/latin-ext-700.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-ext-800.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow-condensed/latin-ext-800-italic.css';
import './style.css';
import { createApp } from 'vue';
import router from './router/router.js';
import App from './App.vue';
import { initAchievementsRealtime } from './services/achievements-realtime.js';
import { initLevelUpRealtime } from './services/levelup-realtime.js';
import { installGlobalErrorHandler } from './services/errors.js';
import { pushErrorToast, pushSuccessToast, pushInfoToast } from './stores/notifications.js';
import { installTapOrigin, vPop } from './services/tap-origin.js';
import { ensurePlayersLoaded } from './services/players.js';

// Precarga de dataGAMES.json (~1 MB) en su propio chunk, en paralelo al primer
// render: la home no la espera y para cuando el usuario entra a un juego ya
// está en memoria (ver services/players.js y el beforeResolve del router).
ensurePlayersLoaded();

// Install global error handlers (toasts)
try { installGlobalErrorHandler() } catch {}

// Helper de consola SOLO en dev — probar los 3 tipos de toast sin pelearse con
// el cache de módulos de Vite (un import("...") suelto desde devtools a veces
// resuelve una instancia separada del store, desconectada de la app real).
// Uso en la consola del navegador: __toast.error('texto'), __toast.success(...), __toast.info(...)
if (import.meta.env.DEV) {
  window.__toast = { error: pushErrorToast, success: pushSuccessToast, info: pushInfoToast }
}

// Modales que salen desde el botón que los abrió (v-pop en la tarjeta del modal)
installTapOrigin();

const app = createApp(App);
app.directive('pop', vPop);
app.use(router);
app.mount('#app');

// Kick realtime after initial navigation to avoid interfering with login redirects
router.isReady().then(() => {
	try { initAchievementsRealtime(); } catch { /* ignore */ }
	try { initLevelUpRealtime(); } catch { /* ignore */ }
});
