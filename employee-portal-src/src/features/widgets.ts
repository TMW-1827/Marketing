import type { ComponentType } from 'react'
import type { WidgetName } from '@/types/content'

import { Shelf } from '@/features/catalog/Shelf'
import { SkuCatalog } from '@/features/catalog/SkuCatalog'
import { PalletCalculator } from '@/features/calculators/PalletCalculator'
import { PriceCalculator } from '@/features/calculators/PriceCalculator'
import { ShelfLife } from '@/features/calculators/ShelfLife'
import { LoadCalculator } from '@/features/calculators/LoadCalculator'
import { EventWater } from '@/features/calculators/EventWater'
import { OrderMix } from '@/features/calculators/OrderMix'
import {
  EanTable,
  FormatTable,
  PalletTable,
  PriceTable,
} from '@/features/calculators/Tables'
import { Glossary } from '@/features/reference/Glossary'
import { Objections } from '@/features/reference/Objections'
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
  'price-table': PriceTable,
  'price-calculator': PriceCalculator,
  'order-mix': OrderMix,
  'shelf-life': ShelfLife,
  'load-calculator': LoadCalculator,
  'event-water': EventWater,
  objections: Objections,
}
