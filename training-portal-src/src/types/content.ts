/**
 * Модель контенту курсу.
 *
 * Розділи описані структурованими блоками, а не HTML-рядками. Причини:
 *  1) мобільний додаток зможе рендерити ті самі дані власними компонентами;
 *  2) пошук будується автоматично — з блоків витягується чистий текст;
 *  3) контент можна перенести в CMS або в базу без переписування коду.
 */

/**
 * Рядок з обмеженою інлайн-розміткою:
 *   **жирний**   → напівжирний
 *   `моноширинний`
 * Свідомо мінімальний набір — усе, що складніше, має бути окремим блоком.
 */
export type Rich = string

export type NoteTone = 'ok' | 'warn' | 'info' | 'amber'
export type ListStyle = 'dot' | 'green' | 'check' | 'cross'
export type TagTone = 'blue' | 'green' | 'amber' | 'red' | 'neutral'

export interface TagRef {
  text: string
  tone: TagTone
}

/** Інтерактивні модулі, які вбудовуються в розділ. */
export type WidgetName =
  | 'shelf'
  | 'sku-catalog'
  | 'pallet-calculator'
  | 'pallet-table'
  | 'price-calculator'
  | 'price-table'
  | 'objections'
  | 'quiz'
  | 'ean-table'
  | 'glossary'
  | 'reset-progress'

export type Block =
  | { kind: 'paragraph'; text: Rich }
  | { kind: 'lede'; text: Rich }
  | { kind: 'heading'; text: string; level?: 3 | 4 }
  /** Великий акцентний текст — слогани */
  | { kind: 'display'; text: string; tone?: 'primary' | 'muted'; caption?: Rich }
  | { kind: 'tags'; items: TagRef[] }
  | { kind: 'list'; style?: ListStyle; items: Rich[] }
  | { kind: 'steps'; items: Array<{ title: string; text: Rich }> }
  | {
      kind: 'note'
      tone: NoteTone
      title?: string
      text: Rich
    }
  | {
      kind: 'stats'
      items: Array<{
        value: string
        unit?: string
        label: Rich
        tone?: 'blue' | 'green'
      }>
    }
  | {
      kind: 'table'
      /** Двоярусна шапка для прайсу */
      superHeader?: Array<{ text: string; span: number; align?: 'center' }>
      columns: Array<{ text: string; numeric?: boolean; width?: string }>
      rows: Array<Array<Rich>>
      /** Колонки, які треба показувати як «пояснення» — дрібнішим кеглем */
      commentColumns?: number[]
    }
  | {
      kind: 'definitions'
      /** Ширша перша колонка для глосарію */
      wide?: boolean
      items: Array<{ term: Rich; value: Rich; mono?: boolean }>
    }
  | { kind: 'code'; text: string }
  | {
      kind: 'swatches'
      items: Array<{ name: string; hex: string; css?: string }>
    }
  /** Картка-контейнер: заголовок + вкладені блоки */
  | {
      kind: 'card'
      title?: string
      accent?: 'blue' | 'green' | 'red'
      titleTone?: 'green' | 'red'
      blocks: Block[]
    }
  /** Дві колонки на десктопі, одна на телефоні */
  | { kind: 'columns'; blocks: Block[] }
  | { kind: 'widget'; widget: WidgetName }

/** Групи розділів у навігації. */
export type SectionGroup = 'brand' | 'product' | 'sales' | 'check'

export interface Section {
  id: string
  group: SectionGroup
  /** Підпис у меню */
  nav: string
  /** Короткий підпис для вузьких екранів і нижньої навігації */
  short: string
  /** Чи входить розділ у лічильник прогресу */
  trackable: boolean
  /** Надзаголовок: «Розділ 3», «Перевірка знань» */
  kicker?: string
  title: string
  lede?: Rich
  blocks: Block[]
}

export interface Course {
  id: string
  title: string
  subtitle: string
  /** Прохідний бал підсумкового тесту */
  passScore: number
  sections: Section[]
}

export const GROUP_LABEL: Record<SectionGroup, string> = {
  brand: 'Бренд',
  product: 'Продукт',
  sales: 'Продаж',
  check: 'Перевірка',
}

export const GROUP_ORDER: SectionGroup[] = ['brand', 'product', 'sales', 'check']
