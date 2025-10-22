import { createRouter, createWebHistory } from 'vue-router';
import { subscribeToAuthStateChanges, authReady, getAuthUser } from '../services/auth';
import Home from '../pages/Home.vue';
import GlobalChat from '../pages/GlobalChat.vue';
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
import PlayPoints from '../pages/PlayPoints.vue';
import PlayFree from '../pages/PlayFree.vue';
// Reuse Profile for public view by id

const routes = [
    { path: '/', component: Home },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/chat', component: GlobalChat, meta: { requiresAuth: true } },
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
    { path: '/u/:id', component: Profile },
    // About / Info
    { path: '/about/me', component: AboutMe },
    { path: '/about/goaldemy', component: AboutGoaldemy },
    { path: '/about/objetivo', component: AboutObjective },
    // Play landing pages
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true } },
    { path: '/play/free', component: PlayFree },
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
        return '/login';
    }
});

export default router;