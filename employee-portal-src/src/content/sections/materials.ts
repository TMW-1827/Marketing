import type { Section } from '@/types/content'
import { SLOGAN } from '@/content/brand'
import {
  BRAND_GUIDE,
  FONT,
  FONT_FAMILY,
  LOGO_FOLDER,
  LOGO_ID,
} from '@/content/assets'

export const materials: Section = {
  id: 'materials',
  group: 'info',
  audience: 'sales',
  nav: 'Матеріали бренду',
  short: 'Матеріали',
  kicker: 'Довідка',
  title: 'Матеріали бренду',
  lede: 'Слоган, логотип, кольори, шрифти й правила, за якими це поєднується. Звідси беруть файли для презентації клієнту, макета POS і брендування події — і звідси ж їх надсилають партнеру, коли він просить логотип.',
  blocks: [
    {
      kind: 'card',
      title: 'Слоган',
      blocks: [
        {
          kind: 'display',
          text: SLOGAN,
          tone: 'primary',
          caption:
            'Єдиний слоган бренду. Пишеться саме так — без змін формулювання, без другого слогана поруч і без власних варіацій.',
        },
      ],
    },
    {
      kind: 'card',
      title: 'Логотип',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Шість офіційних варіантів знака. За замовчуванням беруть перший — з горами, кольоровий; решта потрібні там, де він не читається: на темному фоні, у малому розмірі, у лінійці SPORT. **Файли — просто під кожним знаком**: натискання одразу завантажує. Формати ті самі, що перелічені в бренд-гайді, — нічого зайвого.',
        },
        {
          kind: 'gallery',
          items: [
            {
              src: 'brand/truskavetska-logo-mountains-crop.svg',
              alt: 'Логотип «Трускавецька»: гори з ялинами та червоний напис',
              caption:
                '**З горами, кольоровий.** Основна версія — для світлих фонів: етикетки, POS, презентації, партнерські макети.',
              files: [
                { format: 'AI', driveId: LOGO_ID.mountains.ai, size: '386 КБ' },
                { format: 'EPS', driveId: LOGO_ID.mountains.eps, size: '818 КБ' },
                { format: 'PDF', driveId: LOGO_ID.mountains.pdf, size: '371 КБ' },
                { format: 'PNG', driveId: LOGO_ID.mountains.png, size: '267 КБ' },
                { format: 'SVG', driveId: LOGO_ID.mountains.svg, size: '17 КБ' },
              ],
            },
            {
              driveId: LOGO_ID.whiteSilver.png,
              tone: 'dark',
              alt: 'Біло-срібна версія логотипа з горами',
              caption:
                '**З горами, біло-срібний.** Для кольорових, темних і фотографічних фонів.',
              files: [
                { format: 'AI', driveId: LOGO_ID.whiteSilver.ai, size: '724 КБ' },
                { format: 'EPS', driveId: LOGO_ID.whiteSilver.eps, size: '805 КБ' },
                { format: 'PDF', driveId: LOGO_ID.whiteSilver.pdf, size: '359 КБ' },
                { format: 'PNG', driveId: LOGO_ID.whiteSilver.png, size: '220 КБ' },
                { format: 'SVG', driveId: LOGO_ID.whiteSilver.svg, size: '17 КБ' },
              ],
            },
            {
              src: 'brand/truskavetska-logo-text.svg',
              alt: 'Текстовий логотип «Трускавецька», червоний',
              caption:
                '**Текстовий червоний.** Коли знак із горами в малому розмірі стає нерозбірливим: документи, монохромні макети.',
              files: [
                { format: 'AI', driveId: LOGO_ID.text.ai, size: '625 КБ' },
                { format: 'PDF', driveId: LOGO_ID.text.pdf, size: '3 КБ' },
                { format: 'SVG', driveId: LOGO_ID.text.svg, size: '5 КБ' },
                { format: 'PNG', driveId: LOGO_ID.text.png, size: '55 КБ' },
              ],
            },
            {
              driveId: LOGO_ID.textWhite.png,
              tone: 'dark',
              alt: 'Текстовий логотип «Трускавецька», білий',
              caption: '**Текстовий білий.** Той самий напис на кольоровому чи фотофоні.',
              files: [
                { format: 'AI', driveId: LOGO_ID.textWhite.ai, size: '699 КБ' },
                { format: 'PDF', driveId: LOGO_ID.textWhite.pdf, size: '331 КБ' },
                { format: 'SVG', driveId: LOGO_ID.textWhite.svg, size: '5 КБ' },
                { format: 'PNG', driveId: LOGO_ID.textWhite.png, size: '55 КБ' },
              ],
            },
            {
              src: 'brand/truskavetska-logo-sport.svg',
              alt: 'Логотип «Трускавецька SPORT», червоний',
              caption:
                '**SPORT, кольоровий.** Тільки для лінійки SPORT і спортивних проєктів — із класичним знаком не змішується.',
              files: [
                { format: 'AI', driveId: LOGO_ID.sport.ai, size: '443 КБ' },
                { format: 'SVG', driveId: LOGO_ID.sport.svg, size: '8 КБ' },
                { format: 'PDF', driveId: LOGO_ID.sport.pdf, size: '93 КБ' },
                { format: 'PNG', driveId: LOGO_ID.sport.png, size: '86 КБ' },
              ],
            },
            {
              driveId: LOGO_ID.sportWhite.png,
              tone: 'dark',
              alt: 'Логотип «Трускавецька SPORT», білий',
              caption: '**SPORT, білий.** Для темних фонів і фото з подій.',
              files: [
                { format: 'AI', driveId: LOGO_ID.sportWhite.ai, size: '442 КБ' },
                { format: 'SVG', driveId: LOGO_ID.sportWhite.svg, size: '8 КБ' },
                { format: 'PDF', driveId: LOGO_ID.sportWhite.pdf, size: '81 КБ' },
                { format: 'PNG', driveId: LOGO_ID.sportWhite.png, size: '77 КБ' },
              ],
            },
          ],
        },
        {
          kind: 'table',
          columns: [{ text: 'Формат' }, { text: 'Коли брати саме його' }],
          commentColumns: [1],
          rows: [
            [
              '**SVG**',
              'Сайт, цифровий макет, презентація — вектор, найлегший файл',
            ],
            [
              '**PDF**',
              'Друк і передача підряднику — вектор, відкривається будь-де',
            ],
            ['**EPS**', 'Друкарня, широкоформат, зовнішня реклама'],
            ['**AI**', 'Робота дизайнера з вихідником'],
            [
              '**PNG**',
              'Коли вектор не підтримується: месенджери, прості редактори, растрові шаблони',
            ],
          ],
        },
        {
          kind: 'assets',
          items: [
            {
              title: 'Тека «Логотипи»',
              href: LOGO_FOLDER,
              format: 'тека',
              note: 'Усі варіанти й формати, включно з тими, яких немає вище',
            },
            {
              title: 'Бренд-гайд логотипів та айдентики',
              href: BRAND_GUIDE,
              format: 'PDF',
              size: '11 МБ',
              note: 'Повні правила: побудова, охоронне поле, мінімальні розміри, заборонені варіанти',
            },
          ],
        },
        {
          kind: 'note',
          tone: 'warn',
          title: 'Дві заборони',
          text: 'Не змінювати кольори, пропорції та розміри логотипа. Використовувати лише офіційні файли за посиланнями вище — не перемальовувати, не витягувати з фото й не брати з інтернету.',
        },
      ],
    },
    {
      kind: 'card',
      title: 'Кольори бренду',
      blocks: [
        {
          kind: 'swatches',
          items: [
            { name: 'Pantone 300 C', hex: '#005EB8' },
            { name: 'Pantone 7724 C', hex: '#00966C' },
            { name: 'Pantone 1935 C', hex: '#C5003E' },
            {
              name: 'Pantone 877 C',
              hex: '#8A8D8F',
              css: 'linear-gradient(135deg,#B8BCBE,#8A8D8F 55%,#A5A9AB)',
            },
          ],
        },
        {
          kind: 'note',
          tone: 'info',
          title: 'Про два останні',
          text: '**1935 C** — червоний, використовується в текстовому логотипі та в лінійці SPORT. **877 C** — металізоване срібло, це фарба для друку; на екрані вона передається приблизним сірим `#8A8D8F`, металевого ефекту цифрова версія не дає.',
        },
      ],
    },
    {
      kind: 'card',
      title: 'Шрифти',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Бренд-гайд називає п’ять шрифтів у трьох ролях: пара для друкованих і дизайнерських матеріалів, пара для сайту й цифри, і окремий шрифт, яким побудований логотип.',
        },
        {
          kind: 'heading',
          text: 'Основний і додатковий',
          level: 4,
        },
        {
          kind: 'assets',
          items: [
            {
              title: 'Gilroy Bold',
              href: FONT.gilroyBold.href,
              format: FONT.gilroyBold.format,
              size: FONT.gilroyBold.size,
              note: 'Основний шрифт бренду — заголовки й акценти в макетах',
            },
            {
              title: 'Core Sans D 37 Cn Regular',
              href: FONT.coreSans.href,
              format: FONT.coreSans.format,
              size: FONT.coreSans.size,
              note: 'Додатковий — там, де Gilroy завеликий за вагою: підписи, дрібний текст',
            },
          ],
        },
        {
          kind: 'heading',
          text: 'Для сайту й цифрових матеріалів',
          level: 4,
        },
        {
          kind: 'assets',
          items: [
            {
              title: 'Sofia Sans Extra Condensed Extra Bold',
              href: FONT.sofiaSans.href,
              format: FONT.sofiaSans.format,
              size: FONT.sofiaSans.size,
              note: 'Основний для екрана. Саме ним набрані заголовки цього порталу',
            },
            {
              title: 'Montserrat Medium',
              href: FONT.montserrat.href,
              format: FONT.montserrat.format,
              size: FONT.montserrat.size,
              note: 'Додатковий для екрана — основний текст',
            },
          ],
        },
        {
          kind: 'heading',
          text: 'Шрифт логотипа',
          level: 4,
        },
        {
          kind: 'assets',
          items: [
            {
              title: 'Heading Now Trial 45 Medium',
              href: FONT.headingNow.href,
              format: FONT.headingNow.format,
              size: FONT.headingNow.size,
              note: 'Накреслення, з якого побудований логотип',
            },
          ],
        },
        {
          kind: 'note',
          tone: 'amber',
          title: 'Логотип цим шрифтом не набирають',
          text: 'У самому знаку букви **«Т»** і **«у»** доопрацьовані вручну, тому напис, набраний Heading Now, не збігається з логотипом. Потрібен логотип — беріть готовий файл вище, а не набирайте текст.',
        },
        {
          kind: 'heading',
          text: 'Повні сімейства',
          level: 4,
        },
        {
          kind: 'paragraph',
          text: 'Якщо потрібні інші накреслення — світлі, курсивні, проміжні за вагою:',
        },
        {
          kind: 'assets',
          items: [
            {
              title: 'Сімейство Gilroy',
              href: FONT_FAMILY.gilroy,
              format: 'тека',
            },
            {
              title: 'Сімейство Sofia Sans Extra Condensed',
              href: FONT_FAMILY.sofiaSans,
              format: 'тека',
            },
            {
              title: 'Сімейство Montserrat',
              href: FONT_FAMILY.montserrat,
              format: 'тека',
            },
          ],
        },
      ],
    },
    {
      kind: 'card',
      title: 'Що надаємо партнерам за запитом',
      accent: 'green',
      blocks: [
        {
          kind: 'list',
          style: 'check',
          items: [
            '**Логотипи й бренд-гайд** — за прямими посиланнями вище, без запиту',
            '**Зображення продукції** — фото пляшок для каталогів, сайтів і маркетплейсів',
            '**Паспорти товару** — габарити, вага, палетизація, штрих-коди, УКТЗЕД',
            '**POS-матеріали** для торгової точки',
            '**Тексти-описи продукту**, узгоджені за формулюваннями — щоб не переписувати самостійно',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Партнер отримує комплект не від менеджера напряму, а через маркетинг: запит із зазначенням носія — сайт, друк, зовнішня реклама, соцмережі, брендинг події — і строків. Так у партнера опиняється затверджений файл, а не той, що знайшовся в чиємусь месенджері.',
        },
      ],
    },
    {
      kind: 'card',
      title: 'Правила згадки бренду',
      blocks: [
        {
          kind: 'columns',
          blocks: [
            {
              kind: 'card',
              title: 'Можна',
              accent: 'green',
              titleTone: 'green',
              blocks: [
                {
                  kind: 'list',
                  style: 'check',
                  items: [
                    '«Вода мінеральна природна столова»',
                    '«Для щоденного вживання»',
                    '«Низька мінералізація — можна щодня без обмежень»',
                    '«Природний pH 7,8 негазованої води, лужна»',
                    '«Видобувається в охоронній зоні Карпат»',
                    '«Оздоровчий ефект підтверджено клінічними дослідженнями Українського НДІ медичної реабілітації та курортології МОЗ»',
                    `«${SLOGAN}» — як слоган бренду`,
                  ],
                },
              ],
            },
            {
              kind: 'card',
              title: 'Не можна',
              accent: 'red',
              titleTone: 'red',
              blocks: [
                {
                  kind: 'list',
                  style: 'cross',
                  items: [
                    '«Лікує» будь-що',
                    '«Показана при захворюванні…»',
                    '«Лікувальна» або «лікувально-столова»',
                    '«Замінює ліки»',
                    '«Допомагає схуднути», «омолоджує»',
                    'Будь-які показання й дозування',
                    'Називати «Особливу» 7 л мінеральною водою',
                    'Змінені логотипи, кольори й пропорції',
                  ],
                },
              ],
            },
          ],
        },
        {
          kind: 'note',
          tone: 'warn',
          title: 'Правило перевірки',
          text: 'Якщо формулювання немає ні на етикетці, ні в переліку підтверджених ефектів у розділі «Про воду» — його не існує. Сумніваєтесь у тексті макета — надішліть на погодження до публікації.',
        },
      ],
    },
  ],
}
