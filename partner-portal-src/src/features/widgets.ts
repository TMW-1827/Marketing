import type { ComponentType } from 'react'
import type { WidgetName } from '@/types/content'

import { Shelf } from '@/features/catalog/Shelf'
import { SkuCatalog } from '@/features/catalog/SkuCatalog'
import { PalletCalculator } from '@/features/calculators/PalletCalculator'
import { EanTable, FormatTable, PalletTable } from '@/features/calculators/Tables'
import { Glossary } from '@/features/reference/Glossary'
import { EquipmentCatalog } from '@/features/equipment/EquipmentCatalog'

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
  'format-table': FormatTable,
  'ean-table': EanTable,
  glossary: Glossary,
  'equipment-catalog': EquipmentCatalog,
}
