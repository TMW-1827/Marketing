/**
 * Заглушка для virtual:pwa-register/react.
 *
 * У демо-збірці плагін PWA вимкнений, і віртуального модуля не існує.
 * Підставляється через alias у vite.config.ts, щоб UpdatePrompt не довелося
 * обкладати умовами: він просто ніколи нічого не показує.
 */
export function useRegisterSW() {
  return {
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  }
}
