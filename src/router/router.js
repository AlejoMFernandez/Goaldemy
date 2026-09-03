import { createRouter, createWebHistory } from 'vue-router';
import { pushInfoToast } from '../stores/notifications';
import { subscribeToAuthStateChanges, authReady, getAuthUser } from '../services/auth';
import { isAdmin } from '../services/admin';

// La home se importa de forma EAGER: es la ruta de entrada, así el LCP no
// espera un chunk extra. Todo lo demás es LAZY (code-splitting por ruta):
// cada página/juego baja en su propio chunk sólo al navegar, así el bundle
// inicial no arrastra los 15 juegos + su data de jugadores (dataGAMES.json).
import Landing from '../pages/Landing.vue';
const AuthPage = () => import('../pages/auth/AuthPage.vue');
const VerifyEmail = () => import('../pages/auth/VerifyEmail.vue');
const ResetPassword = () => import('../pages/auth/ResetPassword.vue');
const Profile = () => import('../pages/profile/Profile.vue');
const ProfileEdit = () => import('../pages/profile/ProfileEdit.vue');
const GuessPlayer = () => import('../pages/games/GuessPlayer.vue');
const NationalityGame = () => import('../pages/games/NationalityGame.vue');
const PlayerPosition = () => import('../pages/games/PlayerPosition.vue');
const WhoIs = () => import('../pages/games/WhoIs.vue');
const ValueOrder = () => import('../pages/games/ValueOrder.vue');
const AgeOrder = () => import('../pages/games/AgeOrder.vue');
const HeightOrder = () => import('../pages/games/HeightOrder.vue');
const ShirtNumber = () => import('../pages/games/ShirtNumber.vue');
const OnceIdeal = () => import('../pages/games/OnceIdeal.vue');
const FootballWordle = () => import('../pages/games/FootballWordle.vue');
const HigherOrLower = () => import('../pages/games/HigherOrLower.vue');
const Connections = () => import('../pages/games/Connections.vue');
const FootballGrid = () => import('../pages/games/FootballGrid.vue');
const StatChallenge = () => import('../pages/games/StatChallenge.vue');
const Leaderboards = () => import('../pages/Leaderboards.vue');
const AboutMe = () => import('../pages/info/AboutMe.vue');
const AboutFulvo = () => import('../pages/info/AboutFulvo.vue');
const AboutObjective = () => import('../pages/info/AboutObjective.vue');
const NotFound = () => import('../pages/NotFound.vue');
const PlayPoints = () => import('../pages/PlayPoints.vue');
const RewardCenter = () => import('../pages/RewardCenter.vue');
const Tienda = () => import('../pages/Tienda.vue');
const Notifications = () => import('../pages/social/Notifications.vue');
const DirectChat = () => import('../pages/social/DirectChat.vue');
const DirectMessages = () => import('../pages/social/DirectMessages.vue');
const AdminPanel = () => import('../pages/admin/AdminPanel.vue');
const Teams = () => import('../pages/Teams.vue');
const CompetitionsHub = () => import('../pages/leagues/CompetitionsHub.vue');
const CompetitionPage = () => import('../pages/leagues/CompetitionPage.vue');
const TeamPage = () => import('../pages/TeamPage.vue');
const Pricing = () => import('../pages/Pricing.vue');
const DailyChallenge = () => import('../pages/DailyChallenge.vue');
const Career = () => import('../pages/Career.vue');
const PrivacyPolicy = () => import('../pages/legal/PrivacyPolicy.vue');
const TermsOfService = () => import('../pages/legal/TermsOfService.vue');

const routes = [
    { path: '/', component: Landing, meta: { zone: 'hub' } },
    { path: '/competiciones', component: CompetitionsHub, meta: { zone: 'data' } },
    { path: '/leagues', redirect: '/competiciones' },
    { path: '/leagues/:slug', component: CompetitionPage, meta: { zone: 'data' } },
    { path: '/team/:teamId', component: TeamPage, meta: { zone: 'data' } },
    { path: '/login', component: AuthPage, meta: { layout: 'auth', zone: 'hub', authGroup: 'auth' } },
    { path: '/register', component: AuthPage, meta: { layout: 'auth', zone: 'hub', authGroup: 'auth' } },
    { path: '/verify-email', component: VerifyEmail, meta: { layout: 'auth', zone: 'hub' } },
    { path: '/reset-password', component: ResetPassword, meta: { layout: 'auth', zone: 'hub' } },
    { path: '/profile', component: Profile, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/profile-edit', component: ProfileEdit, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/teams', component: Teams, meta: { zone: 'data' } },
    // Piloto de modo invitado: se puede jugar sin cuenta, el resultado se reclama al registrarse (ver services/guest-play.js)
    { path: '/games/guess-player', component: GuessPlayer, meta: { immersive: true, zone: 'play' } },
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/who-is', component: WhoIs, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/value-order', component: ValueOrder, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/age-order', component: AgeOrder, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/height-order', component: HeightOrder, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/once-ideal', component: OnceIdeal, meta: { requiresAuth: true, zone: 'play' } },
    { path: '/games/football-wordle', component: FootballWordle, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/higher-or-lower', component: HigherOrLower, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/connections', component: Connections, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/football-grid', component: FootballGrid, meta: { requiresAuth: true, immersive: true, zone: 'play' } },
    { path: '/games/stat-challenge', component: StatChallenge, meta: { requiresAuth: true, zone: 'play' } },
    { path: '/leaderboards', component: Leaderboards, meta: { zone: 'data' } },
    { path: '/u/:id', component: Profile, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/notifications', component: Notifications, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/messages', component: DirectMessages, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/messages/:peerId', component: DirectChat, meta: { requiresAuth: true, zone: 'hub' } },
    // Admin Panel
    { path: '/admin', component: AdminPanel, meta: { requiresAuth: true, requiresAdmin: true, zone: 'data' } },
    // About / Info
    { path: '/about/me', component: AboutMe, meta: { zone: 'hub' } },
    { path: '/about/fulvo', component: AboutFulvo, meta: { zone: 'hub' } },
    { path: '/about/objetivo', component: AboutObjective, meta: { zone: 'hub' } },
    { path: '/privacidad', component: PrivacyPolicy, meta: { zone: 'hub' } },
    { path: '/terminos', component: TermsOfService, meta: { zone: 'hub' } },
    // Play landing pages
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true, zone: 'hub' } },
    // /play/free (Juego Libre) retirado en MEJORAS12: redirige al índice por puntos
    { path: '/play/free', redirect: '/play/points' },
    { path: '/rewards', component: RewardCenter, meta: { requiresAuth: true, zone: 'play' } },
    { path: '/tienda', component: Tienda, meta: { requiresAuth: true, zone: 'hub' } },
    { path: '/pricing', component: Pricing, meta: { zone: 'hub' } },
    // Reto del día — funnel público sin login (entrada de marketing / streamers)
    { path: '/reto', component: DailyChallenge, meta: { zone: 'play' } },
    // Modo Carrera — funnel público sin login, estilo Copero (viral, sesión corta)
    { path: '/carrera', component: Career, meta: { zone: 'play' } },
    // 404 fallback
    { path: '/:pathMatch(.*)*', component: NotFound, meta: { zone: 'hub' } },
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