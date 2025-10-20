import { createRouter, createWebHistory } from 'vue-router';
import { subscribeToAuthStateChanges, authReady, getAuthUser } from '../services/auth';
import Home from '../pages/Home.vue';
import GlobalChat from '../pages/GlobalChat.vue';
import Login from '../pages/Login.vue';
import Register from '../pages/Register.vue';
import Profile from '../pages/Profile.vue';
import ProfileEdit from '../pages/ProfileEdit.vue';
import Games from '../pages/Games.vue';
import GuessPlayer from '../pages/games/GuessPlayer.vue';
import NationalityGame from '../pages/games/NationalityGame.vue';
import PlayerPosition from '../pages/games/PlayerPosition.vue';
import Leaderboards from '../pages/Leaderboards.vue';
// Reuse Profile for public view by id

const routes = [
    { path: '/', component: Home },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/chat', component: GlobalChat, meta: { requiresAuth: true } },
    { path: '/profile', component: Profile, meta: { requiresAuth: true } },
    { path: '/profile-edit', component: ProfileEdit, meta: { requiresAuth: true } },
    { path: '/games', component: Games },
    { path: '/games/guess-player', component: GuessPlayer, meta: { requiresAuth: true } },
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true } },
    { path: '/leaderboards', component: Leaderboards },
    { path: '/u/:id', component: Profile },
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