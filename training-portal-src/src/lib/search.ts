import { sections } from '@/content/course'
import { GLOSSARY } from '@/data/glossary'
import { skus } from '@/lib/catalog'
import { blocksToText, plainRich } from '@/lib/rich'

export type SearchHit =
  | { type: 'section'; id: string; title: string; hint: string }
  | { type: 'sku'; id: number; title: string; hint: string }
  | { type: 'glossary'; id: string; title: string; hint: string }

interface IndexEntry {
  hit: SearchHit
  haystack: string
  /** Слова, збіг з якими вважається сильним (назва, штрих-код) */
  primary: string
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "'").trim()
}

const index: IndexEntry[] = [
  ...sections.map((section) => {
    const body = blocksToText(section.blocks)
    const title = section.title
    return {
      hit: {
        type: 'section' as const,
        id: section.id,
        title,
        hint: section.lede ? plainRich(section.lede).slice(0, 90) : section.nav,
      },
      primary: norm(`${title} ${section.nav} ${section.short}`),
      haystack: norm(`${title} ${section.nav} ${section.short} ${body}`),
    }
  }),
  ...skus.map((sku) => ({
    hit: {
      type: 'sku' as const,
      id: sku.id,
      title: `«Трускавецька» ${sku.name}`,
      hint: `${sku.ean} · ${sku.bottlesPerPallet} шт. на палеті`,
    },
    primary: norm(`${sku.name} ${sku.ean} ${sku.eanCase}`),
    haystack: norm(
      `${sku.name} ${sku.volume} ${sku.packaging} ${sku.carbonation} ${sku.line} ${sku.ean} ${sku.eanCase} ${sku.uktzed} ${sku.category}`,
    ),
  })),
  ...GLOSSARY.map((entry) => ({
    hit: {
      type: 'glossary' as const,
      id: entry.term,
      title: entry.term,
      hint: entry.definition.slice(0, 90),
    },
    primary: norm(entry.term),
    haystack: norm(`${entry.term} ${entry.definition}`),
  })),
]

/**
 * Пошук по розділах, товарах і глосарію.
 * Сортування: спершу збіг у назві/штрих-коді, далі збіг у тексті.
 */
export function search(query: string, limit = 12): SearchHit[] {
  const q = norm(query)
  if (q.length < 2) return []

  const scored: Array<{ hit: SearchHit; score: number }> = []
  for (const entry of index) {
    let score = 0
    if (entry.primary.startsWith(q)) score = 100
    else if (entry.primary.includes(q)) score = 60
    else if (entry.haystack.includes(q)) score = 20
    if (score > 0) {
      // товари піднімаємо трохи вище: запит зі штрих-кодом чи об'ємом
      // майже завжди означає «покажи картку»
      if (entry.hit.type === 'sku') score += 5
      scored.push({ hit: entry.hit, score })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.hit)
}

export function totalMatches(query: string): number {
  const q = norm(query)
  if (q.length < 2) return 0
  return index.filter((e) => e.haystack.includes(q)).length
}
