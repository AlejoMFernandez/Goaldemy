import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Optional PWA plugin; loaded dynamically so build doesn't fail if not installed yet
export default defineConfig(async ({ mode }) => {
  let VitePWA = null
  try {
    // dynamic import to avoid hard dependency
    const m = await import('vite-plugin-pwa')
    VitePWA = m?.VitePWA || null
  } catch {}

  const pwa = VitePWA ? VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['goaldemy.png'],
    manifest: {
      name: 'Goaldemy',
      short_name: 'Goaldemy',
      description: 'Entrená tu conocimiento de fútbol jugando: micro‑juegos, rachas y logros.',
      start_url: '/',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#0f172a',
      icons: [
        { src: '/goaldemy.png', sizes: '192x192', type: 'image/png' },
        { src: '/goaldemy.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      navigateFallback: '/index.html',
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
          },
        },
        {
          urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'static-resources' },
        },
      ],
    },
  }) : null

  return {
    plugins: [vue(), tailwindcss(), pwa].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  }
})
