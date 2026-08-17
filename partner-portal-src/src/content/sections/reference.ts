import type { Section } from '@/types/content'

export const reference: Section = {
  id: 'reference',
  group: 'info',
  nav: 'Довідник',
  short: 'Довідник',
  kicker: 'Довідка',
  title: 'Довідник',
  lede: 'Штрих-коди всіх позицій і глосарій термінів. Сюди зазирають, коли треба звірити цифру.',
  blocks: [
    {
      kind: 'card',
      title: 'Штрих-коди й коди УКТЗЕД',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Коди одиниці товару й транспортної упаковки по всьому асортименту. Натисніть на рядок, щоб відкрити повну картку позиції.',
        },
        { kind: 'widget', widget: 'ean-table' },
      ],
    },
    {
      kind: 'card',
      title: 'Глосарій',
      blocks: [{ kind: 'widget', widget: 'glossary' }],
    },
  ],
}
