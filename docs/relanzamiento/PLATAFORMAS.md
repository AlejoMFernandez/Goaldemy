# FULVO en todas las plataformas

Estado de los cimientos para publicar FULVO como **app de Android/iOS**, **app de escritorio** y **web**. Actualizado: noviembre 2026 (rama `chore/cimientos-mobile`).

## Qué ya está listo

| Pieza | Estado | Dónde |
|---|---|---|
| PWA instalable (manifest, íconos, service worker) | ✅ | `vite.config.js`, `public/icons/` |
| Fuentes self-hosted (andan offline) | ✅ | `src/main.js` (`@fontsource`) |
| Bundle inicial liviano (planteles lazy) | ✅ | `src/services/players.js` → `ensurePlayersLoaded()` |
| Capacitor 8 configurado (`ar.com.fulvo.app`) | ✅ | `capacitor.config.json` |
| Proyecto Android generado | ✅ (sin compilar acá: no hay Android SDK en el entorno del agente) | `android/` |
| Proyecto iOS | ⏳ hay que generarlo en una Mac | ver abajo |
| Status bar, splash, botón atrás de Android | ✅ | `src/services/native.js` |
| Háptica (nativo + `navigator.vibrate`) | ✅ (falta usarla en los juegos) | `src/services/haptics.js` |
| CI (build + tests en cada PR) | ✅ | `.github/workflows/ci.yml` |

## Web / PWA

- `npm run build && npm run preview` → abrir `http://localhost:4173`.
- **Escritorio (Chrome / Edge)**: ícono de "Instalar" en la barra de direcciones → queda como app con ventana propia, en el menú inicio / Launchpad.
- **Android (Chrome)**: menú ⋮ → "Instalar app".
- **iOS (Safari)**: Compartir → "Agregar a inicio".
- El service worker se actualiza solo (`autoUpdate`). Supabase, `/fotmob/` e `images.fotmob.com` **nunca** se cachean; banderas y fuentes sí.
- Más adelante, si hace falta app de escritorio "real" (tiendas de Windows/Mac), se puede envolver con **Tauri** usando el mismo `dist/`.

## Android

Requisitos: Android Studio (trae el SDK y JDK 21).

```bash
npm ci
npm run cap:android      # build + cap sync + abre Android Studio
```

En Android Studio: ▶ Run para probar en un celu/emulador; **Build → Generate Signed App Bundle** para el `.aab` de Google Play (guardar el keystore fuera del repo, ¡si se pierde no se puede actualizar la app!).

Cada vez que cambia el código web: `npm run cap:sync`.

## iOS

Requisitos: una **Mac** con Xcode y CocoaPods, y cuenta de Apple Developer (USD 99/año).

```bash
npm ci
npx cap add ios          # una sola vez; commitear la carpeta ios/
npm run cap:ios          # build + sync + abre Xcode
```

En Xcode: elegir el Team de firma, Product → Archive → subir a App Store Connect.

## Íconos y splash

- `npm run icons` regenera `public/icons/` desde `public/goaldemy.png` (o `node scripts/generate-icons.mjs ruta/al/logo.png`).
- **Pendiente**: un master del logo en **SVG o PNG de 1024px**. El actual mide 194px y el 512 queda un poco blando.
- Para los íconos y splash nativos: `npx @capacitor/assets generate` con `assets/icon.png` (1024) y `assets/splash.png` (2732). Hoy Android usa el ícono/splash por defecto de Capacitor.

## Bloqueantes antes de subir a las tiendas

1. **Pagos (IAP)** — Apple y Google exigen su sistema de compras para contenido digital (PRO, cosméticos, pase). Hoy `src/services/checkout.js` usa MercadoPago/Stripe vía la edge function `create-checkout`: **no se puede mostrar en la app nativa**. Opción recomendada: **RevenueCat** (`@revenuecat/purchases-capacitor`) + webhook a Supabase para otorgar el plan; en web se sigue con MercadoPago/Stripe. Mientras tanto, ocultar el checkout cuando `isNative()`.
2. **Login con Google en nativo** — `signInWithOAuth` usa `redirectTo: window.location.origin`, que en la app es `https://localhost`. Hace falta deep link (`ar.com.fulvo.app://auth-callback` o App Links con `fulvo.com.ar`), agregarlo a las Redirect URLs de Supabase y escucharlo con `App.addListener('appUrlOpen')`. Mismo tema para el link de "recuperar contraseña" y verificación de email.
3. **Sign in with Apple** — obligatorio en iOS si se ofrece login con Google.
4. **Proxy de FotMob** — `src/services/fotmob.js` usa `PROXY_BASE = '/fotmob'` (relativo). En nativo eso apunta a `https://localhost/fotmob` y **se rompe**. Solución: usar URL absoluta (`https://fulvo.com.ar/fotmob`) cuando `isNative()`, o mejor mover esas llamadas a una edge function de Supabase.
5. **Eliminar cuenta desde la app** — Apple y Google lo exigen (botón en el perfil + borrado real de datos en Supabase, y una URL web para Google Play).
6. **Moderación del chat / mensajes directos** — para contenido generado por usuarios las tiendas piden: reportar, bloquear usuarios y filtro de contenido.
7. **Propiedad intelectual de imágenes** — fotos de jugadores y escudos vienen de FotMob; nombres/escudos de clubes pueden tener marca registrada. Riesgo de rechazo en review: evaluar licencias, siluetas o avatares propios.
8. **Política de privacidad y ficha de datos** (Data Safety en Google, Privacy Nutrition Label en Apple) acorde a lo que guarda Supabase.

## Otros pendientes técnicos

- Revisar `env(safe-area-inset-*)` en navbar y overlays (la status bar va en overlay).
- Usar `haptics.js` en aciertos/errores de los juegos (zona Juegos).
- El historial de git todavía contiene `migration-backup/` (pooler-url y dumps). Ya no se trackea, pero conviene **rotar la contraseña de la base** y, si se quiere, purgar el historial con `git filter-repo`.
- Para que el workflow de planteles pueda abrir PRs: en GitHub → Settings → Actions → General → activar "Allow GitHub Actions to create and approve pull requests".
