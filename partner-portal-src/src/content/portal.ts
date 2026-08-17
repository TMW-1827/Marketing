import type { Portal, Section } from '@/types/content'
import { BRAND, SLOGAN } from './brand'

import { start } from './sections/start'
import { water } from './sections/water'
import { source } from './sections/source'
import { lines } from './sections/lines'
import { catalog } from './sections/catalog'
import { distributors } from './sections/distributors'
import { retail } from './sections/retail'
import { horeca } from './sections/horeca'
import { logistics } from './sections/logistics'
import { quality } from './sections/quality'
import { sponsorship } from './sections/sponsorship'
import { consumers } from './sections/consumers'
import { materials } from './sections/materials'
import { reference } from './sections/reference'
import { contacts } from './sections/contacts'

/**
 * Зовнішній портал ТМ «Трускавецька».
 *
 * Аудиторії: дистриб'ютори, торговельні мережі, заклади HoReCa, кінцеві
 * споживачі та партнери проєктів, які ми спонсоруємо. Читають його не підряд,
 * а «зі свого входу», тому головна — це розвилка, а не перший урок.
 *
 * Правило змісту: тут немає нічого, що змінюється від дати чи від
 * контрагента — ні цін, ні знижок, ні умов постачання, ні строків. Усе
 * комерційне узгоджується в договорі, а портал лишається чинним завжди.
 */
export const truskavetskaPortal: Portal = {
  id: 'truskavetska-partners',
  title: BRAND,
  subtitle: 'Портал для партнерів',
  slogan: SLOGAN,
  sections: [
    start,
    water,
    source,
    lines,
    catalog,
    distributors,
    retail,
    horeca,
    logistics,
    quality,
    sponsorship,
    consumers,
    materials,
    reference,
    contacts,
  ],
}

export const portal = truskavetskaPortal

export const sections: Section[] = portal.sections

export function sectionById(id: string): Section | undefined {
  return sections.find((s) => s.id === id)
}
