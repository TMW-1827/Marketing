import { useSyncExternalStore } from 'react'
import type { Carbonation, Packaging } from '@/types/catalog'

/**
 * Стан каталогу живе поза деревом компонентів: фільтри виставляє і полиця,
 * і глобальний пошук, а картку товару треба вміти відкрити з будь-якого місця.
 * Провайдер тут був би зайвим — віджети рендеряться з даних розділу.
 */
export interface CatalogFilters {
  volume: string | 'всі'
  carbonation: Carbonation | 'всі'
  packaging: Packaging | 'всі'
}

interface CatalogState {
  filters: CatalogFilters
  selectedSkuId: number | null
}

const initial: CatalogState = {
  filters: { volume: 'всі', carbonation: 'всі', packaging: 'всі' },
  selectedSkuId: null,
}

let state: CatalogState = initial
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setFilter<K extends keyof CatalogFilters>(
  key: K,
  value: CatalogFilters[K],
): void {
  state = { ...state, filters: { ...state.filters, [key]: value } }
  emit()
}

export function setFilters(filters: Partial<CatalogFilters>): void {
  state = { ...state, filters: { ...state.filters, ...filters } }
  emit()
}

export function resetFilters(): void {
  state = { ...state, filters: initial.filters }
  emit()
}

export function openSku(id: number): void {
  state = { ...state, selectedSkuId: id }
  emit()
}

export function closeSku(): void {
  if (state.selectedSkuId === null) return
  state = { ...state, selectedSkuId: null }
  emit()
}

export function useCatalogFilters(): CatalogFilters {
  return useSyncExternalStore(
    subscribe,
    () => state.filters,
    () => initial.filters,
  )
}

export function useSelectedSkuId(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => state.selectedSkuId,
    () => null,
  )
}
