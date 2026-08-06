import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { sections } from '@/content/course'
import { Blocks } from '@/components/BlockRenderer'
import { renderRich } from '@/lib/rich'
import { useProgress } from '@/features/progress/ProgressProvider'

export function SectionPage() {
  const { sectionId } = useParams()
  const navigate = useNavigate()
  const { isDone, toggleSection } = useProgress()

  const index = sections.findIndex((s) => s.id === sectionId)
  const section = sections[index]

  // Новий розділ показуємо з початку, а не з місця попередньої прокрутки.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [sectionId])

  if (!section) return <Navigate to="/start" replace />

  const next = sections[index + 1]
  const done = isDone(section.id)

  return (
    <article className="section-enter" key={section.id}>
      {section.kicker && <div className="eyebrow">{section.kicker}</div>}
      {index === 0 ? <h1>{section.title}</h1> : <h2>{section.title}</h2>}
      <div className="rule" />
      {section.lede && <p className="lede">{renderRich(section.lede)}</p>}

      <Blocks blocks={section.blocks} />

      <div className="donebar no-print">
        {section.trackable ? (
          <>
            <p>
              {done
                ? 'Розділ позначено як пройдений.'
                : 'Прочитали розділ? Позначте його — прогрес збережеться у вашому акаунті.'}
            </p>
            <button
              type="button"
              className={`btn${done ? ' btn--ghost' : ' btn--green'}`}
              onClick={() => toggleSection(section.id, !done)}
            >
              {done ? 'Зняти позначку' : 'Позначити пройденим'}
            </button>
          </>
        ) : (
          <p>Цей розділ не входить у лічильник прогресу.</p>
        )}

        {next && (
          <button
            type="button"
            className="btn"
            onClick={() => navigate(`/${next.id}`)}
          >
            Далі: {next.short} →
          </button>
        )}
      </div>

      <p className="footer-note">
        Матеріали для внутрішнього використання. Джерела: паспорти товару,
        логістичні картки, прайс для дистриб’юторів липень 2026, бренд-гайд 2025,
        протоколи клінічних досліджень.
      </p>
    </article>
  )
}
