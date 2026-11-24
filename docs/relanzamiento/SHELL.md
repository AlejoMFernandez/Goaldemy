# Shell mobile de FULVO (relanzamiento como app)

Rama: `feat/shell-mobile`. Alcance: **mobile (< `lg`, 1024px)**. En desktop (≥ `lg`) sigue la navbar de arriba de siempre + la card de amigos a la derecha; no se rompió nada ahí.

Referencias: Clash Royale, Castle Duels, Overgeared Hero. Barra de pestañas abajo con el botón de jugar en el centro, monedas y perfil arriba, y una home que es básicamente un botón gigante de JUGAR.

---

## 1. Arquitectura de información

```
┌──────────────────────── TOP BAR (56px + safe-area) ────────────────────────┐
│ [rango] Nv 12 ▬▬  🔥 5        [ficha 1,2k +] [balón 30 +] [🔔3] [avatar]   │
└────────────────────────────────────────────────────────────────────────────┘
                     contenido de la pestaña (scroll)
┌──────────────────────── TAB BAR (64px + safe-area) ────────────────────────┐
│  Tienda    Colección    ( ⚽ JUGAR )    Pase(•2)    Social                   │
└────────────────────────────────────────────────────────────────────────────┘
avatar → HOJA DE AJUSTES (bottom sheet)
```

| Pestaña | Ruta | Qué hay | Sub-rutas que la marcan como activa |
|---|---|---|---|
| Tienda | `/tienda` | La tienda actual (Fichas / Balones) | `/pricing` |
| Colección | `/coleccion` (**nueva**) | `CosmeticsCollection` (íconos, bordes, banners, títulos) | `/profile-edit` |
| **JUGAR** (central) | `/` | Home: JUGAR RÁPIDO + jornada + sobre + pase + "Jugá hoy" | `/play/points` |
| Pase | `/rewards` | Centro de recompensas (badge = recompensas sin reclamar) | — |
| Social | `/social` (**nueva**) | Ranking · Amigos · Fútbol + buscador global | `/leaderboards`, `/competiciones`, `/leagues`, `/teams`, `/team/*`, `/messages`, `/notifications` |

**Hoja de ajustes** (desde el avatar): Mi perfil, Editar perfil, Mensajes, Objetivos y desafíos, Premium · Planes, (Panel admin si corresponde), Modo Carrera, Acerca de FULVO, Privacidad, Términos, Reportar un problema y Cerrar sesión. Con esto ya no quedan pantallas huérfanas en mobile: antes Mensajes, Planes, Carrera, legales y Acerca de solo se encontraban en el menú hamburguesa o en el footer.

**Dónde NO aparece la tab bar:** juegos (`meta.immersive`), `/carrera`, login/registro (`layout: 'auth'`), `/admin` y el chat 1 a 1 (`/messages/:id`, para que el teclado y la caja de texto no peleen con la barra). En juegos tampoco hay top bar: el juego ocupa la pantalla entera y tiene su propio sub-header con "volver".

---

## 2. Decisiones y por qué

1. **Shell nuevo sólo en mobile y la navbar de desktop intacta.** Lo que más importa para salir a las tiendas es el celular. `AppNavBar` ahora tiene `hidden lg:block`, y en mobile la reemplazan `shell/TopBar.vue` + `shell/TabBar.vue`.
2. **Una sola fuente de datos (`components/shell/shell-state.js`).** `AppNavBar` ya tenía el contador de notificaciones con realtime + polling, el usuario, los cosméticos y el flag de admin, así que ahora los **espeja** en `shellState` y la TopBar sólo los lee. De esta forma no se abre un segundo canal realtime con el mismo nombre. La billetera (`getWallet`), el nivel/XP (`xp.js`) y la racha (`user_profiles.daily_streak`) se cargan acá con un throttle de 15 s, y se fuerza la recarga al volver de `/tienda`, de un juego o de `/rewards`, que es donde cambian.
3. **El botón JUGAR del centro está elevado y es más grande**: disco dorado de 64px que sobresale 22px. La pestaña activa se levanta, se agranda y brilla en dorado con una curva de resorte. Las áreas táctiles miden ≥ 48px. Al tocar se llama a `navigator.vibrate?.(8)` (no hace nada en iOS Safari). Si tocás la pestaña en la que ya estás, la pantalla vuelve arriba (como en las apps nativas).
4. **Social reutiliza todo, sin duplicar lógica:**
   - Ranking: monta `Leaderboards.vue` tal cual.
   - Amigos: `FriendsDock` con la prop nueva `embedded`, que muestra sólo la lista y el chat inline. Sin rail, sin modales y **sin canal realtime propio**: el dock global sigue siendo el único que escucha DMs y muestra toasts, y no muestra el toast del chat que tenés abierto en `/social`. De paso, las desuscripciones de `FriendsDock` pasaron a ser por instancia (antes eran variables de módulo, y con dos instancias se pisaban).
   - Fútbol: cards a Competiciones y Equipos + `TodayMatchesGrid`. La lógica de partidos se sacó de `Landing.vue` a `home/useUpcomingMatches.js`, que comparten la home y Social. "Ligas" no tiene card propia porque `/leagues` redirige a `/competiciones`, y una tercera card habría llevado al mismo lugar.
   - El **buscador global** (jugadores, equipos, usuarios, competiciones) vivía en el menú hamburguesa de mobile, que ya no existe, así que se movió arriba de Social.
5. **Se fue el cluster flotante de mobile** (desafíos + bug + amigos, abajo a la derecha). Tapaba contenido, por eso existía el hack de `padding-bottom: 104px`, y competía con la tab bar. Ahora Amigos está en Social, y Bug y Desafíos en la hoja de ajustes, que piden abrir los modales que ya existen en `FriendsDock` mediante `requestBugReport()` / `requestChallenges()`. El padding ahora sale del alto real de la tab bar (`.shell-pad-tabbar` en `style.css`).
6. **JUGAR RÁPIDO (`services/quick-play.js`).** Agarra `fetchGames()` (ya excluye pausados), filtra lo desbloqueado por nivel, ordena primero `DAILY_GAMES` y después el resto, y usa `isChallengeAvailable(slug)` de `game-modes.js` (sólo lectura). La ruta se arma igual que en el índice: `gameRouteForSlug(slug) + '?mode=challenge'`. Con un toque arranca el juego directo, con la cortina dorada de siempre. Si no queda ninguno, muestra **"¡Jornada completa!"** con la cuenta regresiva hasta las 00:00 (mismo reinicio que usa `game-modes`) y un link a `/play/points`. Si pasa la medianoche con la app abierta, se recarga sola.
7. **Home logueada en mobile**, en este orden: JUGAR RÁPIDO (con la jornada de hoy: una pelota por juego, ganado/perdido/pendiente) → Misión de hoy → Sobre del día (teaser que lleva a `/rewards#sobre-del-dia`) → Pase (`MonthlyPass compact`) → "Jugá hoy" → Top jugador → link a "Partidos de hoy" en Social. **Planes** y **Partidos** salen de la home en mobile (siguen en desktop). La card de perfil (avatar/nivel/rango) sólo se ve en desktop, porque en mobile esos datos ya están en la top bar. El ticker de partidos también queda sólo en desktop, y en mobile logueado ni se piden los partidos.
8. **Home de invitado:** el CTA principal es **"Jugar sin cuenta"** (botón dorado). Los juegos que se pueden jugar sin cuenta salen **del router** (rutas `/games/*` sin `requiresAuth`, que hoy son guess-player, who-is, higher-or-lower y football-grid) más la card de **Modo Carrera**, y se muestran **jugables** (antes decían "Bloqueado"). Debajo dice "+N modos más con tu cuenta gratis". El texto "9 modos" ahora se calcula (`state.totalGames`). Si el catálogo no llega (red caída), los juegos para invitado se muestran igual con el nombre local.
9. **Safe areas / notch:** `viewport-fit=cover`. La top bar tiene padding `env(safe-area-inset-top)` y la tab bar `env(safe-area-inset-bottom)`. `min-h-screen` pasó a `min-h-dvh` en App y Landing. En juegos (sin top bar) se agrega un `<nav class="shell-safe-top">` del alto del notch. Es un `<nav>` a propósito: `GameShell` mide el primer `<nav>` del documento para calcular su alto, y así descuenta el notch sin tocar `components/game/*`. Los toasts suben por encima de la tab bar (`body.has-tabbar`).
10. **Splash:** la primera vez dura 1,2 s (antes 2,2 s) y usa la escena comprimida. Las veces siguientes, 0,9 s.
11. **Transiciones:** `TAB_ORDER = ['/tienda', '/coleccion', '/', '/rewards', '/social']`. Las sub-rutas se mapean a su pestaña (`TAB_ALIASES`), así ir de Tienda a Social entra desde la derecha y volver entra desde la izquierda.
12. **Estados de carga:** `shell/HubState.vue` (skeleton con brillo / error con "Reintentar") y `shell/async-hub.js` (chunks diferidos con skeleton y error). Se usan en Social, Colección y JUGAR RÁPIDO.
13. **Movimiento reducido:** todas las animaciones nuevas (pulso del botón, llama, brillo del tab activo, rayos, sobre, hoja) se apagan o pasan a un fundido con `prefers-reduced-motion`.

---

## 3. Pendiente / próximos pasos

- **Desktop (propuesta): rail izquierdo en ≥ lg** que repita las 5 pestañas (icono + label, JUGAR destacado) y saque los dropdowns de la navbar. La top bar de desktop quedaría para monedas, campana y avatar (con la misma hoja de ajustes como popover). `shellState`, `TAB_ORDER` y `hidesTabBar()` ya están pensados para reutilizarse.
- Animación de "+N" al ganar monedas o XP en las pills (hoy el valor se actualiza al volver del juego).
- `PlayPoints` sigue pidiendo cuenta. Si se quiere un índice para invitados, se puede abrir con los juegos públicos (no se tocó por alcance).
- `Leaderboards` se monta con su propio título "Ranking global". Si molesta dentro de Social, se puede agregar una prop `embedded` que lo esconda.
- Probar en iPhone real (notch, home indicator, teclado en el chat embebido) y en Android (vibración).
- Correr `graphify update .` después del merge (no se corrió acá para no generar conflictos con las otras ramas paralelas).

## 4. Capturas (390×844, invitado)

`docs/relanzamiento/capturas/`: `01-home-invitado.png`, `02-home-invitado-juegos.png`, `03-social-ranking.png`, `04-social-futbol.png`, `05-social-amigos-invitado.png`. Se sacaron en un sandbox sin acceso a Supabase, por eso los rankings y los partidos aparecen vacíos. Las pantallas logueadas (top bar con monedas, JUGAR RÁPIDO, hoja de ajustes) no se pudieron capturar porque hace falta una cuenta.

## 5. Cómo probarlo

1. `npm ci && npm run dev`, y en DevTools activar el modo dispositivo (iPhone 12/13, 390×844).
2. **Invitado:** en `/` tocar "Jugar sin cuenta" (abre Adiviná el jugador). Las 4 cards de juego y Carrera tienen que abrir el juego, sin "Bloqueado".
3. **Logueado:** en la top bar, nivel/XP, racha, Fichas y Balones (tocarlas lleva a `/tienda`), la campana con badge y el avatar, que abre la hoja.
4. Tab bar: recorrer las 5 pestañas. La animación entra por derecha o por izquierda según el sentido, la activa brilla, y el badge de Pase aparece cuando hay recompensas.
5. JUGAR RÁPIDO arranca el próximo desafío. Al jugar todos los del día tiene que aparecer "¡Jornada completa!" con la cuenta regresiva.
6. `/social`: probar Ranking, Amigos (abrir un chat) y Fútbol, y el buscador.
7. Entrar a un juego: no tiene que haber ni top bar ni tab bar, y el juego ocupa toda la pantalla.
8. Desktop (≥ 1024px): tiene que verse todo como antes.

## v2 (24/11, devolución de Alejo sobre el moodboard 10)
- Todo con la identidad que ya existía: escudo del rango (`tier.image`), barra de XP verde → cian → violeta (la del menú de usuario), pósters reales de los juegos (`GamePoster`), pelota de FULVO (`BALL_SVG`) en la jornada y en el botón central, monedas con `CurrencyIcon`.
- Encabezado más limpio, en un solo renglón: escudo + "Nv X" + barra · una pastilla con Fichas y Balones · avatar. Salieron la racha y la campana; las notificaciones quedan como punto rojo en el avatar y como ítem (con contador) en la hoja.
- Botón JUGAR: círculo perfecto de 56 px (antes 64 y se deformaba), menos brillo, etiqueta "Jugar" alineada con las otras pestañas.
- Hoja de ajustes: cabecera igual al menú de usuario de siempre (avatar, nombre, "Nivel X · N XP", barra) + escudo del rango.
- JUGAR RÁPIDO: muestra el póster real del próximo juego; sin rayos de fondo.
