import { useState } from 'react'
import { OBJECTIONS } from '@/data/objections'

/**
 * Заперечення — акордеон, а не суцільна стіна тексту: у полі працівник
 * шукає одну конкретну відповідь, а не читає всі дванадцять поспіль.
 */
export function Objections() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="accordion">
      {OBJECTIONS.map((item) => {
        const expanded = open === item.id
        return (
          <div className="accordion__item" key={item.id}>
            <button
              type="button"
              className="accordion__head"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : item.id)}
            >
              <span>{item.claim}</span>
              <span className="accordion__chevron" aria-hidden="true">
                {expanded ? '−' : '+'}
              </span>
            </button>
            {expanded && <div className="accordion__body">{item.response}</div>}
          </div>
        )
      })}
    </div>
  )
}
