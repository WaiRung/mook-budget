import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'


const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'ระบบติดตามงบประมาณ',
        short_name: 'งบประมาณ',
        description: 'ระบบอ่าน Excel และติดตามการใช้จ่าย',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/mook-budget/',
        start_url: '/mook-budget/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2,mjs,xlsx}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: ONE_YEAR_IN_SECONDS
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  base: '/mook-budget/',
})
