/**
 * Модель товару зовнішнього порталу.
 *
 * Джерела даних: паспорти товару та логістичні картки бренду.
 *
 * Свідомо без комерційної частини: у зовнішньому порталі немає ні цін, ні
 * знижок, ні умов постачання — усе це змінюється й узгоджується в договорі.
 * Тут лише характеристики, які не залежать від дати й від контрагента.
 *
 * Тут навмисно немає нічого, що залежить від DOM або React: цей модуль
 * використовується і веб-версією, і майбутнім мобільним додатком.
 */

export type Packaging = 'ПЕТ' | 'Скло'
export type Carbonation = 'негазована' | 'слабогазована' | 'сильногазована'
export type ProductLine = 'Класична' | 'SPORT' | 'Особлива'

export interface Sku {
  id: number
  /** Об'єм у канонічному записі, напр. «0,5 л» */
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
 * Формат = об'єм + тара + лінійка. Усередині формату палетизація однакова
 * для всіх газацій, тому калькулятор працює саме з форматами.
 */
export interface Format {
  key: string
  label: string
  /** SKU, з якого взяті логістичні дані формату */
  source: SkuView
  /** Усі позиції формату (по одній на газацію) */
  items: SkuView[]
  carbonations: Carbonation[]
  litres: number
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
