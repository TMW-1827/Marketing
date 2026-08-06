import { SKUS } from '@/data/skus'
import type {
  Carbonation,
  Format,
  PriceZone,
  Sku,
  SkuView,
} from '@/types/catalog'

/** «0,5 л» → 0.5 */
export function parseVolume(volume: string): number {
  return parseFloat(volume.replace(',', '.').replace(' л', ''))
}

function categoryOf(sku: Sku): string {
  return sku.line === 'Особлива'
    ? 'Вода питна негазована оброблена'
    : 'Вода мінеральна природна столова'
}

function nameOf(sku: Sku): string {
  const prefix = sku.line === 'Особлива' ? 'Особлива ' : ''
  const suffix = sku.line === 'SPORT' ? ' SPORT' : ''
  return `${prefix}${sku.volume} ${sku.packaging}, ${sku.carbonation}${suffix}`
}

function toView(sku: Sku): SkuView {
  return {
    ...sku,
    category: categoryOf(sku),
    name: nameOf(sku),
    litres: parseVolume(sku.volume),
  }
}

/**
 * Єдиний порядок показу по всьому порталу: спершу скло, далі ПЕТ;
 * усередині — за зростанням об'єму, SPORT одразу після своєї 0,75 л,
 * «Особлива» в кінці.
 */
const CARBONATION_ORDER: Record<Carbonation, number> = {
  негазована: 0,
  слабогазована: 1,
  сильногазована: 2,
}

function orderKey(sku: SkuView): number[] {
  return [
    sku.packaging === 'Скло' ? 0 : 1,
    sku.line === 'Особлива' ? 99 : sku.litres,
    sku.line === 'SPORT' ? 1 : 0,
    CARBONATION_ORDER[sku.carbonation],
  ]
}

export function compareSkus(a: SkuView, b: SkuView): number {
  const ka = orderKey(a)
  const kb = orderKey(b)
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i]
  }
  return 0
}

/** Усі позиції у канонічному порядку. */
export const skus: SkuView[] = SKUS.map(toView).sort(compareSkus)

export function skuById(id: number): SkuView | undefined {
  return skus.find((s) => s.id === id)
}

/**
 * Формати для калькуляторів і таблиць: об'єм + тара + лінійка,
 * без поділу за газацією — палетизація й ціна всередині формату однакові.
 */
const FORMAT_SOURCES: Array<{ key: string; label: string; sourceId: number }> = [
  { key: 'g03s', label: '0,3 л скло', sourceId: 14 },
  { key: 'g075g', label: '0,75 л скло', sourceId: 16 },
  { key: 'g05', label: '0,5 л ПЕТ', sourceId: 1 },
  { key: 'g075', label: '0,75 л ПЕТ', sourceId: 4 },
  { key: 'g075s', label: '0,75 л ПЕТ · SPORT', sourceId: 7 },
  { key: 'g15', label: '1,5 л ПЕТ', sourceId: 8 },
  { key: 'g20', label: '2,0 л ПЕТ', sourceId: 11 },
  { key: 'g70', label: '7,0 л ПЕТ · Особлива', sourceId: 18 },
]

export const formats: Format[] = FORMAT_SOURCES.map(({ key, label, sourceId }) => {
  const source = skus.find((s) => s.id === sourceId)
  if (!source) {
    throw new Error(`Формат ${key}: не знайдено SKU #${sourceId}`)
  }
  const items = skus.filter(
    (s) =>
      s.volume === source.volume &&
      s.packaging === source.packaging &&
      s.line === source.line,
  )
  return {
    key,
    label,
    source,
    items,
    carbonations: items.map((s) => s.carbonation),
    litres: source.litres,
  }
})

export function formatByKey(key: string): Format | undefined {
  return formats.find((f) => f.key === key)
}

/* ---------- Розрахунки ---------- */

export interface PalletBreakdown {
  bottles: number
  cases: number
  pallets: number
  litres: number
  /** Шарів на палеті, заокруглено вгору: неповний шар займає цілий */
  layers: number
  /** Вага брутто, кг — пропорційно кількості упаковок на палеті */
  weightKg: number
  /** Повних палет */
  fullPallets: number
  /** Упаковок у неповній палеті, 0 — залишків немає */
  remainderCases: number
  /** Упаковок, яких бракує до повної палети */
  casesToFullPallet: number
  /** Упаковок у повній палеті */
  casesPerPallet: number
}

export type PalletUnit = 'bottle' | 'case' | 'pallet' | 'litre'

/** Похибка обчислень із плаваючою комою: 500 / 0,5 може дати 1000.0000000000001 */
const EPS = 1e-9

/**
 * Рахує в обидва боки: скільки б не ввели — пляшки, упаковки, палети чи
 * літри — повертає повний розклад. Вага неповної палети рахується
 * пропорційно кількості упаковок, від ваги брутто повної палети з піддоном.
 */
export function calcPallet(
  format: Format,
  quantity: number,
  unit: PalletUnit,
): PalletBreakdown {
  const { bottlesPerCase, bottlesPerPallet, weightPalletKg } = format.source
  const casesPerPallet = bottlesPerPallet / bottlesPerCase

  const qty = Math.max(0, quantity || 0)
  let bottles: number
  switch (unit) {
    case 'bottle':
      bottles = qty
      break
    case 'case':
      bottles = qty * bottlesPerCase
      break
    case 'pallet':
      bottles = qty * bottlesPerPallet
      break
    case 'litre':
      // Пів пляшки не відвантажують: округлюємо вгору до цілої пляшки,
      // тому фактичний об'єм може трохи перевищити заданий.
      bottles = Math.ceil(qty / format.litres - EPS)
      break
  }

  const cases = bottles / bottlesPerCase
  const pallets = bottles / bottlesPerPallet
  const weightKg = (cases / casesPerPallet) * weightPalletKg

  // Залишок рахуємо в цілих упаковках: неповну упаковку не відвантажують.
  const wholeCases = Math.ceil(cases - EPS)
  const remainderCases = wholeCases % casesPerPallet

  return {
    bottles,
    cases,
    // Неповний шар усе одно займає цілий шар на палеті: 5,2 → 6, 4,8 → 5
    layers: Math.ceil(cases / format.source.casesPerLayer - EPS),
    pallets,
    litres: bottles * format.litres,
    weightKg,
    fullPallets: Math.floor(wholeCases / casesPerPallet),
    remainderCases,
    casesToFullPallet: remainderCases === 0 ? 0 : casesPerPallet - remainderCases,
    casesPerPallet,
  }
}

export interface MarginBreakdown {
  /** Закупівельна ціна точки з ПДВ */
  purchase: number
  /** Рекомендована роздрібна ціна */
  rrp: number
  /** Заробіток із пляшки, грн */
  profit: number
  /** Націнка до закупівельної ціни, % */
  markupPct: number
  /** Частка заробітку в ціні продажу, % */
  marginPct: number
  /** Заробіток із повної палети, грн */
  profitPerPallet: number
}

export function calcMargin(format: Format, zone: PriceZone): MarginBreakdown {
  const { gross, rrp } = format.source.price[zone]
  const profit = rrp - gross
  return {
    purchase: gross,
    rrp,
    profit,
    markupPct: (profit / gross) * 100,
    marginPct: (profit / rrp) * 100,
    profitPerPallet: profit * format.source.bottlesPerPallet,
  }
}
