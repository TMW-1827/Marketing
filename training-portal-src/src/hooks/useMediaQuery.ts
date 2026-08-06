import { useSyncExternalStore } from 'react'

/**
 * Реактивний медіа-запит.
 *
 * Потрібен там, де відмінність між телефоном і десктопом не косметична,
 * а структурна — наприклад, пошук: інлайн-поле проти повноекранної панелі.
 * Косметику лишаємо в CSS.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const DESKTOP = '(min-width: 901px)'
