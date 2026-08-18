import { Fragment, type ReactNode } from 'react'
import type { Block, Rich } from '@/types/content'

/**
 * Мінімальний інлайн-парсер: **жирний** і `моноширинний`.
 *
 * Свідомо не HTML: розмітка не потрапляє в DOM як рядок, тому немає
 * dangerouslySetInnerHTML, і той самий контент зможе розібрати нативний
 * рендерер мобільного додатка.
 */
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`)/g

export function renderRich(text: Rich): ReactNode {
  const parts = text.split(TOKEN).filter((p) => p !== '')
  // Короткий шлях лише коли розмітки немає взагалі: рядок, який цілком
  // складається з одного токена, теж дає один фрагмент — і його треба розібрати.
  if (parts.length === 1 && parts[0] === text && !text.includes('**') && !text.includes('`')) {
    return text
  }

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <b key={i}>{part.slice(2, -2)}</b>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code className="mono" key={i}>
          {part.slice(1, -1)}
        </code>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

/** Той самий рядок без розмітки — для пошуку, aria-label і експорту. */
export function plainRich(text: Rich): string {
  return text.replace(/\*\*/g, '').replace(/`/g, '')
}

/**
 * Витягує чистий текст із дерева блоків. Пошук будується автоматично:
 * додали блок у розділ — він одразу став знаходитись.
 */
export function blocksToText(blocks: Block[]): string {
  const out: string[] = []

  const walk = (list: Block[]) => {
    for (const block of list) {
      switch (block.kind) {
        case 'paragraph':
        case 'lede':
          out.push(plainRich(block.text))
          break
        case 'heading':
          out.push(block.text)
          break
        case 'display':
          out.push(block.text)
          if (block.caption) out.push(plainRich(block.caption))
          break
        case 'tags':
          out.push(block.items.map((t) => t.text).join(' '))
          break
        case 'list':
          out.push(block.items.map(plainRich).join(' '))
          break
        case 'steps':
          out.push(
            block.items
              .map((s) => `${s.title} ${plainRich(s.text)}`)
              .join(' '),
          )
          break
        case 'note':
          if (block.title) out.push(block.title)
          out.push(plainRich(block.text))
          break
        case 'stats':
          out.push(
            block.items
              .map((s) => `${s.value} ${s.unit ?? ''} ${plainRich(s.label)}`)
              .join(' '),
          )
          break
        case 'table':
          out.push(block.columns.map((c) => c.text).join(' '))
          out.push(block.rows.map((r) => r.map(plainRich).join(' ')).join(' '))
          break
        case 'definitions':
          out.push(
            block.items
              .map((d) => `${plainRich(d.term)} ${plainRich(d.value)}`)
              .join(' '),
          )
          break
        case 'code':
          out.push(block.text)
          break
        case 'swatches':
          out.push(block.items.map((s) => `${s.name} ${s.hex}`).join(' '))
          break
        case 'card':
          if (block.title) out.push(block.title)
          walk(block.blocks)
          break
        case 'columns':
          walk(block.blocks)
          break
        case 'faq':
          out.push(
            block.items
              .map((item) => `${item.q} ${plainRich(item.a)}`)
              .join(' '),
          )
          break
        case 'links':
          out.push(
            block.items
              .map((item) => `${item.title} ${plainRich(item.text)}`)
              .join(' '),
          )
          break
        case 'assets':
          out.push(
            block.items
              .map(
                (item) =>
                  `${item.title} ${item.format ?? ''} ${item.note ? plainRich(item.note) : ''}`,
              )
              .join(' '),
          )
          break
        case 'gallery':
          out.push(
            block.items
              .map(
                (item) =>
                  `${item.alt} ${item.caption ? plainRich(item.caption) : ''}`,
              )
              .join(' '),
          )
          break
        case 'contacts':
          out.push(
            block.items
              .map(
                (item) =>
                  `${item.label} ${item.value} ${item.note ? plainRich(item.note) : ''}`,
              )
              .join(' '),
          )
          break
        case 'widget':
          break
      }
    }
  }

  walk(blocks)
  return out.join(' ')
}
