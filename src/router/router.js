import { createRouter, createWebHistory } from 'vue-router';
import { pushInfoToast } from '../stores/notifications';
import { subscribeToAuthStateChanges, authReady, getAuthUser } from '../services/auth';
import Home from '../pages/Home.vue';
import Landing from '../pages/Landing.vue';
import Login from '../pages/Login.vue';
import Register from '../pages/Register.vue';
import Profile from '../pages/Profile.vue';
import ProfileEdit from '../pages/ProfileEdit.vue';
import GuessPlayer from '../pages/games/GuessPlayer.vue';
import NationalityGame from '../pages/games/NationalityGame.vue';
import PlayerPosition from '../pages/games/PlayerPosition.vue';
import WhoIs from '../pages/games/WhoIs.vue';
import ValueOrder from '../pages/games/ValueOrder.vue';
import AgeOrder from '../pages/games/AgeOrder.vue';
import HeightOrder from '../pages/games/HeightOrder.vue';
import ShirtNumber from '../pages/games/ShirtNumber.vue';
import Leaderboards from '../pages/Leaderboards.vue';
import AboutMe from '../pages/AboutMe.vue';
import AboutGoaldemy from '../pages/AboutGoaldemy.vue';
import AboutObjective from '../pages/AboutObjective.vue';
import NotFound from '../pages/NotFound.vue';
import PlayPoints from '../pages/PlayPoints.vue';
import PlayFree from '../pages/PlayFree.vue';
import Notifications from '../pages/Notifications.vue';
import DirectChat from '../pages/DirectChat.vue';
import DirectMessages from '../pages/DirectMessages.vue';

const routes = [
    { path: '/', component: Landing },
    { path: '/home', component: Home },
    { path: '/login', component: Login, meta: { layout: 'auth' } },
    { path: '/register', component: Register, meta: { layout: 'auth' } },
    { path: '/profile', component: Profile, meta: { requiresAuth: true } },
    { path: '/profile-edit', component: ProfileEdit, meta: { requiresAuth: true } },
    { path: '/games/guess-player', component: GuessPlayer, meta: { requiresAuth: true } },
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true } },
    { path: '/games/who-is', component: WhoIs, meta: { requiresAuth: true } },
    { path: '/games/value-order', component: ValueOrder, meta: { requiresAuth: true } },
    { path: '/games/age-order', component: AgeOrder, meta: { requiresAuth: true } },
    { path: '/games/height-order', component: HeightOrder, meta: { requiresAuth: true } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { requiresAuth: true } },
    { path: '/leaderboards', component: Leaderboards },
    { path: '/u/:id', component: Profile, meta: { requiresAuth: true } },
    { path: '/notifications', component: Notifications, meta: { requiresAuth: true } },
    { path: '/messages', component: DirectMessages, meta: { requiresAuth: true } },
    { path: '/messages/:peerId', component: DirectChat, meta: { requiresAuth: true } },
    // About / Info
    { path: '/about/me', component: AboutMe },
    { path: '/about/goaldemy', component: AboutGoaldemy },
    { path: '/about/objetivo', component: AboutObjective },
    // Play landing pages
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true } },
    { path: '/play/free', component: PlayFree },
    // 404 fallback
    { path: '/:pathMatch(.*)*', component: NotFound },
]

const router = createRouter({
    routes,
    history: createWebHistory(),
});

let user = getAuthUser();

subscribeToAuthStateChanges(userState => {
    user = userState;
});
router.beforeEach(async (to, from) => {
    // Esperar a que la capa de auth inicial termine (getUser) antes de decidir
    await authReady;
    user = getAuthUser();
    if (to.meta.requiresAuth && !user.id) {
        try { if (to.path !== '/login') pushInfoToast('Necesitás iniciar sesión'); } catch {}
        return '/login';
    }
    // If user is logged-in, avoid showing auth pages
    if (user.id && (to.path === '/login' || to.path === '/register')) {
        return '/'
    }
});

export default router;