import { EQUIPMENT_DOCS } from '@/content/assets'

/**
 * Торговельне обладнання бренду.
 *
 * Джерела: «Перелік та розміри торгового обладнання» та специфікації
 * холодильників Ice Stream. Розміри — у міліметрах, як у документах.
 *
 * Тут лише габарити й призначення: наявність, умови надання та кількість
 * узгоджуються окремо, тому в даних їх немає.
 */

export type EquipmentKind = 'Полиці' | 'Стійки' | 'Підставки' | 'Холодильники'

export interface Equipment {
  id: string
  name: string
  kind: EquipmentKind
  /** Довжина (ширина фронту), мм */
  widthMm: number
  /** Глибина, мм */
  depthMm: number
  /** Висота, мм */
  heightMm: number
  /** Де працює найкраще */
  use: string
  /** Пояснення до нетипових позицій */
  note?: string
  /** Документ із повною специфікацією */
  specUrl?: string
  /** id зображення на Google Drive — рендер без фону або фото */
  photoId?: string
}

export const EQUIPMENT: Equipment[] = [
  {
    id: 'shelf-423',
    photoId: '1qn8nSG7N8jFlqw7tTGCUvwdxsmkkKhKs',
    name: 'Полиця вузька 423',
    kind: 'Полиці',
    widthMm: 311,
    depthMm: 205,
    heightMm: 1700,
    use: 'Вузькі проходи, невеликі магазини біля дому, доповнення до основної полиці',
    note: 'Номер читається так: 4 — кількість поличок, 2 — глибина, 3 — довжина. Глибину й довжину рахують у пляшках 1,5 л, які вміщаються в ряд.',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'shelf-444',
    photoId: '1wcihmQEWkm18-TdHrW8Ng-S-1cIaInRz',
    name: 'Полиця широка 444',
    kind: 'Полиці',
    widthMm: 414,
    depthMm: 401,
    heightMm: 1800,
    use: 'Магазини з ширшою водною категорією: вміщає вдвічі більший запас у глибину',
    note: 'Ті самі 4 полички, але 4 пляшки 1,5 л у глибину і 4 в довжину.',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'rack-euro',
    photoId: '1GEwdpVs5kz9PcCMG105pz9Kc6rrzrEDN',
    name: 'Стійка Єврорек ½ палети',
    kind: 'Стійки',
    widthMm: 800,
    depthMm: 600,
    heightMm: 1160,
    use: 'Проміжна викладка в залі, сезонні акції, торець гондоли',
    note: 'Займає рівно половину палетомісця — заїжджає на готову палетну зону без переставляння.',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'rack-400',
    photoId: '1695PqVNReTuTPcCcjvryXMc77gdlHVyB',
    name: 'Стійка металева 400×400',
    kind: 'Стійки',
    widthMm: 400,
    depthMm: 400,
    heightMm: 1820,
    use: 'Компактна точка додаткового продажу там, де немає місця під полицю',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'rack-cityart',
    photoId: '1ZX-Xz6taRCS4cIVgpHvyEC3CpIxVTGe9',
    name: 'Стійка металева CityArt 840×642',
    kind: 'Стійки',
    widthMm: 840,
    depthMm: 642,
    heightMm: 1033,
    use: 'Низька широка викладка: прикасова зона, зона біля входу',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'rack-p2',
    photoId: '1X4PQ-9Azy-PUwAqcVxUK6ha6alLu3vOF',
    name: 'Стійка П2',
    kind: 'Стійки',
    widthMm: 550,
    depthMm: 505,
    heightMm: 2072,
    use: 'Найвища стійка лінійки — помітна через увесь зал',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'floor-stand',
    photoId: '1gug7w_neTax1Xdz3qbKCRsA1U0qDkpq7',
    name: 'Підставка на підлогу',
    kind: 'Підставки',
    widthMm: 700,
    depthMm: 200,
    heightMm: 55,
    use: 'Піднімає нижній ряд над підлогою — під великі формати 2,0 і 7 л',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'fridge-power-250',
    photoId: '1UTLTswYc9eP_QSvfbvlwVjd2LT_0ZGRu',
    name: 'Холодильник Ice Stream Power 250',
    kind: 'Холодильники',
    widthMm: 435,
    depthMm: 500,
    heightMm: 1833,
    use: 'Найвужчий холодильник: АЗС, кіоск, прикаса, вузький простір',
    specUrl: EQUIPMENT_DOCS.list,
  },
  {
    id: 'fridge-force',
    photoId: '1KwTOUzcqCbdfzVrmtstYQc3UE9q402rZ',
    name: 'Холодильник Ice Stream Force',
    kind: 'Холодильники',
    widthMm: 455,
    depthMm: 685,
    heightMm: 2135,
    use: 'Вузький і високий: максимум об’єму на мінімумі фронту',
    specUrl: EQUIPMENT_DOCS.force,
  },
  {
    id: 'fridge-dynamic',
    photoId: '1JcZFgbH0nhv9MZqE2dNxrXvG9e2UlOsM',
    name: 'Холодильник Ice Stream Dynamic',
    kind: 'Холодильники',
    widthMm: 680,
    depthMm: 715,
    heightMm: 2145,
    use: 'Середній формат для продуктового магазину',
    specUrl: EQUIPMENT_DOCS.dynamic,
  },
  {
    id: 'fridge-leader',
    photoId: '1i5z2L7weRkZPZ0TCv4WrGWirwrqVrE7X',
    name: 'Холодильник Ice Stream Leader',
    kind: 'Холодильники',
    widthMm: 765,
    depthMm: 810,
    heightMm: 2145,
    use: 'Найбільший формат: супермаркет, великий трафік, повна лінійка на полицях',
    specUrl: EQUIPMENT_DOCS.leader,
  },
]

export const EQUIPMENT_KINDS: EquipmentKind[] = [
  'Полиці',
  'Стійки',
  'Підставки',
  'Холодильники',
]
