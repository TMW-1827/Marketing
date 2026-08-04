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

/** Один знак після коми, ціле число — без «,0». */
export function dec1(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : dec(rounded, 1)
}

/** Гривні з двома знаками. */
export function money(value: number): string {
  return dec(value, 2)
}

/** Ціле число з нерозривними пробілами між розрядами: 1 200 */
export function int(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
