import './style.css';
import { createApp } from 'vue';
import router from './router/router.js';
import App from './App.vue';
import { initAchievementsRealtime } from './services/achievements-realtime.js';
import { initLevelUpRealtime } from './services/levelup-realtime.js';
import { installGlobalErrorHandler } from './services/errors.js';

// Install global error handlers (toasts)
try { installGlobalErrorHandler() } catch {}

const app = createApp(App);
app.use(router);
app.mount('#app');

// Kick realtime after initial navigation to avoid interfering with login redirects
router.isReady().then(() => {
	try { initAchievementsRealtime(); } catch { /* ignore */ }
	try { initLevelUpRealtime(); } catch { /* ignore */ }
});
