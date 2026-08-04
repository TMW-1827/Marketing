import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'

type Mode = 'signin' | 'signup'

/** Екран входу. Показується, поки працівник не авторизований. */
export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [position, setPosition] = useState('')
  const [region, setRegion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        const { needsConfirmation } = await signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          position: position.trim(),
          region: region.trim(),
        })
        if (needsConfirmation) {
          setInfo(
            'Готово. Ми надіслали лист для підтвердження пошти — відкрийте його й поверніться сюди.',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося увійти')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="logo" style={{ marginBottom: 18 }}>
          Трускавецька
          <span>Навчальний портал</span>
        </div>

        <h3>{mode === 'signin' ? 'Вхід для працівників' : 'Реєстрація'}</h3>
        <p className="hint" style={{ marginBottom: 18 }}>
          {mode === 'signin'
            ? 'Прогрес навчання прив’язаний до вашого акаунта — його видно на будь-якому пристрої.'
            : 'Створіть акаунт робочою поштою. Ім’я з’явиться в сертифікаті.'}
        </p>

        <form onSubmit={onSubmit}>
          {mode === 'signup' && (
            <>
              <label className="field-label" htmlFor="auth-name">
                Прізвище та ім’я
              </label>
              <input
                id="auth-name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <label className="field-label" htmlFor="auth-position">
                Посада (необов’язково)
              </label>
              <input
                id="auth-position"
                type="text"
                autoComplete="organization-title"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />

              <label className="field-label" htmlFor="auth-region">
                Регіон (необов’язково)
              </label>
              <input
                id="auth-region"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </>
          )}

          <label className="field-label" htmlFor="auth-email">
            Робоча пошта
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="field-label" htmlFor="auth-password">
            Пароль
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div className="note note--warn" role="alert">
              {error}
            </div>
          )}
          {info && <div className="note note--ok">{info}</div>}

          <button
            type="submit"
            className="btn"
            style={{ width: '100%', marginTop: 14 }}
            disabled={busy}
          >
            {busy
              ? 'Хвилинку…'
              : mode === 'signin'
                ? 'Увійти'
                : 'Створити акаунт'}
          </button>
        </form>

        <button
          type="button"
          className="auth__switch"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setInfo(null)
          }}
        >
          {mode === 'signin'
            ? 'Ще немає акаунта? Зареєструватись'
            : 'Уже є акаунт? Увійти'}
        </button>
      </div>
    </div>
  )
}
