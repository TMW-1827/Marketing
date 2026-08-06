import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Дві цілі збірки:
 *   (за замовчуванням) — веб;
 *   demo — один самодостатній HTML для показу за посиланням.
 *
 * Base завжди відносний. Сайт живе в підкаталозі GitHub Pages
 * (/marketing/training-portal/), і той самий білд має працювати в нативній
 * обгортці Capacitor, де файли віддаються з файлової системи. Абсолютний
 * base зламав би обидва випадки, а маршрутизація на хешах робить відносні
 * шляхи безпечними: сторінка завжди одна.
 */
const isDemo = process.env.BUILD_TARGET === 'demo'
const base = './'

export default defineConfig({
  base,
  define: {
    // У демо-збірці вмикаємо тестовий вхід, щоб екран логіна можна було
    // перевірити без бази. Для звичайної збірки значення береться з .env.
    ...(isDemo
      ? { 'import.meta.env.VITE_DEMO_AUTH': JSON.stringify('true') }
      : {}),
  },
  plugins: [
    react(),
    // Демо — один файл: усе інлайниться, service worker не реєструється.
    ...(isDemo ? [viteSingleFile()] : []),
    ...(isDemo ? [] : [VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: 'truskavetska-training-portal',
        name: 'Трускавецька — навчальний портал',
        short_name: 'Трускавецька',
        description: 'Навчальний портал для працівників ТМ «Трускавецька»',
        lang: 'uk',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F6FA',
        theme_color: '#005EB8',
        categories: ['education', 'business'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Весь контент курсу — у бандлі, тому офлайн працює одразу після першого запуску.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Дані з бекенду: показуємо кеш миттєво, оновлюємо у фоні.
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    })]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Без плагіна PWA віртуального модуля не існує — підставляємо заглушку
      ...(isDemo
        ? {
            'virtual:pwa-register/react': fileURLToPath(
              new URL('./src/lib/pwa-register-stub.ts', import.meta.url),
            ),
          }
        : {}),
    },
  },
  build: {
    target: 'es2022',
    // Зібраний портал лежить у репозиторії, а карти коду важать більше за
    // сам бандл. Для розбору помилок їх вмикають на час: SOURCEMAP=true
    sourcemap: process.env.SOURCEMAP === 'true',
    // У демо шрифти й іконки мають стати data:-URI, інакше файл не самодостатній
    assetsInlineLimit: isDemo ? 4 * 1024 * 1024 : 4096,
    rollupOptions: isDemo
      ? {}
      : {
          output: {
            manualChunks: {
              // Контент курсу окремим чанком — оновлення тексту не інвалідує вендор.
              vendor: ['react', 'react-dom', 'react-router-dom'],
              supabase: ['@supabase/supabase-js'],
            },
          },
        },
  },
  server: {
    port: 5173,
    host: true,
  },
})
