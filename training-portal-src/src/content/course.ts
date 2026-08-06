import type { Course, Section } from '@/types/content'
import { PASS_SCORE } from '@/data/quiz'

import { start } from './sections/start'
import { brand } from './sections/brand'
import { origin } from './sections/origin'
import { history } from './sections/history'
import { science } from './sections/science'
import { catalog } from './sections/catalog'
import { lines } from './sections/lines'
import { logistics } from './sections/logistics'
import { prices } from './sections/prices'
import { selling } from './sections/selling'
import { merch } from './sections/merch'
import { compliance } from './sections/compliance'
import { test } from './sections/test'
import { reference } from './sections/reference'

/**
 * Курс «Все про воду Трускавецька».
 *
 * Структура навмисно «курс → розділи → тест»: щоб додати другий курс,
 * достатньо створити такий самий об'єкт і зареєструвати його в COURSES.
 */
export const truskavetskaCourse: Course = {
  id: 'truskavetska-basics',
  title: 'Все про воду «Трускавецька»',
  subtitle: 'Навчальний портал для працівників',
  passScore: PASS_SCORE,
  sections: [
    start,
    brand,
    origin,
    history,
    science,
    catalog,
    lines,
    logistics,
    prices,
    selling,
    merch,
    compliance,
    test,
    reference,
  ],
}

export const COURSES: Course[] = [truskavetskaCourse]

/** Поточний курс. Коли курсів стане більше — вибір переїде в роутер. */
export const course = truskavetskaCourse

export const sections: Section[] = course.sections

export function sectionById(id: string): Section | undefined {
  return sections.find((s) => s.id === id)
}

/** Розділи, які входять у лічильник прогресу. */
export const trackableSectionIds: string[] = sections
  .filter((s) => s.trackable)
  .map((s) => s.id)
