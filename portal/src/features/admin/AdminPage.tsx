import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { course, trackableSectionIds } from '@/content/course'
import { QUIZ } from '@/data/quiz'

interface ReportRow {
  user_id: string
  full_name: string
  position: string | null
  region: string | null
  role: 'employee' | 'admin'
  course_id: string | null
  sections_done: number
  best_score: number | null
  passed_at: string | null
  last_activity: string | null
  attempts: number
}

type SortKey = 'name' | 'progress' | 'score' | 'activity'

/** Зведений звіт для керівника: хто пройшов навчання і з яким результатом. */
export function AdminPage() {
  const { isAdmin, ready } = useAuth()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('progress')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!isAdmin || !supabase) return
    let cancelled = false

    void supabase
      .from('employee_report')
      .select('*')
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setRows((data ?? []) as ReportRow[])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const total = trackableSectionIds.length

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? rows.filter((r) =>
          `${r.full_name} ${r.position ?? ''} ${r.region ?? ''}`
            .toLowerCase()
            .includes(needle),
        )
      : rows

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.full_name.localeCompare(b.full_name, 'uk')
        case 'score':
          return (b.best_score ?? -1) - (a.best_score ?? -1)
        case 'activity':
          return (b.last_activity ?? '').localeCompare(a.last_activity ?? '')
        case 'progress':
        default:
          return b.sections_done - a.sections_done
      }
    })
  }, [rows, sort, query])

  const summary = useMemo(() => {
    const passed = rows.filter((r) => r.passed_at !== null).length
    const started = rows.filter((r) => r.sections_done > 0).length
    return { people: rows.length, started, passed }
  }, [rows])

  if (!ready) return null
  if (!isAdmin) return <Navigate to="/start" replace />

  return (
    <article className="section-enter">
      <div className="eyebrow">Адміністрування</div>
      <h2>Звіт про навчання</h2>
      <div className="rule" />
      <p className="lede">
        Курс «{course.title}». Прохідний бал — {course.passScore} із{' '}
        {QUIZ.length}.
      </p>

      <div className="stats">
        <div className="stat">
          <div className="stat__value">{summary.people}</div>
          <div className="stat__label">Працівників у системі</div>
        </div>
        <div className="stat">
          <div className="stat__value">{summary.started}</div>
          <div className="stat__label">Почали проходити курс</div>
        </div>
        <div className="stat stat--green">
          <div className="stat__value">{summary.passed}</div>
          <div className="stat__label">Склали підсумковий тест</div>
        </div>
      </div>

      <section className="card">
        <div className="calc-row">
          <div style={{ flex: '1 1 220px' }}>
            <label className="field-label" htmlFor="admin-search">
              Пошук працівника
            </label>
            <input
              id="admin-search"
              type="search"
              placeholder="Ім’я, посада або регіон"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label className="field-label" htmlFor="admin-sort">
              Сортувати
            </label>
            <select
              id="admin-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="progress">За прогресом</option>
              <option value="score">За балом тесту</option>
              <option value="activity">За останньою активністю</option>
              <option value="name">За іменем</option>
            </select>
          </div>
        </div>

        {loading && <p className="hint">Завантажуємо звіт…</p>}
        {error && (
          <div className="note note--warn">
            <b>Не вдалося завантажити звіт</b>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Працівник</th>
                  <th>Посада · регіон</th>
                  <th className="num">Розділів</th>
                  <th className="num">Бал</th>
                  <th className="num">Спроб</th>
                  <th>Статус</th>
                  <th>Остання активність</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.user_id}>
                    <td>
                      <b>{row.full_name}</b>
                    </td>
                    <td className="comment">
                      {[row.position, row.region].filter(Boolean).join(' · ') ||
                        '—'}
                    </td>
                    <td className="num">
                      {row.sections_done} / {total}
                    </td>
                    <td className="num">
                      {row.best_score ?? '—'}
                    </td>
                    <td className="num">{row.attempts}</td>
                    <td>
                      {row.passed_at ? (
                        <span className="tag tag--green">склав</span>
                      ) : row.sections_done > 0 ? (
                        <span className="tag tag--amber">навчається</span>
                      ) : (
                        <span className="tag tag--neutral">не почав</span>
                      )}
                    </td>
                    <td className="comment">
                      {row.last_activity
                        ? new Intl.DateTimeFormat('uk-UA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(row.last_activity))
                        : '—'}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="comment">
                      Нікого не знайшли за цим запитом.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  )
}
