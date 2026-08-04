import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProgress } from '@/features/progress/ProgressProvider'
import { course } from '@/content/course'
import { QUIZ } from '@/data/quiz'

export function ProfilePage() {
  const { profile, session, backend, isAdmin, signOut } = useAuth()
  const { doneCount, totalCount, bestScore, passedAt, pendingSync } = useProgress()

  return (
    <article className="section-enter">
      <div className="eyebrow">Мій кабінет</div>
      <h2>Профіль</h2>
      <div className="rule" />

      <section className="card">
        <h3>Працівник</h3>
        <dl className="definitions">
          <dt>Ім’я</dt>
          <dd>{profile?.full_name ?? 'Не вказано'}</dd>
          {profile?.position && (
            <>
              <dt>Посада</dt>
              <dd>{profile.position}</dd>
            </>
          )}
          {profile?.region && (
            <>
              <dt>Регіон</dt>
              <dd>{profile.region}</dd>
            </>
          )}
          {session?.user.email && (
            <>
              <dt>Пошта</dt>
              <dd className="mono">{session.user.email}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="card">
        <h3>Прогрес курсу</h3>
        <div className="stats">
          <div className="stat">
            <div className="stat__value">
              {doneCount}
              <small> / {totalCount}</small>
            </div>
            <div className="stat__label">Розділів пройдено</div>
          </div>
          <div className="stat stat--green">
            {bestScore === null ? (
              <div className="stat__value stat__value--empty">ще не складали</div>
            ) : (
              <div className="stat__value">
                {bestScore}
                <small> / {QUIZ.length}</small>
              </div>
            )}
            <div className="stat__label">
              Найкращий результат тесту. Прохідний бал — {course.passScore}
            </div>
          </div>
          <div className="stat">
            {passedAt === null ? (
              <div className="stat__value stat__value--empty">не складено</div>
            ) : (
              <div className="stat__value">
                {new Intl.DateTimeFormat('uk-UA').format(new Date(passedAt))}
              </div>
            )}
            <div className="stat__label">Дата успішного складання</div>
          </div>
        </div>

        {pendingSync && (
          <div className="note note--amber">
            <b>Не синхронізовано</b>
            Останні зміни збережені на цьому пристрої, але ще не потрапили на
            сервер. Вони підуть автоматично, щойно з’явиться зв’язок.
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="card">
          <h3>Адміністрування</h3>
          <p>Вам доступний зведений звіт про навчання працівників.</p>
          <Link className="btn" to="/admin">
            Відкрити звіт
          </Link>
        </section>
      )}

      {backend && (
        <section className="card">
          <h3>Сеанс</h3>
          <p>
            Прогрес зберігається у вашому акаунті — можна продовжити навчання на
            іншому пристрої.
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void signOut()}
          >
            Вийти з акаунта
          </button>
        </section>
      )}

      {!backend && (
        <div className="note note--info">
          <b>Автономний режим</b>
          Бекенд не підключений, тому прогрес зберігається лише в цьому браузері.
          Після налаштування акаунтів він синхронізуватиметься між пристроями.
        </div>
      )}
    </article>
  )
}
