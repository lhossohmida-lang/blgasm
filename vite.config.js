import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://blgasm.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.svg'],
      manifest: {
        name: 'متجر المواد الغذائية',
        short_name: 'متجر',
        description: 'نظام إدارة متجر المواد الغذائية - مخزون، مبيعات، كريديت',
        theme_color: '#063f2b',
        background_color: '#063f2b',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-cache', expiration: { maxEntries: 50 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
})
