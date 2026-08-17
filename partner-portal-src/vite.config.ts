import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Дві цілі збірки:
 *   (за замовчуванням) — веб, публікується в /partner-portal/;
 *   demo — один самодостатній HTML для показу за посиланням.
 *
 * Base завжди відносний. Сайт живе в підкаталозі GitHub Pages
 * (/marketing/partner-portal/), і той самий білд має працювати в нативній
 * обгортці, де файли віддаються з файлової системи. Абсолютний base зламав
 * би обидва випадки, а маршрутизація на хешах робить відносні шляхи
 * безпечними: сторінка завжди одна.
 */
const isDemo = process.env.BUILD_TARGET === 'demo'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Демо — один файл: усе інлайниться, service worker не реєструється.
    ...(isDemo ? [viteSingleFile()] : []),
    ...(isDemo ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: 'truskavetska-partner-portal',
        name: 'Трускавецька — портал для партнерів',
        short_name: 'Трускавецька',
        description:
          'Зовнішній портал ТМ «Трускавецька»: про воду, асортимент, логістику, документи та співпрацю',
        lang: 'uk',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F6FA',
        theme_color: '#005EB8',
        categories: ['business', 'food'],
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
        // Увесь контент — у бандлі, тому офлайн працює одразу після
        // першого відкриття: партнер відкриє портал і в полі, і в дорозі.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    })]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
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
              // Контент окремим чанком — правки тексту не інвалідують вендор.
              vendor: ['react', 'react-dom', 'react-router-dom'],
            },
          },
        },
  },
  server: {
    port: 5174,
    host: true,
  },
})
