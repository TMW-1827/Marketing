/**
 * Форматування чисел в українській локалі: десятковий роздільник — кома.
 * Використовується і у веб-версії, і в мобільній обгортці, тому без Intl-
 * залежностей від локалі пристрою: результат має бути однаковий скрізь.
 */

/** Три форми множини: 1 упаковка / 2 упаковки / 5 упаковок */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.round(n)) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export const CASE_FORMS: [string, string, string] = [
  'упаковка',
  'упаковки',
  'упаковок',
]
export const BOTTLE_FORMS: [string, string, string] = [
  'пляшка',
  'пляшки',
  'пляшок',
]
export const PALLET_FORMS: [string, string, string] = [
  'палета',
  'палети',
  'палет',
]

/** Число з фіксованою кількістю знаків, кома як роздільник. */
export function dec(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',')
}

const GROUP = /\B(?=(\d{3})+(?!\d))/g
/** Нерозривний вузький пробіл — типографський роздільник розрядів */
const THIN = '\u202f'

/** Ціле число з роздільниками розрядів: 1 200 */
export function int(value: number): string {
  return Math.round(value).toString().replace(GROUP, THIN)
}

/**
 * Дробове число з роздільниками розрядів і комою: 1 204,5.
 * Нульову дробову частину не показуємо — «360», а не «360,0»:
 * інакше точні значення виглядають як результат вимірювання.
 */
export function grouped(value: number, digits = 1): string {
  const [whole, frac = ''] = value.toFixed(digits).split('.')
  const groupedWhole = whole.replace(GROUP, THIN)
  return Number(frac) === 0 ? groupedWhole : `${groupedWhole},${frac}`
}
