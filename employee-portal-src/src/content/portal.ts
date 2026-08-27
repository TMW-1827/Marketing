import type { Portal, Section } from '@/types/content'
import { BRAND, SLOGAN } from './brand'

import { start } from './sections/start'
import { catalog } from './sections/catalog'
import { lines } from './sections/lines'
import { water } from './sections/water'
import { source } from './sections/source'
import { equipment } from './sections/equipment'

import { prices } from './sections/prices'
import { selling } from './sections/selling'
import { compliance } from './sections/compliance'
import { clients } from './sections/clients'
import { merchandising } from './sections/merchandising'
import { visit } from './sections/visit'
import { partnership } from './sections/partnership'

import { receiving } from './sections/receiving'
import { storage } from './sections/storage'
import { picking } from './sections/picking'
import { transport } from './sections/transport'
import { returns } from './sections/returns'
import { inventory } from './sections/inventory'

import { quality } from './sections/quality'
import { reference } from './sections/reference'
import { materials } from './sections/materials'
import { safety } from './sections/safety'
import { contacts } from './sections/contacts'

/**
 * Внутрішній портал ТМ «Трускавецька».
 *
 * Аудиторія — працівники компанії: менеджери з продажу, торгові
 * представники, комірники, водії, логісти. Портал один на всіх навмисно:
 * половина конфліктів між продажами й складом виникає саме тому, що кожен
 * бачить свою половину картини. Тому калькулятор замовлення тут той самий,
 * що й калькулятор завантаження, а термін придатності рахується за тією
 * самою формулою і в полі, і на рампі.
 *
 * Порядок розділів — від продукту до процесів: спершу те, що продаємо,
 * далі як продаємо, далі як це доїжджає, і в кінці довідка. Читають його
 * не підряд, а «зі свого входу», тому головна — це розвилка.
 *
 * Правило змісту, протилежне зовнішньому порталу: тут **є** ціни, націнки,
 * внутрішні регламенти й межі повноважень. Саме тому портал внутрішній,
 * і саме тому в розділах є прямі нагадування, чого не можна показувати
 * клієнту з екрана.
 */
export const truskavetskaPortal: Portal = {
  id: 'truskavetska-employees',
  title: BRAND,
  subtitle: 'Портал для працівників',
  slogan: SLOGAN,
  sections: [
    // Продукт
    start,
    catalog,
    lines,
    water,
    source,
    equipment,
    // Продажі
    prices,
    selling,
    compliance,
    clients,
    merchandising,
    visit,
    partnership,
    // Склад і логістика
    receiving,
    storage,
    picking,
    transport,
    returns,
    inventory,
    // Довідка
    quality,
    reference,
    materials,
    safety,
    contacts,
  ],
}

export const portal = truskavetskaPortal

export const sections: Section[] = portal.sections

export function sectionById(id: string): Section | undefined {
  return sections.find((s) => s.id === id)
}
