import { useMemo, useState } from 'react'
import { QUIZ } from '@/data/quiz'
import { course } from '@/content/course'
import { useProgress } from '@/features/progress/ProgressProvider'
import { Certificate } from './Certificate'

/**
 * Підсумковий тест.
 *
 * Відповідь фіксується одразу й показує пояснення — це навчальний тест,
 * а не екзамен на швидкість. Результат зараховується лише коли відповіли
 * на всі питання, і зберігається в прогресі працівника.
 */
export function Quiz() {
  const { recordAttempt, bestScore } = useProgress()
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [incomplete, setIncomplete] = useState(false)

  const answeredCount = Object.keys(answers).length
  const score = useMemo(
    () =>
      QUIZ.reduce(
        (sum, q, i) => (answers[i] === q.answer ? sum + 1 : sum),
        0,
      ),
    [answers],
  )

  const passed = score >= course.passScore

  const submit = () => {
    if (answeredCount < QUIZ.length) {
      setIncomplete(true)
      setSubmitted(false)
      return
    }
    setIncomplete(false)
    setSubmitted(true)
    void recordAttempt(score, QUIZ.length)
  }

  const restart = () => {
    setAnswers({})
    setSubmitted(false)
    setIncomplete(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {bestScore !== null && !submitted && (
        <div className="note note--info">
          <b>Ваш найкращий результат</b>
          {bestScore} із {QUIZ.length}. Тест можна перескладати скільки завгодно
          разів — зараховується найкращий бал.
        </div>
      )}

      <div className="quiz-progress" aria-hidden="true">
        <div style={{ width: `${(answeredCount / QUIZ.length) * 100}%` }} />
      </div>
      <p className="hint" style={{ marginTop: 6, marginBottom: 16 }}>
        Відповіли на {answeredCount} із {QUIZ.length}
      </p>

      {QUIZ.map((question, qi) => {
        const chosen = answers[qi]
        const answered = chosen !== undefined
        return (
          <div className="question" key={question.id}>
            <div className="question__text">
              <i>{String(qi + 1).padStart(2, '0')}</i>
              {question.question}
            </div>
            {question.options.map((option, oi) => {
              let modifier = ''
              if (answered) {
                if (oi === question.answer) modifier = ' option--right'
                else if (oi === chosen) modifier = ' option--wrong'
              }
              return (
                <button
                  type="button"
                  key={oi}
                  className={`option${modifier}`}
                  disabled={answered}
                  onClick={() =>
                    setAnswers((prev) =>
                      prev[qi] === undefined ? { ...prev, [qi]: oi } : prev,
                    )
                  }
                >
                  {option}
                </button>
              )
            })}
            {answered && (
              <div className="question__explanation">{question.explanation}</div>
            )}
          </div>
        )
      })}

      <div className="button-row">
        <button type="button" className="btn" onClick={submit}>
          Показати результат
        </button>
        <button type="button" className="btn btn--ghost" onClick={restart}>
          Пройти заново
        </button>
      </div>

      {incomplete && (
        <div className="note note--amber">
          <b>Ще не все</b>
          Відповіли на {answeredCount} із {QUIZ.length} питань. Дайте відповідь на
          всі, щоб отримати результат.
        </div>
      )}

      {submitted && (
        <>
          <div className={`note note--${passed ? 'ok' : 'warn'}`}>
            <b>{passed ? 'Тест складено' : 'Тест не складено'}</b>
            Правильних відповідей:{' '}
            <b>
              {score} із {QUIZ.length}
            </b>{' '}
            ({Math.round((score / QUIZ.length) * 100)}%). Прохідний бал —{' '}
            {course.passScore}.
            {!passed &&
              ' Перегляньте розділи, у яких помилилися, і пройдіть тест заново.'}
          </div>

          {passed && <Certificate score={score} total={QUIZ.length} />}
        </>
      )}
    </>
  )
}
