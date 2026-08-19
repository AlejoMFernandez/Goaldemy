# Goaldemy — Rediseño estético (Fase 2)

## Contexto

La Fase 1 (auditoría + fixes de responsive/funcionamiento) ya está cerrada: se corrigieron dos bugs estructurales de scroll/overflow que afectaban a casi toda la app, más colisiones puntuales (FriendsDock, header, TeamPage, Admin) y un crash de juego. Con la base funcional sana, el owner quiere ahora un rediseño visual completo antes de lanzar Goaldemy comercialmente en unos meses.

El diagnóstico de partida (surgido de trabajar en el código durante la Fase 1, no de opinión): la app no se ve "fea" componente por componente, se ve **inconsistente**. Quince rondas de mejoras incrementales ("mejoras5" → "mejoras15" en el historial) resolvieron problemas puntuales sin una capa de sistema de diseño que los obligara a converger. Evidencia concreta encontrada en el código:

- El mismo componente conceptual (card de juego) tiene dos lenguajes visuales distintos según la página (`Landing.vue` usa un tratamiento "poster" full-bleed; `PlayPoints.vue` usa foto + borde — mismo dato, dos sistemas).
- `TeamPage.vue` usa Bootstrap Icons y acento azul genérico, sin relación con el set de íconos SVG custom ni la marca del resto de la app.
- El panel de `/admin` también usa azul genérico en vez de la marca.
- El sidebar de amigos se rediseñó al menos 3 veces persiguiendo una estética "hub gamer", pero páginas centrales (pricing, equipos, admin) no comparten esa identidad.

**Objetivo de este rediseño:** que Goaldemy se sienta como un solo producto premium con una identidad consistente, no varias mini-apps cosidas entre sí — manteniendo la energía de juego que ya funciona.

## Alcance

**Incluye:** sistema de diseño (tokens compartidos: paleta, tipografía, radios, sombras, iconografía, movimiento) + aplicación de ese sistema a las ~30 rutas de la app, organizadas en 3 zonas funcionales con matices propios.

**No incluye (fuera de esta spec):**
- Rediseño del logo/isotipo (el escudo-pelota ya es monocromático y funciona sin cambios sobre la nueva paleta; solo el gradiente de texto "GOALDEMY" se recolorea).
- Cambios de arquitectura de datos, backend, RPCs o lógica de negocio.
- Los 3 errores de backend/RPC detectados en la Fase 1 (`get_user_max_streak_by_game`, `get_users_admin`, warning de fotmob) — quedan anotados para una revisión aparte.
- Rediseño creativo profundo de `/admin` — se alinea a la marca básica (colores de acento, set de íconos) pero no es prioridad estética; es superficie interna, no de cara al usuario.
- Modo claro — la app sigue siendo dark-only (`color-scheme: dark` ya fijado), no se evalúa light mode en este pase.

## Sistema de 3 zonas sobre un solo ADN visual

La app se divide en 3 zonas funcionales. Todas comparten la misma base ("Midnight Broadcast": navy/índigo profundo) y las mismas reglas estructurales (tipografía, radios, sombras, iconografía, movimiento). Lo único que cambia entre zonas es el **color de acento** y el **tratamiento de superficie** — eso es lo que le da variedad sin perder cohesión.

| Zona | Rutas | Acento | Superficie |
|---|---|---|---|
| **Hub / Social** | `/`, `/play/points`, `/profile`, `/profile-edit`, `/notifications`, `/messages*`, `/pricing`, `/tienda`, `/rewards`, FriendsDock (global) | Violeta-índigo | Sólida elevada |
| **Juego** | `/games/*` (14 rutas) + GameShell, level-up overlay, achievement unlock overlay, `/reto` | Dorado (único acento en reposo) | Sólida elevada |
| **Data** | `/competiciones`, `/leagues/*`, `/team/*`, `/leaderboards`, `/teams` | Azul puro | Bordeada plana |

Páginas de auth (`/login`, `/register`, etc.) y `/about/*` heredan la identidad Hub por defecto (son parte del "chrome" general, no necesitan mood propio). `/admin` recibe solo las reglas estructurales (radios, tipografía, íconos) y el acento azul de Data por defecto, sin inversión de diseño adicional.

## Tokens compartidos (la "columna vertebral")

Estos valores nunca cambian entre zonas — viven como CSS custom properties globales en `src/style.css`, reemplazando/extendiendo los `--brand-*` actuales.

**Paleta base (Midnight Broadcast):**
```
--mb-950: #070a1a   /* fondo más profundo */
--mb-900: #0b1024   /* fondo base de superficies */
--mb-800: #141a38   /* superficie sólida elevada */
--mb-border: rgba(255,255,255,.06)   /* borde de superficie sólida */
```

**Acentos por zona:**
```
/* Hub */         --hub-500: #818cf8;  --hub-400: #a78bfa;  --hub-300: #c084fc;
/* Juego */        --play-500: #f59e0b; --play-400: #fcd34d; --play-600: #d97706;
/* Data */          --data-500: #60a5fa; --data-600: #2563eb; --data-700: #3b82f6;
```

**Semántico (cruza todas las zonas, nunca decorativo salvo en el instante de feedback):**
```
--success: #4ade80   /* acierto / victoria — flash transitorio ~600ms */
--danger: #ef4444    /* error — flash transitorio ~600ms */
--prestige-gold: #fbbf24   /* PRO, rachas, medallas — ya existía, se mantiene cross-zona */
```

**Tipografía:**
- Display/títulos: **Space Grotesk** (pesos 600/700) — reemplaza Plus Jakarta Sans.
- Cuerpo: **Inter** — sin cambios.
- `--font-display: "Space Grotesk", var(--font-sans);`

**Radios (escala única, hoy mezclado sin criterio entre `rounded-lg/xl/2xl/3xl`):**
```
--radius-sm: 8px    /* chips, badges */
--radius-md: 12px   /* botones, inputs */
--radius-lg: 16px   /* cards */
--radius-xl: 24px   /* paneles/heroes grandes */
```

**Superficies (2 tratamientos, elegidos por zona):**
- `.surface-solid` — Hub y Juego. Fondo `--mb-800`, sombra suave (`0 10px 30px rgba(0,0,0,.45)`), sin blur. Reemplaza el patrón actual `bg-slate-900/60 backdrop-blur-md`.
- `.surface-flat` — Data. Fondo `--mb-900`, borde 1px con tinte `--data-*` al 20-25% opacidad, sin sombra ni blur. Prioriza densidad/legibilidad de tablas y brackets.

**Movimiento — restringir y curar:**
Auditar el set actual de keyframes en `style.css` (son ~20+: shimmer, pulse-glow, score-pop, shake, streak-bump, timer-urgent, glow-border, particle-burst, star-fill, bar-shimmer, option-ripple, level-morph, evolution-flash, chest-bounce, claim-pulse, counter-pop, etc.) y consolidar a un set chico con un propósito documentado cada uno:
- Transiciones de estado (hover, focus, entrada de listas) → usar las curvas ya existentes `--ease-snappy` / `--ease-out-expo`, duración corta (150-250ms).
- Feedback de respuesta (acierto/error) → `shake` y el flash success/danger transitorio, sin más.
- Momentos de celebración real (level-up, racha, logro desbloqueado) → conservar la animación más rica (ej. `scale-spring` + `glow-pulse`), pero como los ÚNICOS lugares donde se permite ese nivel de espectáculo.
Cualquier keyframe que no caiga en una de estas 3 categorías o que duplique el propósito de otro, se elimina.

**Iconografía:**
Unificar todo a SVG stroke custom (el estilo que ya usa la mayoría de la app). Auditar y reemplazar todo uso de Bootstrap Icons (`bi bi-*`) — confirmado en `TeamPage.vue` y a verificar en el resto del proyecto durante la fase de fundación.

## Enfoque técnico

- **Tokens**: CSS custom properties en `:root` de `src/style.css` (mismo lugar donde ya viven `--brand-*`, `--surface-*`, `--ease-*`). No se introduce un sistema de theming nuevo (ni Tailwind config extendido masivamente, ni CSS-in-JS) — se sigue el patrón ya establecido en este proyecto.
- **Asignación de zona por ruta**: agregar `meta: { zone: 'hub' | 'play' | 'data' }` a cada entrada de `src/router/router.js` (mismo patrón ya usado para `meta.immersive`). Explícito y fácil de extender para rutas nuevas — se evita inferir la zona por el path.
- **Aplicación del acento**: los componentes de cada zona referencian directamente la variable de acento que les corresponde (`var(--hub-500)`, `var(--play-500)`, `var(--data-500)`) en vez de una cascada automática por atributo — mantiene cada componente legible sin depender de contexto heredado de un ancestro lejano.
- **Superficies**: dos clases utilitarias nuevas (`.surface-solid`, `.surface-flat`) conviven con `.card` (ya existente) — no se reemplaza `.card` de una, se migra progresivamente durante el rollout por zona.

## Rollout

1. **Fundación** (esta spec → plan de implementación): tokens en `style.css`, `meta.zone` en el router, clases de superficie, auditoría y reemplazo de íconos Bootstrap, poda del set de animaciones. No debería ser visible como "cambio grande" todavía — es la base.
2. **Zona Hub**: Landing, PlayPoints, FriendsDock, Profile/ProfileEdit, Pricing, Tienda, Notifications, Messages. Es la puerta de entrada — mayor impacto percibido primero.
3. **Zona Juego**: los 14 juegos + GameShell + overlays de recompensa/logro/nivel.
4. **Zona Data**: Competiciones, ligas/brackets, equipos, ranking.

Cada fase se implementa, se prueba en vivo (Playwright, mismos breakpoints que la Fase 1: 375/768/1280/1920) y se confirma con el owner antes de pasar a la siguiente. No se avanza a la fase N+1 sin haber validado la fase N.

## Testing / verificación

- **Visual, por zona y breakpoint**: reutilizar el mismo método de la Fase 1 (Playwright logueado, capturas + medición de `document.body.scrollWidth` vs viewport) para confirmar que el rediseño no reintroduce overflow/colisiones ya resueltas.
- **Contraste**: verificar WCAG AA en las combinaciones nuevas sobre fondo navy — particularmente texto dorado (`--play-400`) y violeta claro (`--hub-300`) sobre `--mb-900`/`--mb-800`, que son las más propensas a fallar contraste en tonos claros sobre oscuro.
- **Regresión**: confirmar que los 4 fixes de la Fase 1 (scroll-to-top, overflow de `<main>`, FriendsDock, truncamiento de nombres) siguen sosteniendo después de cada fase — el rediseño toca los mismos archivos (`App.vue`, `style.css`).
- **Cross-zona**: al terminar las 3 zonas, un pase final navegando entre zonas (ej. Home → un juego → una liga → volver) para confirmar que la transición se siente como un solo producto y no un salto brusco.

## Riesgos / decisiones abiertas para la fase de fundación

- El acento dorado de la Zona Juego y `--prestige-gold` (PRO/rachas, cross-zona) son visualmente muy cercanos — definir si son el mismo token o si necesitan diferenciarse levemente para no confundir "sos PRO" con "estás en una racha".
- Migrar `.card` → `.surface-solid`/`.surface-flat` en decenas de componentes es mecánico pero extenso; conviene hacerlo por archivo dentro de cada fase de zona, no como barrido global previo.
- La auditoría de Bootstrap Icons puede revelar más superficies afectadas de las conocidas (`TeamPage.vue` es la única confirmada hoy) — se dimensiona durante la fundación, no acá.
