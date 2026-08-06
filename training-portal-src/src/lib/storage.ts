/**
 * Асинхронне сховище «ключ — значення».
 *
 * Інтерфейс навмисно асинхронний, хоча localStorage синхронний: у нативній
 * обгортці його замінить @capacitor/preferences, який повертає проміси.
 * Тоді зміниться лише реалізація нижче, а весь код навколо лишиться таким самим.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Запасний варіант, коли localStorage недоступний (приватний режим Safari). */
const memory = new Map<string, string>()

export const localStore: KeyValueStore = {
  async get(key) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memory.get(key) ?? null
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      memory.set(key, value)
    }
  },
  async remove(key) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      memory.delete(key)
    }
  },
}

export async function getJson<T>(
  store: KeyValueStore,
  key: string,
  fallback: T,
): Promise<T> {
  const raw = await store.get(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function setJson(
  store: KeyValueStore,
  key: string,
  value: unknown,
): Promise<void> {
  await store.set(key, JSON.stringify(value))
}

export const STORAGE_KEYS = {
  progress: 'tr_progress_v2',
  pendingSync: 'tr_pending_sync_v1',
} as const
