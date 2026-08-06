import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from '@/lib/supabase'
import { hasBackend, hasDemoAuth } from '@/lib/config'
import { localStore } from '@/lib/storage'
import { demoAccountById, findDemoAccount } from './demoAccounts'

const LOCAL_PROFILE_KEY = 'tr_local_profile_v1'
const DEMO_SESSION_KEY = 'tr_demo_session_v1'

/**
 * Режими роботи порталу:
 *   backend — справжні акаунти Supabase, прогрес синхронізується;
 *   demo    — вхід за вбудованими тестовими акаунтами, усе локально;
 *   open    — без входу взагалі, матеріали одразу.
 */
export type AuthMode = 'backend' | 'demo' | 'open'

export interface SignUpInput {
  email: string
  password: string
  fullName: string
  position?: string
  region?: string
}

interface AuthContextValue {
  /** Первинна перевірка сесії завершена */
  ready: boolean
  mode: AuthMode
  /** Чи показувати екран входу */
  requiresLogin: boolean
  /** Чи є куди синхронізувати прогрес */
  canSync: boolean
  /** Ідентифікатор для розділення прогресу між акаунтами */
  userId: string | null
  email: string | null
  profile: Profile | null
  isAdmin: boolean
  signIn(email: string, password: string): Promise<void>
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  /** Без акаунтів: ім'я для сертифіката зберігається локально */
  setLocalName(name: string): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const mode: AuthMode = hasBackend ? 'backend' : hasDemoAuth ? 'demo' : 'open'

function localProfile(fullName: string): Profile {
  return {
    id: 'local',
    full_name: fullName,
    position: null,
    region: null,
    role: 'employee',
    created_at: new Date().toISOString(),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [demoEmail, setDemoEmail] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.warn('Не вдалося завантажити профіль:', error.message)
      return
    }
    setProfile(data)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (mode === 'demo') {
      // Демо-сесія переживає перезавантаження: інакше кожне оновлення
      // сторінки викидало б із порталу посеред перевірки.
      void localStore.get(DEMO_SESSION_KEY).then((id) => {
        if (cancelled) return
        const account = id ? demoAccountById(id) : undefined
        if (account) {
          setProfile(account.profile)
          setDemoEmail(account.email)
        }
        setReady(true)
      })
      return () => {
        cancelled = true
      }
    }

    if (mode === 'open') {
      // Імені може ще не бути — його спитають на сертифікаті.
      void localStore.get(LOCAL_PROFILE_KEY).then((name) => {
        if (cancelled) return
        if (name) setProfile(localProfile(name))
        setReady(true)
      })
      return () => {
        cancelled = true
      }
    }

    void supabase!.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) void loadProfile(data.session.user.id)
      setReady(true)
    })

    const { data: sub } = supabase!.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) {
        void loadProfile(next.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (mode === 'demo') {
      const account = findDemoAccount(email, password)
      if (!account) throw new Error('Невірна пошта або пароль')
      await localStore.set(DEMO_SESSION_KEY, account.profile.id)
      setProfile(account.profile)
      setDemoEmail(account.email)
      return
    }
    if (!supabase) throw new Error('Бекенд не налаштований')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(translateAuthError(error.message))
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    if (mode === 'demo') {
      throw new Error(
        'У демо-режимі реєстрація недоступна — скористайтеся тестовим акаунтом нижче',
      )
    }
    if (!supabase) throw new Error('Бекенд не налаштований')
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          position: input.position ?? '',
          region: input.region ?? '',
        },
      },
    })
    if (error) throw new Error(translateAuthError(error.message))
    return { needsConfirmation: data.session === null }
  }, [])

  const signOut = useCallback(async () => {
    if (mode === 'demo') {
      await localStore.remove(DEMO_SESSION_KEY)
      setProfile(null)
      setDemoEmail(null)
      return
    }
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const setLocalName = useCallback(async (name: string) => {
    await localStore.set(LOCAL_PROFILE_KEY, name)
    setProfile(localProfile(name))
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const userId =
      mode === 'backend'
        ? (session?.user.id ?? null)
        : mode === 'demo'
          ? (profile?.id ?? null)
          : null
    const signedIn = mode === 'backend' ? session !== null : profile !== null

    return {
      ready,
      mode,
      requiresLogin: mode !== 'open' && !signedIn,
      canSync: mode === 'backend',
      userId,
      email: mode === 'backend' ? (session?.user.email ?? null) : demoEmail,
      profile,
      isAdmin: profile?.role === 'admin',
      signIn,
      signUp,
      signOut,
      setLocalName,
    }
  }, [ready, session, profile, demoEmail, signIn, signUp, signOut, setLocalName])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth використано поза AuthProvider')
  return ctx
}

/** Повідомлення Supabase англійською — показуємо працівникам українською. */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Невірна пошта або пароль',
    'Email not confirmed': 'Пошту ще не підтверджено — перевірте лист',
    'User already registered': 'Такий користувач уже зареєстрований',
    'Password should be at least 6 characters':
      'Пароль має містити щонайменше 6 символів',
  }
  return map[message] ?? message
}
