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
 * Формати для калькулятора й таблиць: об'єм + тара + лінійка,
 * без поділу за газацією — палетизація всередині формату однакова.
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

/* ---------- Гроші ---------- */

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

/**
 * Скільки заробляє точка, якщо тримає рекомендовану ціну.
 *
 * Націнка й маржа — різні числа, і плутають їх постійно: націнка рахується
 * від закупівлі, маржа — від ціни продажу. Тому повертаємо обидві.
 */
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

/* ---------- Змішане замовлення ---------- */

/** Рядок замовлення: формат і кількість палет (можна дробову). */
export interface OrderLine {
  formatKey: string
  pallets: number
}

export interface OrderTotals {
  pallets: number
  /** Палетомісць у кузові — неповна палета займає ціле місце */
  places: number
  cases: number
  bottles: number
  litres: number
  weightKg: number
  /** Сума закупівлі без ПДВ, грн */
  net: number
  /** Сума закупівлі з ПДВ, грн */
  gross: number
}

/**
 * Підсумок змішаного замовлення.
 *
 * Ключове число тут — не палети, а **палетомісця**: 0,4 палети води займає
 * в кузові стільки ж підлоги, скільки повна. Саме через цю різницю
 * замовлення «на дві палети» несподівано не влазить у машину.
 */
export function sumOrder(
  lines: OrderLine[],
  zone: PriceZone,
  formatsList: Format[] = formats,
): OrderTotals {
  const totals: OrderTotals = {
    pallets: 0,
    places: 0,
    cases: 0,
    bottles: 0,
    litres: 0,
    weightKg: 0,
    net: 0,
    gross: 0,
  }

  for (const line of lines) {
    const format = formatsList.find((f) => f.key === line.formatKey)
    if (!format || line.pallets <= 0) continue

    const breakdown = calcPallet(format, line.pallets, 'pallet')
    const price = format.source.price[zone]

    totals.pallets += line.pallets
    totals.places += Math.ceil(line.pallets - EPS)
    totals.cases += breakdown.cases
    totals.bottles += breakdown.bottles
    totals.litres += breakdown.litres
    totals.weightKg += breakdown.weightKg
    totals.net += breakdown.bottles * price.net
    totals.gross += breakdown.bottles * price.gross
  }

  return totals
}

/* ---------- Термін придатності ---------- */

export interface ShelfLifeCheck {
  /** Дата, до якої продукція придатна */
  useBy: Date
  /** Скільки днів минуло від розливу */
  daysPassed: number
  /** Скільки днів лишилось; від'ємне — термін вийшов */
  daysLeft: number
  /** Частка залишкового терміну, 0…1 */
  freshness: number
  expired: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Залишковий термін придатності партії.
 *
 * Дата закінчення рахується від дати розливу в місяцях, а не в днях:
 * саме так її наносять на етикетку. Кінець місяця з коротшою кількістю
 * днів зсуваємо на останній день (31 серпня + 6 місяців = 28/29 лютого),
 * інакше 31-ше число «перестрибувало» б на початок наступного місяця.
 */
export function checkShelfLife(
  bottledAt: Date,
  shelfLifeMonths: number,
  today: Date = new Date(),
): ShelfLifeCheck {
  const useBy = new Date(bottledAt.getTime())
  const day = useBy.getDate()
  useBy.setDate(1)
  useBy.setMonth(useBy.getMonth() + shelfLifeMonths)
  const lastDay = new Date(useBy.getFullYear(), useBy.getMonth() + 1, 0).getDate()
  useBy.setDate(Math.min(day, lastDay))

  const total = Math.round((useBy.getTime() - bottledAt.getTime()) / DAY_MS)
  const daysPassed = Math.round((today.getTime() - bottledAt.getTime()) / DAY_MS)
  const daysLeft = total - daysPassed

  return {
    useBy,
    daysPassed,
    daysLeft,
    freshness: total > 0 ? Math.max(0, Math.min(1, daysLeft / total)) : 0,
    expired: daysLeft < 0,
  }
}
