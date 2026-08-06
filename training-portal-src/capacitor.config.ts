/**
 * Конфігурація нативної обгортки Capacitor.
 *
 * Файл лежить у репозиторії заздалегідь, щоб мобільні збірки не вимагали
 * переналаштування вебу. Платформи ще не додані — коли дійде черга:
 *
 *   npm i @capacitor/core @capacitor/cli @capacitor/preferences
 *   npm run build
 *   npx cap add android && npx cap add ios
 *   npx cap sync
 *
 * Окремої цілі збірки не потрібно: шляхи всередині бандла відносні, тому
 * той самий dist працює і на Pages, і у WebView з файлової системи.
 *
 * Тип CapacitorConfig підключається разом із @capacitor/cli; поки пакета
 * немає, описуємо форму об'єкта локально, щоб файл не ламав tsc.
 */

interface CapacitorConfig {
  appId: string
  appName: string
  webDir: string
  android?: { backgroundColor?: string }
  ios?: { contentInset?: string; backgroundColor?: string }
  plugins?: Record<string, unknown>
}

const config: CapacitorConfig = {
  appId: 'ua.truskavetska.portal',
  appName: 'Трускавецька',
  webDir: 'dist',
  android: {
    backgroundColor: '#F2F6FA',
  },
  ios: {
    // безпечні зони обробляє CSS (env(safe-area-inset-*)), тому WebView
    // не має додавати власні відступи
    contentInset: 'never',
    backgroundColor: '#F2F6FA',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 600,
      backgroundColor: '#005EB8',
    },
  },
}

export default config
