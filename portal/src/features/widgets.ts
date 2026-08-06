import type { ComponentType } from 'react'
import type { WidgetName } from '@/types/content'

import { Shelf } from '@/features/catalog/Shelf'
import { SkuCatalog } from '@/features/catalog/SkuCatalog'
import { PalletCalculator } from '@/features/calculators/PalletCalculator'
import { PriceCalculator } from '@/features/calculators/PriceCalculator'
import { EanTable, PalletTable, PriceTable } from '@/features/calculators/Tables'
import { Objections } from '@/features/reference/Objections'
import { Glossary } from '@/features/reference/Glossary'
import { Quiz } from '@/features/quiz/Quiz'
import { ResetProgress } from '@/features/progress/ResetProgress'

/**
 * Реєстр інтерактивних модулів.
 *
 * Контент розділів посилається на модуль лише за іменем — так дані
 * лишаються серіалізовними (їх можна тримати в JSON, у базі чи в CMS),
 * а мобільний додаток зможе підставити власні реалізації тих самих імен.
 */
export const WIDGETS: Record<WidgetName, ComponentType> = {
  shelf: Shelf,
  'sku-catalog': SkuCatalog,
  'pallet-calculator': PalletCalculator,
  'pallet-table': PalletTable,
  'price-calculator': PriceCalculator,
  'price-table': PriceTable,
  objections: Objections,
  quiz: Quiz,
  'ean-table': EanTable,
  glossary: Glossary,
  'reset-progress': ResetProgress,
}
