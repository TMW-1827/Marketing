/**
 * Модель товару.
 *
 * Джерела даних: паспорти товару Listex (09.07.2026), логістичні картки
 * МПП «Алекс» (16.04.26), прайс для дистриб'юторів липень 2026.
 *
 * Тут навмисно немає нічого, що залежить від DOM або React: цей модуль
 * використовується і веб-версією, і майбутнім мобільним додатком.
 */

export type Packaging = 'ПЕТ' | 'Скло'
export type Carbonation = 'негазована' | 'слабогазована' | 'сильногазована'
export type ProductLine = 'Класична' | 'SPORT' | 'Особлива'

/** Цінові зони прайсу. */
export type PriceZone = 'west' | 'east'

export interface PriceSet {
  /** Ціна дистриб'ютора без ПДВ, грн */
  net: number
  /** Ціна дистриб'ютора з ПДВ, грн */
  gross: number
  /** Рекомендована роздрібна ціна з ПДВ, грн */
  rrp: number
}

export interface Sku {
  id: number
  /** Об'єм у форматі прайсу, напр. «0,5 л» */
  volume: string
  packaging: Packaging
  carbonation: Carbonation
  line: ProductLine
  /** Штрих-код одиниці товару */
  ean: string
  /** Штрих-код транспортної упаковки */
  eanCase: string
  /** Пляшок в упаковці */
  bottlesPerCase: number
  /** Упаковок у шарі палети */
  casesPerLayer: number
  /** Шарів на палеті */
  layersPerPallet: number
  /** Пляшок на палеті */
  bottlesPerPallet: number
  /** Вага одиниці, кг */
  weightBottleKg: number
  /** Вага упаковки, кг */
  weightCaseKg: number
  /** Вага повної палети брутто з піддоном, кг */
  weightPalletKg: number
  /** Ширина пляшки, см */
  bottleWidthCm: number
  /** Висота пляшки, см */
  bottleHeightCm: number
  /** Термін придатності, місяців */
  shelfLifeMonths: number
  uktzed: string
  price: Record<PriceZone, PriceSet>
  /** Пояснення до нетипових позицій */
  note?: string
}

/** Похідні поля, які раніше дописувались у масив на льоту. */
export interface SkuView extends Sku {
  /** Категорія продукту за документами */
  category: string
  /** Повна назва позиції для списків і пошуку */
  name: string
  /** Літрів у пляшці */
  litres: number
}

/**
 * Формат = об'єм + тара + лінійка. Усередині формату палетизація й ціна
 * однакові для всіх газацій, тому калькулятори працюють саме з форматами.
 */
export interface Format {
  key: string
  label: string
  /** SKU, з якого взяті логістичні та цінові дані формату */
  source: SkuView
  /** Усі позиції формату (по одній на газацію) */
  items: SkuView[]
  carbonations: Carbonation[]
  litres: number
}

export const PRICE_ZONE_LABEL: Record<PriceZone, string> = {
  west: 'Захід, Київ',
  east: 'Центр, Схід, Південь',
}

export const CARBONATION_SHORT: Record<Carbonation, string> = {
  негазована: 'н',
  слабогазована: 'сл',
  сильногазована: 'сил',
}

/** Кольорове кодування газації, спільне для полиці, карток і фільтрів. */
export const CARBONATION_FILL: Record<Carbonation, string> = {
  негазована: '#FFFFFF',
  слабогазована: '#00966C',
  сильногазована: '#005EB8',
}

export const CARBONATION_STROKE: Record<Carbonation, string> = {
  негазована: '#9DB1C4',
  слабогазована: '#00734F',
  сильногазована: '#003C77',
}
