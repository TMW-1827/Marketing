/**
 * Модель контенту зовнішнього порталу.
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
  | 'format-table'
  | 'ean-table'
  | 'glossary'
  | 'equipment-catalog'

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
  /** Питання-відповіді: розкривні блоки для споживачів і партнерів */
  | { kind: 'faq'; items: Array<{ q: string; a: Rich }> }
  /**
   * Плитка переходів на інші розділи. Зовнішній портал читають не підряд,
   * а «зі свого входу»: дистриб'ютор, мережа, споживач, спонсорський партнер.
   */
  | {
      kind: 'links'
      items: Array<{ to: string; title: string; text: Rich; tone?: 'blue' | 'green' | 'red' }>
    }
  /**
   * Файли для завантаження чи перегляду. Самі файли живуть на Google Drive:
   * портал на них лише посилається, тому оновлення файлу не потребує
   * перезбірки, а важкі макети не потрапляють у бандл.
   */
  | {
      kind: 'assets'
      items: Array<{
        title: string
        href: string
        /** SVG, PDF, EPS, AI, PNG — або «тека» для каталогу файлів */
        format?: string
        size?: string
        note?: Rich
      }>
    }
  /**
   * Прев'ю зображень. `src` — файл із бандла, `driveId` — файл на Drive.
   * `tone: 'dark'` дає темну підкладку: без неї білі версії логотипа на
   * білій картці не видно взагалі.
   */
  | {
      kind: 'gallery'
      items: Array<{
        src?: string
        driveId?: string
        alt: string
        caption?: Rich
        tone?: 'light' | 'dark'
      }>
    }
  /** Контакти з клікабельними адресами: пошта, телефон, сайт */
  | {
      kind: 'contacts'
      items: Array<{ label: string; value: string; href?: string; note?: Rich }>
    }
  | { kind: 'widget'; widget: WidgetName }

/** Групи розділів у навігації. */
export type SectionGroup = 'water' | 'cooperation' | 'partnership' | 'info'

export interface Section {
  id: string
  group: SectionGroup
  /** Підпис у меню */
  nav: string
  /** Короткий підпис для вузьких екранів і нижньої навігації */
  short: string
  /** Надзаголовок над заголовком розділу */
  kicker?: string
  title: string
  lede?: Rich
  blocks: Block[]
}

export interface Portal {
  id: string
  title: string
  subtitle: string
  slogan: string
  sections: Section[]
}

export const GROUP_LABEL: Record<SectionGroup, string> = {
  water: 'Вода',
  cooperation: 'Співпраця',
  partnership: 'Спонсорство',
  info: 'Довідка',
}

export const GROUP_ORDER: SectionGroup[] = [
  'water',
  'cooperation',
  'partnership',
  'info',
]
