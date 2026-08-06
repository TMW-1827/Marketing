import type { Section } from '@/types/content'

export const test: Section = {
  id: 'test',
  group: 'check',
  nav: 'Тест',
  short: 'Тест',
  trackable: false,
  kicker: 'Перевірка знань',
  title: 'Підсумковий тест',
  lede: '20 питань за матеріалами порталу. Прохідний бал — 16 із 20 (80%). Після кожної відповіді видно правильний варіант і пояснення.',
  blocks: [{ kind: 'widget', widget: 'quiz' }],
}
