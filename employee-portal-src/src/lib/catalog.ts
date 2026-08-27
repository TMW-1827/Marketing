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
  /** Закупівельна ціна в обраній базі */
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
 * База, від якої рахують закупівлю: з ПДВ чи без.
 *
 * Платник ПДВ рахує від ціни без ПДВ — податок він відносить у кредит.
 * Неплатник (а це більшість малих точок) платить усю суму й рахує від
 * ціни з ПДВ. Одна й та сама пляшка дає їм різну націнку, тому база —
 * не деталь, а перше, що треба з'ясувати в розмові про гроші.
 */
export type PriceBase = 'gross' | 'net'

export const PRICE_BASE_LABEL: Record<PriceBase, string> = {
  gross: 'з ПДВ',
  net: 'без ПДВ',
}

/**
 * Скільки заробляє точка, якщо тримає рекомендовану ціну.
 *
 * Націнка й маржа — різні числа, і плутають їх постійно: націнка рахується
 * від закупівлі, маржа — від ціни продажу. Тому повертаємо обидві.
 *
 * РРЦ завжди з ПДВ — це ціна на полиці. Тому при базі «без ПДВ» націнка
 * виходить вищою: у ній сидить іще й сам податок, а не тільки заробіток
 * точки. Саме на цьому місці розмова з клієнтом найчастіше й розходиться.
 */
export function calcMargin(
  format: Format,
  zone: PriceZone,
  base: PriceBase = 'gross',
): MarginBreakdown {
  const price = format.source.price[zone]
  const purchase = price[base]
  const profit = price.rrp - purchase
  return {
    purchase,
    rrp: price.rrp,
    profit,
    markupPct: (profit / purchase) * 100,
    marginPct: (profit / price.rrp) * 100,
    profitPerPallet: profit * format.source.bottlesPerPallet,
  }
}

/* ---------- Збірне замовлення ---------- */

/** У чому вказана кількість у рядку замовлення. */
export type OrderUnit = 'pallet' | 'case'

export const ORDER_UNIT_LABEL: Record<OrderUnit, string> = {
  pallet: 'палет',
  case: 'упаковок',
}

/**
 * Рядок замовлення.
 *
 * Позиція, а не формат: у замовленні негазована й сильногазована 0,5 л —
 * це два різні рядки з різними штрих-кодами, і склад збирає саме їх.
 * Формат тут не годиться — за ним не видно, що саме класти на палету.
 */
export interface OrderLine {
  skuId: number
  qty: number
  unit: OrderUnit
  /** Кому їде рядок. Машина одна, клієнтів у ній кілька. */
  client: string
}

/** Порахований рядок — те, що показується поруч із полями введення. */
export interface OrderLineView {
  bottles: number
  cases: number
  pallets: number
  weightKg: number
  net: number
  gross: number
}

export interface OrderTotals {
  bottles: number
  cases: number
  pallets: number
  /** Палетомісць у кузові */
  places: number
  litres: number
  weightKg: number
  /** Сума закупівлі без ПДВ, грн */
  net: number
  /** Сума закупівлі з ПДВ, грн */
  gross: number
}

export interface ClientTotals extends OrderTotals {
  client: string
  /** Скільки різних позицій у замовленні цього клієнта */
  positions: number
}

export interface OrderSummary {
  /** Розклад по клієнтах — у порядку появи в замовленні */
  clients: ClientTotals[]
  total: OrderTotals
}

const emptyTotals = (): OrderTotals => ({
  bottles: 0,
  cases: 0,
  pallets: 0,
  places: 0,
  litres: 0,
  weightKg: 0,
  net: 0,
  gross: 0,
})

/** Скільки пляшок дає рядок. */
export function lineBottles(sku: SkuView, qty: number, unit: OrderUnit): number {
  const n = Math.max(0, qty || 0)
  return unit === 'pallet' ? n * sku.bottlesPerPallet : n * sku.bottlesPerCase
}

/** Повний розклад одного рядка. */
export function viewLine(
  sku: SkuView,
  qty: number,
  unit: OrderUnit,
  zone: PriceZone,
): OrderLineView {
  const bottles = lineBottles(sku, qty, unit)
  const cases = bottles / sku.bottlesPerCase
  const casesPerPallet = sku.bottlesPerPallet / sku.bottlesPerCase
  const price = sku.price[zone]

  return {
    bottles,
    cases,
    pallets: bottles / sku.bottlesPerPallet,
    weightKg: (cases / casesPerPallet) * sku.weightPalletKg,
    net: bottles * price.net,
    gross: bottles * price.gross,
  }
}

/**
 * Підсумок збірного замовлення — по клієнтах і загалом.
 *
 * Машина возить не одного клієнта: у кузові кілька замовлень одразу. Тому
 * палетомісця рахуються **по клієнтах**, а не по рядках і не з загальної
 * суми палет: позиції одного клієнта можна скласти на спільну мікс-палету,
 * позиції двох клієнтів — ні, їх на прийманні доведеться розбирати.
 *
 * Через це в замовленні на 2,4 палети трьох клієнтів займе не три місця,
 * а стільки, скільки вийде після округлення в кожного окремо. Саме тут
 * найчастіше й не сходиться те, що порахували продажі, з тим, що поставив
 * у машину склад.
 */
export function summarizeOrder(
  lines: OrderLine[],
  zone: PriceZone,
  catalog: SkuView[] = skus,
): OrderSummary {
  const byClient = new Map<string, ClientTotals>()

  for (const line of lines) {
    const sku = catalog.find((s) => s.id === line.skuId)
    if (!sku || line.qty <= 0) continue

    const view = viewLine(sku, line.qty, line.unit, zone)
    const key = line.client.trim() || 'Без клієнта'

    let acc = byClient.get(key)
    if (!acc) {
      acc = { ...emptyTotals(), client: key, positions: 0 }
      byClient.set(key, acc)
    }

    acc.positions += 1
    acc.bottles += view.bottles
    acc.cases += view.cases
    acc.pallets += view.pallets
    acc.litres += view.bottles * sku.litres
    acc.weightKg += view.weightKg
    acc.net += view.net
    acc.gross += view.gross
  }

  const clients = [...byClient.values()]
  for (const client of clients) {
    // Палети клієнта складаються на його власні місця; чужий товар до них
    // не домішують, тому неповна палета клієнта займає ціле місце.
    client.places = Math.ceil(client.pallets - EPS)
  }

  const total = clients.reduce((sum, client) => {
    sum.bottles += client.bottles
    sum.cases += client.cases
    sum.pallets += client.pallets
    sum.places += client.places
    sum.litres += client.litres
    sum.weightKg += client.weightKg
    sum.net += client.net
    sum.gross += client.gross
    return sum
  }, emptyTotals())

  return { clients, total }
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
 *
 * Останній придатний день — на добу раніше за ту саму дату: розлив
 * 15.01.2026 плюс 12 місяців дає придатність **до 14.01.2027**, а не до
 * 15-го. Дванадцять місяців зберігання закінчуються напередодні річниці
 * розливу, і саме цю дату друкують на пляшці.
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
  useBy.setDate(useBy.getDate() - 1)

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
