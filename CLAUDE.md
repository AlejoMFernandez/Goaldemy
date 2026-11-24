# FULVO — guía para agentes

FULVO es una app de micro-juegos de fútbol gamificada (XP, rachas, logros, rangos, tienda, pase mensual). Se relanza como **app mobile** (App Store / Google Play vía Capacitor), **app de escritorio instalable** (PWA) y **web** (fulvo.com.ar, Vercel). El dueño es Alejo: revisa y mergea todo.

## Stack

- **Vue 3** (Options API + `<script setup>` mezclados) + **vue-router 4**
- **Vite 7** + **Tailwind 4** (`@tailwindcss/vite`, tokens en `src/style.css`)
- **Supabase** (auth, Postgres, realtime, edge functions) — cliente en `src/services/supabase.js`
- **vite-plugin-pwa** (Workbox) — config en `vite.config.js`
- **Capacitor 8** (`capacitor.config.json`, `android/`) — puente en `src/services/native.js`
- Fuentes self-hosted con `@fontsource` (importadas en `src/main.js`)
- Deploy: Vercel (`vercel.json`: rewrites SPA + proxy `/fotmob`)

## Mapa de carpetas

| Carpeta | Qué hay |
|---|---|
| `src/main.js` | Arranque: fuentes, precarga de jugadores, router, init nativo, service worker |
| `src/App.vue` | Shell (layout, transiciones, overlays globales) |
| `src/router/router.js` | Rutas (todo lazy salvo Landing), guards de auth/admin, espera de `dataGAMES` |
| `src/pages/` | Páginas: `games/` (un archivo por juego), `profile/`, `auth/`, `social/`, `leagues/`, `admin/`, `info/`, `legal/` |
| `src/components/` | Por dominio: `game/`, `rewards/`, `profile/`, `shop/`, `home/`, `common/`, `admin/`… |
| `src/services/` | Lógica por dominio: jugadores (`players.js`, `global-search.js`), juegos (`game-*.js`, `scoring.js`, `powerups.js`), economía (`xp.js`, `rewards.js`, `shop.js`, `premium.js`, `checkout.js`), progresión (`tiers.js`, `achievements*.js`, `season.js`), social (`direct-messages.js`, `presence.js`), plataforma (`native.js`, `haptics.js`, `fotmob.js`) |
| `src/stores/` | Estado global chico (notificaciones/toasts, sidebar) |
| `src/mixins/` | Mixins compartidos por los juegos |
| `src/dataGAMES.json` | Planteles (~1 MB). **Se carga lazy**: usá `getAllPlayers()`/`getAllTeams()` (sync, `[]` hasta que carga) o `await ensurePlayersLoaded()` |
| `supabase/` | SQL histórico, `functions/` (edge functions), `email-templates/` |
| `supabase/pendientes/` | SQL nuevo **sin aplicar** (ver reglas) |
| `scripts/` | Utilidades Node: refresco de planteles, smoke test, íconos, validaciones |
| `public/` | Estáticos; `public/icons/` = íconos PWA/nativos (regenerar con `npm run icons`) |
| `docs/` | Documentación; `docs/relanzamiento/` = plan mobile; `docs/archivo/` = guías viejas |

## Cómo correrlo

```bash
npm ci                    # instalar
npm run dev               # dev server (proxy /fotmob incluido)
npm run build             # build de producción (TIENE que pasar)
npm run preview           # servir dist/ (para probar la PWA)
npm run smoke             # smoke test con Playwright (necesita TEST_USER_* en .env.local)
npm run test:achievements # test offline de reglas de logros
npm run cap:sync          # build + copiar a android/ (e ios/ si existe)
npm run cap:android       # abre Android Studio
```

Variables de entorno: `.env.local` (nunca se commitea). Ver `docs/relanzamiento/PLATAFORMAS.md` para builds nativos.

## Reglas para agentes

1. **Siempre en una rama + PR.** Nunca pushear a `main`. Nombres: `feat/…`, `fix/…`, `chore/…`.
2. **`npm run build` tiene que pasar** antes de cada commit que toque código. CI lo verifica en cada PR.
3. **SQL nuevo** va en `supabase/pendientes/AAAA-MM-DD-descripcion.sql`. **Nunca** se aplica a producción sin aprobación explícita de Alejo (ni por MCP, ni por CLI, ni por dashboard).
4. **Sin secretos en el código**: nada de keys privadas, service role, connection strings ni contraseñas. Sólo la anon key pública de Supabase vía `import.meta.env`.
5. **Idioma**: copy de UI y mensajes de commit en **español rioplatense** (vos, "jugá", "sumá"). Commits estilo conventional: `feat(juegos): …`, `fix(perfil): …`.
6. **Mobile-first** (es una app de celular antes que una web):
   - Diseñar primero para **375px** de ancho; desktop es la adaptación.
   - Respetar **safe areas**: `env(safe-area-inset-top/bottom/left/right)` (la status bar nativa va en overlay sobre el webview).
   - **Touch targets ≥ 44×44px**.
   - **Nada de info sólo en hover**: todo lo que aparece en hover tiene que tener equivalente al tocar.
   - Respetar `prefers-reduced-motion`.
   - Para vibración usar `src/services/haptics.js` (`tap/success/error/heavy`), no `navigator.vibrate` directo.
7. **Peso del bundle**: no importar estático nada pesado (JSON grandes, librerías de charts) desde módulos que caen en el chunk inicial. Preferir `import()`.
8. **Commits chicos y lógicos.** No mezclar refactors con features.
9. No tocar archivos de otra zona sin coordinar (ver tabla).

## Zonas (para agentes en paralelo)

Cada agente trabaja en **una** zona. Si necesitás cambiar algo de otra zona, dejalo anotado en el PR en vez de tocarlo.

| Zona | Archivos principales |
|---|---|
| **Shell / navegación** | `src/App.vue`, `src/components/AppNavBar.vue`, `FriendsDock.vue`, `AppFooter.vue`, `src/pages/Landing.vue`, `src/components/home/`, `src/components/common/`, `index.html` (salvo `<head>` de plataforma) |
| **Juegos** | `src/pages/games/`, `src/components/game/`, `src/mixins/`, `src/services/game-*.js`, `scoring.js`, `powerups.js`, `time-bonus.js`, `guess-player-*.js`, `connections*.js` |
| **Economía / servidor** | `supabase/` (SQL y functions), `src/services/rewards.js`, `shop.js`, `premium.js`, `checkout.js`, `subscriptions.js`, `cosmetics.js`, `src/pages/Tienda.vue`, `Pricing.vue` |
| **Progresión / rangos** | `src/services/xp.js`, `tiers.js`, `achievements*.js`, `achievement-*.js`, `level-rewards.js`, `season.js`, `src/components/rewards/`, `src/pages/RewardCenter.vue`, `Career.vue` |
| **Plataforma / PWA / nativo** | `vite.config.js`, `capacitor.config.json`, `android/`, `ios/`, `src/main.js`, `src/services/native.js`, `haptics.js`, `players.js` (carga), `fotmob.js`, `public/icons/`, `.github/`, `vercel.json`, `package.json` |

## graphify (OPCIONAL — sólo si existe `graphify-out/`)

Si `graphify-out/graph.json` no existe, ignorá esta sección y navegá el código normalmente.

- Para preguntas sobre el código, primero `graphify query "<pregunta>"`. Usá `graphify path "<A>" "<B>"` para relaciones y `graphify explain "<concepto>"` para conceptos puntuales: devuelven un subgrafo acotado, mucho más chico que `GRAPH_REPORT.md` o un grep crudo.
- Si existe `graphify-out/wiki/index.md`, usalo para navegar a grandes rasgos.
- Leé `graphify-out/GRAPH_REPORT.md` sólo para revisiones de arquitectura amplias.
- Después de modificar código, `graphify update .` mantiene el grafo al día (sólo AST, sin costo de API).
