/**
 * Конфігурація середовища.
 *
 * Портал працює у двох режимах:
 *  • з бекендом — коли задані VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY:
 *    вхід за акаунтом, прогрес синхронізується між пристроями, адмінка бачить звіти;
 *  • автономно — коли змінних немає: усе зберігається локально в браузері.
 *
 * Другий режим потрібен для розробки, демо й аварійного випадку, коли бекенд
 * недоступний: навчальні матеріали мають відкриватись завжди.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabaseConfig =
  url && anonKey ? ({ url, anonKey } as const) : null

/** Чи підключений бекенд. */
export const hasBackend = supabaseConfig !== null

/**
 * Демонстраційний вхід: екран логіна працює на вбудованих тестових акаунтах,
 * без бази. Потрібен, щоб перевіряти сценарії входу, ролей і адмінки до того,
 * як з'явиться Supabase.
 *
 * Вмикається змінною VITE_DEMO_AUTH=true і завжди програє справжньому
 * бекенду: щойно з'являються ключі Supabase, демо-акаунти вимикаються.
 */
export const hasDemoAuth =
  !hasBackend && import.meta.env.VITE_DEMO_AUTH === 'true'

/**
 * Чи працюємо всередині нативної обгортки Capacitor.
 * Використовується для дрібних відмінностей поведінки: жести «назад»,
 * зовнішні посилання, статус-бар.
 */
export function isNativeApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    // Capacitor додає цей об'єкт у WebView
    Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
  )
}

/** Чи запущено як встановлений застосунок (PWA standalone або нативно). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return true
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari до 17
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}
