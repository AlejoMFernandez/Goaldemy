import { createRouter, createWebHistory } from 'vue-router';
import { pushInfoToast } from '../stores/notifications';
import { subscribeToAuthStateChanges, authReady, getAuthUser } from '../services/auth';
import { isAdmin } from '../services/admin';
import { setSeo } from '../services/seo';
import { ensurePlayersLoaded } from '../services/players';
import { shouldShowWelcome } from '../services/onboarding';

// La home se importa de forma EAGER: es la ruta de entrada, así el LCP no
// espera un chunk extra. Todo lo demás es LAZY (code-splitting por ruta):
// cada página/juego baja en su propio chunk sólo al navegar, así el bundle
// inicial no arrastra los 15 juegos + su data de jugadores (dataGAMES.json).
import Landing from '../pages/Landing.vue';
const AuthPage = () => import('../pages/auth/AuthPage.vue');
const Bienvenida = () => import('../pages/Bienvenida.vue');
const VerifyEmail = () => import('../pages/auth/VerifyEmail.vue');
const ForgotPassword = () => import('../pages/auth/ForgotPassword.vue');
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
const Racha = () => import('../pages/Racha.vue');
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
const Career = () => import('../pages/Career.vue');
const PrivacyPolicy = () => import('../pages/legal/PrivacyPolicy.vue');
const TermsOfService = () => import('../pages/legal/TermsOfService.vue');
// Shell mobile (tab bar): hubs nuevos
const Social = () => import('../pages/Social.vue');
const Coleccion = () => import('../pages/Coleccion.vue');
const Colecciones = () => import('../pages/Colecciones.vue');
const Camino = () => import('../pages/Camino.vue');
const Logros = () => import('../pages/Logros.vue');

const routes = [
    { path: '/', component: Landing, meta: { zone: 'hub', seo: { description: 'FULVO es una app de micro-juegos de fútbol para entrenar tu conocimiento: adiviná jugadores, armá rachas, sumá logros y competí en el ranking.' } } },
    { path: '/competiciones', component: CompetitionsHub, meta: { zone: 'data', seo: { title: 'Competiciones', description: 'Seguí ligas y torneos de fútbol: tablas de posiciones, fixtures, resultados y brackets actualizados.' } } },
    { path: '/leagues', redirect: '/competiciones' },
    { path: '/leagues/:slug', component: CompetitionPage, meta: { zone: 'data', seo: { title: 'Competición', description: 'Tabla de posiciones, fixture y resultados en vivo.' } } },
    { path: '/team/:teamId', component: TeamPage, meta: { zone: 'data', seo: { title: 'Equipo', description: 'Plantilla, últimos partidos y estadísticas del equipo.' } } },
    { path: '/bienvenida', component: Bienvenida, meta: { immersive: true, zone: 'hub', seo: { title: 'Bienvenida', noindex: true } } },
    { path: '/login', component: AuthPage, meta: { layout: 'auth', zone: 'hub', authGroup: 'auth', seo: { title: 'Iniciar sesión', description: 'Ingresá a tu cuenta de FULVO.', noindex: true } } },
    { path: '/register', component: AuthPage, meta: { layout: 'auth', zone: 'hub', authGroup: 'auth', seo: { title: 'Crear cuenta', description: 'Creá tu cuenta gratis en FULVO y empezá a jugar.', noindex: true } } },
    { path: '/verify-email', component: VerifyEmail, meta: { layout: 'auth', zone: 'hub', seo: { title: 'Verificar email', noindex: true } } },
    { path: '/forgot-password', component: ForgotPassword, meta: { layout: 'auth', zone: 'hub', seo: { title: 'Recuperar contraseña', noindex: true } } },
    { path: '/reset-password', component: ResetPassword, meta: { layout: 'auth', zone: 'hub', seo: { title: 'Restablecer contraseña', noindex: true } } },
    { path: '/profile', component: Profile, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Mi perfil', noindex: true } } },
    { path: '/profile-edit', component: ProfileEdit, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Editar perfil', noindex: true } } },
    { path: '/teams', component: Teams, meta: { zone: 'data', seo: { title: 'Equipos', description: 'Explorá equipos de fútbol, sus planteles y estadísticas.' } } },
    // Modo invitado: se puede jugar sin cuenta, el resultado se reclama al registrarse (ver services/guest-play.js)
    { path: '/games/guess-player', component: GuessPlayer, meta: { immersive: true, zone: 'play', seo: { title: 'Adiviná el jugador', description: 'Adiviná qué futbolista es a partir de pistas. Jugá gratis, sin necesidad de cuenta.' } } },
    { path: '/games/nationality', component: NationalityGame, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Nacionalidad', noindex: true } } },
    { path: '/games/player-position', component: PlayerPosition, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Posición del jugador', noindex: true } } },
    { path: '/games/who-is', component: WhoIs, meta: { immersive: true, zone: 'play', seo: { title: '¿Quién es?', noindex: true } } },
    { path: '/games/value-order', component: ValueOrder, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Orden por valor', noindex: true } } },
    { path: '/games/age-order', component: AgeOrder, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Orden por edad', noindex: true } } },
    { path: '/games/height-order', component: HeightOrder, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Orden por altura', noindex: true } } },
    { path: '/games/shirt-number', component: ShirtNumber, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Número de camiseta', noindex: true } } },
    { path: '/games/once-ideal', component: OnceIdeal, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Once ideal', noindex: true } } },
    { path: '/games/football-wordle', component: FootballWordle, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Football Wordle', noindex: true } } },
    { path: '/games/higher-or-lower', component: HigherOrLower, meta: { immersive: true, zone: 'play', seo: { title: 'Mayor o menor', noindex: true } } },
    { path: '/games/connections', component: Connections, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Conexiones', noindex: true } } },
    { path: '/games/football-grid', component: FootballGrid, meta: { immersive: true, zone: 'play', seo: { title: 'La Grilla', noindex: true } } },
    { path: '/games/stat-challenge', component: StatChallenge, meta: { requiresAuth: true, immersive: true, zone: 'play', seo: { title: 'Desafío de estadísticas', noindex: true } } },
    { path: '/leaderboards', component: Leaderboards, meta: { zone: 'data', seo: { title: 'Tabla de posiciones', description: 'Mirá el ranking global de jugadores de FULVO por XP, rachas y logros.' } } },
    { path: '/u/:id', component: Profile, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Perfil de usuario', noindex: true } } },
    { path: '/notifications', component: Notifications, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Notificaciones', noindex: true } } },
    { path: '/messages', component: DirectMessages, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Mensajes', noindex: true } } },
    { path: '/messages/:peerId', component: DirectChat, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Mensajes', noindex: true } } },
    // Admin Panel
    { path: '/admin', component: AdminPanel, meta: { requiresAuth: true, requiresAdmin: true, zone: 'data', seo: { title: 'Admin', noindex: true } } },
    // About / Info
    { path: '/about/me', component: AboutMe, meta: { zone: 'hub', seo: { title: 'Sobre mí', description: 'Quién está detrás de FULVO.' } } },
    { path: '/about/fulvo', component: AboutFulvo, meta: { zone: 'hub', seo: { title: 'Qué es FULVO', description: 'Conocé FULVO: la app de micro-juegos de fútbol con rachas, logros y ranking.' } } },
    { path: '/about/objetivo', component: AboutObjective, meta: { zone: 'hub', seo: { title: 'Nuestro objetivo', description: 'La misión detrás de FULVO.' } } },
    { path: '/privacidad', component: PrivacyPolicy, meta: { zone: 'hub', seo: { title: 'Política de privacidad' } } },
    { path: '/terminos', component: TermsOfService, meta: { zone: 'hub', seo: { title: 'Términos de servicio' } } },
    // Play landing pages
    { path: '/play/points', component: PlayPoints, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Jugar', noindex: true } } },
    // /play/free (Juego Libre) retirado en MEJORAS12: redirige al índice por puntos
    { path: '/play/free', redirect: '/play/points' },
    { path: '/racha', component: Racha, meta: { requiresAuth: true, zone: 'play', seo: { title: 'Racha', noindex: true } } },
    { path: '/logros', component: Logros, meta: { requiresAuth: true, zone: 'play', seo: { title: 'Logros', noindex: true } } },
    { path: '/rewards', component: RewardCenter, meta: { requiresAuth: true, zone: 'play', seo: { title: 'Recompensas', noindex: true } } },
    { path: '/tienda', component: Tienda, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Tienda', noindex: true } } },
    { path: '/pricing', component: Pricing, meta: { zone: 'hub', seo: { title: 'Planes y precios', description: 'Conocé los planes PRO de FULVO: cosméticos exclusivos, ayudas y más.' } } },
    // Modo Carrera — funnel público sin login, estilo Copero (viral, sesión corta)
    { path: '/carrera', component: Career, meta: { zone: 'play', seo: { title: 'Modo Carrera', description: 'Encadená aciertos sin fallar en el modo Carrera de FULVO. Jugá gratis, sin cuenta.' } } },
    // Shell mobile — pestañas Social y Colección de la tab bar
    { path: '/social', component: Social, meta: { zone: 'hub', seo: { title: 'Social', description: 'Ranking, amigos y fútbol en vivo en FULVO.' } } },
    { path: '/coleccion', component: Coleccion, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Colección', noindex: true } } },
    { path: '/colecciones', component: Colecciones, meta: { requiresAuth: true, zone: 'hub', seo: { title: 'Colecciones', noindex: true } } },
    { path: '/camino', component: Camino, meta: { zone: 'hub', seo: { title: 'El camino', description: 'Los 11 rangos de FULVO: dónde estás, qué viene y qué ganás al llegar.' } } },
    // 404 fallback
    { path: '/:pathMatch(.*)*', component: NotFound, meta: { zone: 'hub', seo: { title: 'Página no encontrada', noindex: true } } },
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

// Bienvenida: la primera vez que un invitado abre la app (una sola vez, ver onboarding.js).
router.beforeEach(async (to, from) => {
    await authReady;
    if (shouldShowWelcome(to, from, getAuthUser()?.id)) return '/bienvenida';
});

// dataGAMES.json se carga lazy (ver services/players.js). main.js ya lo
// precarga al arrancar; acá lo esperamos antes de entrar a cualquier ruta que
// pueda leer jugadores/equipos de forma sync (juegos, perfil, auth, equipos…),
// así un deep link directo a un juego nunca ve listas vacías. Las rutas
// livianas (home, info, legales, planes) no esperan nada.
const ROUTES_WITHOUT_PLAYERS = /^\/($|about\/|privacidad|terminos|pricing|verify-email|forgot-password|reset-password|notifications|messages|competiciones|leagues)/;
router.beforeResolve(async (to) => {
    if (ROUTES_WITHOUT_PLAYERS.test(to.path)) return;
    await ensurePlayersLoaded();
});

// Garantiza el scroll arriba tras cada navegación, inmune al timing de la
// transición out-in (el scrollBehavior solo no alcanza con transiciones).
router.afterEach((to) => {
    if (to.hash) return;
    const toTop = () => window.scrollTo({ top: 0, left: 0 });
    requestAnimationFrame(toTop);
    setTimeout(toTop, 320);
});

// SEO por ruta: title/description/canonical/OG (ver services/seo.js).
// Rutas con contenido dinámico (equipo, competición) lo pisan ellas mismas
// una vez que cargan el nombre real.
router.afterEach((to) => {
    setSeo({ ...to.meta.seo, path: to.fullPath });
});

export default router;