import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'

/**
 * Сертифікат про проходження навчання.
 *
 * У режимі з акаунтами ім'я береться з профілю — його не можна підмінити,
 * тому сертифікат щось означає. В автономному режимі ім'я вводиться вручну
 * й зберігається локально.
 */
export function Certificate({ score, total }: { score: number; total: number }) {
  const { profile, backend, setLocalName } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [issued, setIssued] = useState(Boolean(profile?.full_name) && backend)

  const date = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  const issue = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!backend) void setLocalName(trimmed)
    setIssued(true)
  }

  return (
    <div className="card">
      <h3>Сертифікат</h3>

      {!issued && (
        <div className="calc-row">
          <div style={{ flex: '1 1 240px' }}>
            <label className="field-label" htmlFor="cert-name">
              Прізвище та ім’я
            </label>
            <input
              id="cert-name"
              type="text"
              placeholder="Введіть ПІБ"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button type="button" className="btn" onClick={issue}>
              Сформувати
            </button>
          </div>
        </div>
      )}

      {issued && (
        <>
          <div className="certificate">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              ТМ «Трускавецька» · З самого серця Карпат!
            </div>
            <div className="certificate__title">
              Сертифікат
              <br />
              про проходження навчання
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 14 }}>
              Підтверджує, що
            </div>
            <div className="certificate__name">
              {(profile?.full_name ?? name).trim()}
            </div>
            <div style={{ fontSize: 13.5 }}>
              успішно склав(ла) підсумковий тест внутрішнього навчального курсу
              <br />
              про продукцію ТМ «Трускавецька»
            </div>
            <div className="certificate__meta">
              Результат: {score} із {total} (
              {Math.round((score / total) * 100)}%)
              <br />
              Дата: {date}
              <br />
              Для внутрішнього використання
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost no-print"
            style={{ marginTop: 14 }}
            onClick={() => window.print()}
          >
            Роздрукувати
          </button>
        </>
      )}
    </div>
  )
}
