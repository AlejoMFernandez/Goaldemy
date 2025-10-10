import { createRouter, createWebHistory } from 'vue-router';
import { subscribeToAuthStateChanges } from '../services/auth';
import Home from '../pages/Home.vue';
import GlobalChat from '../pages/GlobalChat.vue';
import Login from '../pages/Login.vue';
import Register from '../pages/Register.vue';
import Profile from '../pages/Profile.vue';
import ProfileEdit from '../pages/ProfileEdit.vue';
import Games from '../pages/Games.vue';
import GuessPlayer from '../pages/games/GuessPlayer.vue';
import NationalityGame from '../pages/games/NationalityGame.vue';

const routes = [
    {         path: '/',              component: Home },
    {         path: '/Login',         component: Login },
    {         path: '/Register',      component: Register },
    {         path: '/Chat',          component: GlobalChat, meta: { requiresAuth: true } },
    {         path: '/Profile',       component: Profile, meta: { requiresAuth: true } },
    {         path: '/ProfileEdit',   component: ProfileEdit, meta: { requiresAuth: true } },
    {         path: '/Games',         component: Games },
    {         path: '/Games/guess-player', component: GuessPlayer, meta: { requiresAuth: true } },
    {         path: '/Games/nationality', component: NationalityGame, meta: { requiresAuth: true } },

]

const router = createRouter({
    routes,
    history: createWebHistory(),
});

let user = {
    id: null,
    email: null,
}

subscribeToAuthStateChanges(userState => {
    user = userState;
});
router.beforeEach((to, from) => {
    if (to.meta.requiresAuth && user.id === null) {
        return '/login' ;
    } 
});

export default router;