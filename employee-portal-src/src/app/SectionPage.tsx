import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { sections } from '@/content/portal'
import { BRAND } from '@/content/brand'
import { Blocks } from '@/components/BlockRenderer'
import { renderRich } from '@/lib/rich'

export function SectionPage() {
  const { sectionId } = useParams()
  const navigate = useNavigate()

  const index = sections.findIndex((s) => s.id === sectionId)
  const section = sections[index]

  // Новий розділ показуємо з початку, а не з місця попередньої прокрутки.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [sectionId])

  if (!section) return <Navigate to="/start" replace />

  const previous = sections[index - 1]
  const next = sections[index + 1]

  return (
    <article className="section-enter" key={section.id}>
      {section.kicker && <div className="eyebrow">{section.kicker}</div>}
      {index === 0 ? <h1>{section.title}</h1> : <h2>{section.title}</h2>}
      <div className="rule" />
      {section.lede && <p className="lede">{renderRich(section.lede)}</p>}

      <Blocks blocks={section.blocks} />

      <nav className="pager no-print" aria-label="Навігація між розділами">
        {previous ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(`/${previous.id}`)}
          >
            ← {previous.short}
          </button>
        ) : (
          <span />
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
      </nav>

      <p className="footer-note">
        ТМ «{BRAND}» · внутрішній документ, не для передачі назовні.
        Матеріали зібрані з паспортів товару, логістичних карток, чинного
        прайсу, протоколів випробувань і внутрішніх регламентів. Якщо цифра
        тут розходиться з чинним документом — правий документ; як повідомити,
        описано в розділі «Контакти й служби».
      </p>
    </article>
  )
}
