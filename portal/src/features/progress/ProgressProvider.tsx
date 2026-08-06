import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { getJson, localStore, setJson, STORAGE_KEYS } from '@/lib/storage'
import { course, trackableSectionIds } from '@/content/course'

export interface ProgressState {
  completedSections: string[]
  bestScore: number | null
  passedAt: string | null
  updatedAt: string
}

const EMPTY: ProgressState = {
  completedSections: [],
  bestScore: null,
  passedAt: null,
  updatedAt: new Date(0).toISOString(),
}

interface ProgressContextValue extends ProgressState {
  ready: boolean
  /** Скільки розділів із тих, що рахуються, пройдено */
  doneCount: number
  totalCount: number
  isDone(sectionId: string): boolean
  toggleSection(sectionId: string, done: boolean): void
  recordAttempt(score: number, total: number): Promise<void>
  reset(): Promise<void>
  /** true, якщо є незбережені на сервері зміни */
  pendingSync: boolean
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

/** Об'єднання локального й серверного стану: нічого не губимо. */
function merge(a: ProgressState, b: ProgressState): ProgressState {
  const sections = new Set([...a.completedSections, ...b.completedSections])
  const bestScore =
    a.bestScore === null
      ? b.bestScore
      : b.bestScore === null
        ? a.bestScore
        : Math.max(a.bestScore, b.bestScore)
  return {
    completedSections: [...sections],
    bestScore,
    passedAt: a.passedAt ?? b.passedAt,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { userId, canSync, ready: authReady } = useAuth()
  const [state, setState] = useState<ProgressState>(EMPTY)
  const [ready, setReady] = useState(false)
  const [pendingSync, setPendingSync] = useState(false)

  // Прогрес зберігається окремо для кожного акаунта: на спільному
  // комп'ютері працівники не мають бачити чужі позначки, а в демо-режимі
  // перемикання між тестовими акаунтами має показувати різні дані.
  const storageKey = `${STORAGE_KEYS.progress}:${userId ?? 'local'}`

  // Актуальний стан для функцій синхронізації без зайвих перерендерів.
  const stateRef = useRef(state)
  stateRef.current = state

  /** Записує стан на сервер. Позначає pendingSync, якщо не вдалось. */
  const push = useCallback(
    async (next: ProgressState) => {
      if (!canSync || !supabase || !userId) return
      const { error } = await supabase.from('progress').upsert(
        {
          user_id: userId,
          course_id: course.id,
          completed_sections: next.completedSections,
          best_score: next.bestScore,
          passed_at: next.passedAt,
          updated_at: next.updatedAt,
        },
        { onConflict: 'user_id,course_id' },
      )
      setPendingSync(Boolean(error))
      if (error) console.warn('Прогрес не синхронізовано:', error.message)
    },
    [userId, canSync],
  )

  /* Перше завантаження: локальні дані показуємо одразу, серверні доливаємо. */
  useEffect(() => {
    if (!authReady) return
    let cancelled = false

    const load = async () => {
      const local = await getJson(localStore, storageKey, EMPTY)
      if (cancelled) return
      setState(local)
      setReady(true)

      if (!canSync || !supabase || !userId) return

      const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', course.id)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setPendingSync(true)
        return
      }

      const remote: ProgressState = data
        ? {
            completedSections: data.completed_sections ?? [],
            bestScore: data.best_score,
            passedAt: data.passed_at,
            updatedAt: data.updated_at,
          }
        : EMPTY

      const merged = merge(local, remote)
      setState(merged)
      await setJson(localStore, storageKey, merged)
      // Локально могло бути більше, ніж на сервері — вирівнюємо сервер.
      if (
        merged.completedSections.length !== remote.completedSections.length ||
        merged.bestScore !== remote.bestScore
      ) {
        await push(merged)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authReady, userId, canSync, storageKey, push])

  /** Локальний запис — миттєвий, серверний — услід. */
  const commit = useCallback(
    (next: ProgressState) => {
      setState(next)
      void setJson(localStore, storageKey, next)
      void push(next)
    },
    [push, storageKey],
  )

  const toggleSection = useCallback(
    (sectionId: string, done: boolean) => {
      const current = stateRef.current
      const set = new Set(current.completedSections)
      if (done) set.add(sectionId)
      else set.delete(sectionId)
      commit({
        ...current,
        completedSections: [...set],
        updatedAt: new Date().toISOString(),
      })
    },
    [commit],
  )

  const recordAttempt = useCallback(
    async (score: number, total: number) => {
      const current = stateRef.current
      const passed = score >= course.passScore
      const best =
        current.bestScore === null ? score : Math.max(current.bestScore, score)

      commit({
        ...current,
        bestScore: best,
        passedAt: passed ? (current.passedAt ?? new Date().toISOString()) : current.passedAt,
        updatedAt: new Date().toISOString(),
      })

      if (canSync && supabase && userId) {
        const { error } = await supabase.from('quiz_attempts').insert({
          user_id: userId,
          course_id: course.id,
          score,
          total,
          passed,
        })
        if (error) {
          setPendingSync(true)
          console.warn('Спробу тесту не збережено:', error.message)
        }
      }
    },
    [commit, userId, canSync],
  )

  const reset = useCallback(async () => {
    const cleared: ProgressState = { ...EMPTY, updatedAt: new Date().toISOString() }
    setState(cleared)
    await setJson(localStore, storageKey, cleared)
    await push(cleared)
  }, [push, storageKey])

  /* Повторна спроба синхронізації, коли зв'язок повернувся. */
  useEffect(() => {
    if (!pendingSync) return
    const retry = () => void push(stateRef.current)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [pendingSync, push])

  const value = useMemo<ProgressContextValue>(() => {
    const doneCount = state.completedSections.filter((id) =>
      trackableSectionIds.includes(id),
    ).length
    return {
      ...state,
      ready,
      pendingSync,
      doneCount,
      totalCount: trackableSectionIds.length,
      isDone: (id: string) => state.completedSections.includes(id),
      toggleSection,
      recordAttempt,
      reset,
    }
  }, [state, ready, pendingSync, toggleSection, recordAttempt, reset])

  return (
    <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
  )
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress використано поза ProgressProvider')
  return ctx
}
