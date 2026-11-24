import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// PWA (vite-plugin-pwa): manifest + service worker con Workbox.
// El SW se registra a mano en src/main.js (sólo en web, nunca dentro de la app
// nativa de Capacitor), por eso injectRegister: null.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: null,
  includeAssets: ['favicon.ico', 'favicon-48.png', 'favicon-96.png', 'apple-touch-icon.png'],
  manifest: {
    id: '/',
    name: 'FULVO',
    short_name: 'FULVO',
    description: 'Entrená tu conocimiento de fútbol jugando: micro-juegos, rachas y logros.',
    lang: 'es-AR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1220', // body de src/style.css
    theme_color: '#0b1220',
    categories: ['games', 'sports', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // App shell: JS/CSS/HTML + fuentes self-hosted + íconos. NO precacheamos
    // public/ entero (videos del hero, cosméticos, etc.: pesan mucho).
    globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*.png', 'favicon*.{ico,png}'],
    // dataGAMES (~540 kB) entra holgado; subimos el tope por si crece.
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    navigateFallback: '/index.html',
    // /fotmob/* es un proxy (rewrite de Vercel), no una ruta de la SPA.
    navigateFallbackDenylist: [/^\/fotmob/],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      // Datos en vivo: nunca desde cache (auth, saldos, rankings, partidos).
      { urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'), handler: 'NetworkOnly' },
      { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/fotmob/'), handler: 'NetworkOnly' },
      { urlPattern: ({ url }) => url.hostname === 'images.fotmob.com', handler: 'NetworkOnly' },
      // Banderas y fuentes externas: inmutables, cache-first.
      {
        urlPattern: ({ url }) => url.hostname === 'flagcdn.com' || url.hostname.endsWith('.flagcdn.com'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'flags',
          expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ url, request }) =>
          url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || request.destination === 'font',
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts',
          expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Imágenes propias (public/): cache-first con tope.
      {
        urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
})

export default defineConfig(() => {
  return {
    plugins: [vue(), tailwindcss(), pwa],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      proxy: {
        '/fotmob': {
          target: 'https://www.fotmob.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/fotmob/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // vue/vue-router/supabase-js son pesados, los necesita TODA la app y casi
          // no cambian entre deploys → separados del chunk "index" (que sí cambia
          // seguido), el browser los cachea aparte y no los vuelve a bajar en cada
          // release nuestro.
          manualChunks: {
            vendor: ['vue', 'vue-router'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
