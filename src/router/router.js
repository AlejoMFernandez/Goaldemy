import { createRouter, createWebHistory } from 'vue-router';
import { pushInfoToast } from '../stores/notifications';
import { subscribeToAuthStateChanges, authReady, getAuthUser } from '../services/auth';
import { isAdmin } from '../services/admin';
import Landing from '../pages/Landing.vue';
import Login from '../pages/auth/Login.vue';
import Register from '../pages/auth/Register.vue';
import VerifyEmail from '../pages/auth/VerifyEmail.vue';
import ResetPassword from '../pages/auth/ResetPassword.vue';
import Profile from '../pages/profile/Profile.vue';
import ProfileEdit from '../pages/profile/ProfileEdit.vue';
import UserPublic from '../pages/profile/UserPublic.vue';
import GuessPlayer from '../pages/games/GuessPlayer.vue';
import NationalityGame from '../pages/games/NationalityGame.vue';
import PlayerPosition from '../pages/games/PlayerPosition.vue';
import WhoIs from '../pages/games/WhoIs.vue';
import ValueOrder from '../pages/games/ValueOrder.vue';
import AgeOrder from '../pages/games/AgeOrder.vue';
import HeightOrder from '../pages/games/HeightOrder.vue';
import ShirtNumber from '../pages/games/ShirtNumber.vue';
import OnceIdeal from '../pages/games/OnceIdeal.vue';
import FootballWordle from '../pages/games/FootballWordle.vue';
import HigherOrLower from '../pages/games/HigherOrLower.vue';
import Connections from '../pages/games/Connections.vue';
import FootballGrid from '../pages/games/FootballGrid.vue';
import StatChallenge from '../pages/games/StatChallenge.vue';
import Leaderboards from '../pages/Leaderboards.vue';
import AboutMe from '../pages/info/AboutMe.vue';
import AboutGoaldemy from '../pages/info/AboutGoaldemy.vue';
import AboutObjective from '../pages/info/AboutObjective.vue';
import NotFound from '../pages/NotFound.vue';
import PlayPoints from '../pages/PlayPoints.vue';
import PlayFree from '../pages/PlayFree.vue';
import RewardCenter from '../pages/RewardCenter.vue';
import Notifications from '../pages/social/Notifications.vue';
import DirectChat from '../pages/social/DirectChat.vue';
import DirectMessages from '../pages/social/DirectMessages.vue';
import AdminPanel from '../pages/admin/AdminPanel.vue';
import Teams from '../pages/Teams.vue';
import PremierLeague from '../pages/leagues/PremierLeague.vue';
import LaLiga from '../pages/leagues/LaLiga.vue';
import SerieA from '../pages/leagues/SerieA.vue';
import Bundesliga from '../pages/leagues/Bundesliga.vue';
import Ligue1 from '../pages/leagues/Ligue1.vue';
import LigaArgentina from '../pages/leagues/LigaArgentina.vue';
import WorldCup from '../pages/leagues/WorldCup.vue';
import TeamPage from '../pages/TeamPage.vue';
import Pricing from '../pages/Pricing.vue';

const routes = [
    { path: '/', component: Landing },
    { path: '/leagues/world-cup', component: WorldCup },
    { path: '/leagues/premier-league', component: PremierLeague },
    { path: '/leagues/la-liga', component: LaLiga },
    { path: '/leagues/serie-a', component: SerieA },
    { path: '/leagues/bundesliga', component: Bundesliga },
    { path: '/leagues/ligue-1', component: Ligue1 },
    { path: '/leagues/liga-argentina', component: LigaArgentina },
    { path: '/team/:teamId', component: TeamPage },
    { path: '/login', component: Login, meta: { layout: 'auth' } },
    { path: '/register', component: Register, meta: { layout: 'auth' } },
    { path: '/verify-email', component: VerifyEmail, meta: { layout: 'auth' } },
    { path: '/reset-password', component: ResetPassword, meta: { layout: 'auth' } },
    { path: '/profile', component: Profile, meta: { requiresAuth: true } },
    { path: '/profile-edit', component: ProfileEdit, meta: { requiresAuth: true } },
    { path: '/teams', component: Teams },
    { path: '/games/guess-player', component: GuessPlayer, meta: { requiresAuth: true } },
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true } },
    { path: '/games/who-is', component: WhoIs, meta: { requiresAuth: true } },
    { path: '/games/value-order', component: ValueOrder, meta: { requiresAuth: true } },
    { path: '/games/age-order', component: AgeOrder, meta: { requiresAuth: true } },
    { path: '/games/height-order', component: HeightOrder, meta: { requiresAuth: true } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { requiresAuth: true } },
    { path: '/games/once-ideal', component: OnceIdeal, meta: { requiresAuth: true } },
    { path: '/games/football-wordle', component: FootballWordle, meta: { requiresAuth: true } },
    { path: '/games/higher-or-lower', component: HigherOrLower, meta: { requiresAuth: true } },
    { path: '/games/connections', component: Connections, meta: { requiresAuth: true } },
    { path: '/games/football-grid', component: FootballGrid, meta: { requiresAuth: true } },
    { path: '/games/stat-challenge', component: StatChallenge, meta: { requiresAuth: true } },
    { path: '/leaderboards', component: Leaderboards },
    { path: '/u/:id', component: Profile, meta: { requiresAuth: true } },
    { path: '/notifications', component: Notifications, meta: { requiresAuth: true } },
    { path: '/messages', component: DirectMessages, meta: { requiresAuth: true } },
    { path: '/messages/:peerId', component: DirectChat, meta: { requiresAuth: true } },
    // Admin Panel
    { path: '/admin', component: AdminPanel, meta: { requiresAuth: true, requiresAdmin: true } },
    // About / Info
    { path: '/about/me', component: AboutMe },
    { path: '/about/goaldemy', component: AboutGoaldemy },
    { path: '/about/objetivo', component: AboutObjective },
    // Play landing pages
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true } },
    { path: '/play/free', component: PlayFree },
    { path: '/rewards', component: RewardCenter, meta: { requiresAuth: true } },
    { path: '/pricing', component: Pricing },
    // 404 fallback
    { path: '/:pathMatch(.*)*', component: NotFound },
]

const router = createRouter({
    routes,
    history: createWebHistory(),
    scrollBehavior(to) {
        // Anchor (#seccion): scrollear a ese elemento
        if (to.hash) return { el: to.hash, behavior: 'smooth' };
        // Siempre arrancar arriba (incluso al volver) — pedido del owner
        return { top: 0, left: 0 };
    },
});

let user = getAuthUser();

subscribeToAuthStateChanges(userState => {
    user = userState;
});
router.beforeEach(async (to, from) => {
    // Esperar a que la capa de auth inicial termine (getUser) antes de decidir
    await authReady;
    user = getAuthUser();
    // Si está logueado pero no tiene email confirmado, forzar verificación
    if (user.id && !user.email_confirmed_at && to.path !== '/verify-email') {
        try { if (to.path !== '/verify-email') pushInfoToast('Confirmá tu email para continuar'); } catch {}
        return '/verify-email';
    }
    if (to.meta.requiresAuth && !user.id) {
        try { if (to.path !== '/login') pushInfoToast('Necesitás iniciar sesión'); } catch {}
        return '/login';
    }
    // Check admin access for admin routes
    if (to.meta.requiresAdmin) {
        const adminAccess = await isAdmin();
        if (!adminAccess) {
            pushInfoToast('No tenés permisos de administrador');
            return '/';
        }
    }
    // If user is logged-in, avoid showing auth pages
    if (user.id && (to.path === '/login' || to.path === '/register')) {
        return '/'
    }
});

// Garantiza el scroll arriba tras cada navegación, inmune al timing de la
// transición out-in (el scrollBehavior solo no alcanza con transiciones).
router.afterEach((to) => {
    if (to.hash) return;
    const toTop = () => window.scrollTo({ top: 0, left: 0 });
    requestAnimationFrame(toTop);
    setTimeout(toTop, 320);
});

export default router;