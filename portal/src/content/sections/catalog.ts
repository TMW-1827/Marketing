import type { Section } from '@/types/content'

export const catalog: Section = {
  id: 'catalog',
  group: 'product',
  nav: 'Каталог',
  short: 'Каталог',
  trackable: true,
  kicker: 'Розділ 5',
  title: 'Каталог продукції',
  lede: 'Формати в реальному масштабі: одна пляшка на кожен об’єм, намальована за фактичними габаритами з логістичних карток. Кружечки під нею показують, які газації є в цьому форматі. Спершу скло, далі ПЕТ.',
  blocks: [
    { kind: 'widget', widget: 'shelf' },
    { kind: 'heading', text: 'Позиції асортименту' },
    {
      kind: 'paragraph',
      text: 'Кожна газація — окрема позиція зі своїм штрих-кодом і ціною. Колір мітки: **білий** — негазована, **зелений** — слабогазована, **синій** — сильногазована.',
    },
    { kind: 'widget', widget: 'sku-catalog' },
  ],
}
