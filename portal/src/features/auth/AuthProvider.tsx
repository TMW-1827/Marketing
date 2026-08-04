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
import { hasBackend } from '@/lib/config'
import { localStore } from '@/lib/storage'

const LOCAL_PROFILE_KEY = 'tr_local_profile_v1'

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
  /** true — працюємо з бекендом, false — автономний режим */
  backend: boolean
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  signIn(email: string, password: string): Promise<void>
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  /** Автономний режим: ім'я для сертифіката зберігається локально */
  setLocalName(name: string): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

    if (!supabase) {
      // Автономний режим: імені може ще не бути — його спитають на сертифікаті.
      void localStore.get(LOCAL_PROFILE_KEY).then((name) => {
        if (cancelled) return
        if (name) setProfile(localProfile(name))
        setReady(true)
      })
      return () => {
        cancelled = true
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) void loadProfile(data.session.user.id)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
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
    if (!supabase) throw new Error('Бекенд не налаштований')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(translateAuthError(error.message))
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
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
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const setLocalName = useCallback(async (name: string) => {
    await localStore.set(LOCAL_PROFILE_KEY, name)
    setProfile(localProfile(name))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      backend: hasBackend,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      signIn,
      signUp,
      signOut,
      setLocalName,
    }),
    [ready, session, profile, signIn, signUp, signOut, setLocalName],
  )

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
