/**
 * Зовнішні матеріали бренду на Google Drive.
 *
 * Портал на них лише посилається, а не носить у собі: макети, специфікації
 * та фотоархіви важать десятки мегабайт, і оновлюються вони окремо від
 * порталу. Ідентифікатори зібрані тут, щоб замінити файл можна було в
 * одному місці, не шукаючи посилання по розділах.
 *
 * Доступ до файлів визначається налаштуваннями доступу на самому Drive.
 */

const file = (id: string) => `https://drive.google.com/file/d/${id}/view`
const folder = (id: string) => `https://drive.google.com/drive/folders/${id}`
const download = (id: string) =>
  `https://drive.google.com/uc?export=download&id=${id}`

/**
 * Логотипи: сирі ідентифікатори файлів, згруповані за варіантом знака.
 *
 * Набір форматів у кожного варіанта — рівно той, що перелічений у бренд-гайді
 * 2025, і не ширший. У теці на Drive лежить більше файлів (квадрати для
 * соцмереж, англомовна версія, EPS текстових версій), але офіційним переліком
 * вони не позначені, тому на порталі їх немає: партнер має брати те, що
 * затверджене, а не те, що знайшлося поруч.
 *
 * Саме ідентифікатори, а не готові посилання: картка формату під знаком
 * робить із них адресу завантаження, а перелік — адресу перегляду.
 */
export const LOGO_ID = {
  /** Основний варіант: гори + напис, кольоровий. Бренд-гайд: AI, EPS, PDF, PNG, SVG */
  mountains: {
    ai: '1e_ceSv32hFJKrk_WO5mzGcTDUO_2bTiO',
    eps: '1xQ7DZnv1f9xS6L1-IXWrRMZQWDSaJsng',
    pdf: '16grwVWfo-79DQmrlwQLsCHMLnrJxCQtr',
    png: '1rcBTIDISuAu94xCfv3Up0J_I8MNpJIuU',
    svg: '1ZV7j9wX4G3oiy3Ynt9KswfDvgAeQaNH3',
  },
  /** Додатковий варіант: той самий знак біло-сірий. Бренд-гайд: AI, EPS, PDF, PNG, SVG */
  whiteSilver: {
    ai: '1Uw0_BB2A1GxxAljM6WAGU7tZ692qm7X0',
    eps: '1JAuaGdWLjxqJnlkg1ftLdw1TJQaFMrgr',
    pdf: '1D4EXkeO-XhlJO0FjpruRF7YEN9DN963B',
    png: '1HW7kahVY3TSaDHL-EpBSP3f4mWrzsIzz',
    svg: '1CmfOPXFaf2_n2--1GOexsgwgTA0CVDOf',
  },
  /** Текстова версія, червона. Бренд-гайд: AI, PDF, SVG, PNG */
  text: {
    ai: '1bSX7hFhpWAXl2fXOEfOy9a5xOiygbkvu',
    pdf: '10Bw18QT1uuJyQ4ezzMV2b6QYJL9RAlcp',
    svg: '10G6rqLyEHv2H5t_du5CF8ociajH4c2Jt',
    png: '1SyA9SMjHxPWGQwroqBwnuKkv8YcOVBEP',
  },
  /** Текстова версія, біла */
  textWhite: {
    ai: '1DdBx7Qb7qjGnVIRX8VnxFL6z6ofiZtLv',
    pdf: '1hIyxW6ldStsS47BKs_coL_LzyqAhjK9f',
    svg: '1850Vlq6AH3DFcx0zeY5_knu96-3zsMyl',
    png: '1lXb3d4kuIzmBIU7yNvRWWHg_auXyb9dG',
  },
  /** «Трускавецька SPORT», червоний. Бренд-гайд: AI, SVG, PDF, PNG */
  sport: {
    ai: '1xbKJuOe_mP8qMsmgU0F9sal_nXfZuDEy',
    svg: '1t_5_h5Afz7o0zgDlPp4JE4MVQND2GIOC',
    pdf: '1mvDrkpokeg5Q3RCavB9gpDFNct0enH1R',
    png: '1DLGaF5xZngWG701kkL1tCK8sOhhTWqS1',
  },
  /** «Трускавецька SPORT», білий */
  sportWhite: {
    ai: '1WAN3aSYhXQCZDMk0dOpE_Te-kziFBGVu',
    svg: '1fGfns9_9NDPNwT4vogeaYNbXc-vy2_fk',
    pdf: '1diRG4p7Zl36NUAucXhokC7gbcTY30TDh',
    png: '1RpQl79ac6Vy0ks8klLHqVCzv3TfllCyQ',
  },
} as const

/**
 * Шрифти бренду — ті п'ять, що названі в бренд-гайді.
 *
 * Посилання ведуть на пряме завантаження: шрифт треба поставити в систему,
 * а не роздивлятися на сторінці Drive.
 */
export const FONT = {
  gilroyBold: {
    href: download('1r2bIQO1AsT1KKrQ6Ah6oWaProAxA3OFx'),
    format: 'TTF',
    size: '79 КБ',
  },
  coreSans: {
    href: download('1NmvXYsezIWZmq0shJxoiQUsDt7nO5ca8'),
    format: 'OTF',
    size: '58 КБ',
  },
  headingNow: {
    href: download('1sosVGpHMAS3rE2ZDUN8RXkhA36ENoeI8'),
    format: 'TTF',
    size: '217 КБ',
  },
  sofiaSans: {
    href: download('1kA8TYBDtb17qQqPK-2-StHZFbqTK7IiB'),
    format: 'TTF',
    size: '155 КБ',
  },
  montserrat: {
    href: download('1Y4g8CyyIIg8Lt8Ys0uAWB1xVQtr-D0XY'),
    format: 'TTF',
    size: '323 КБ',
  },
} as const

/** Теки з повними сімействами шрифтів — усі накреслення, не лише робоче. */
export const FONT_FAMILY = {
  gilroy: folder('1fPUDNbLxEsXp26EDTvfsOH9QEQTmPeOO'),
  sofiaSans: folder('11xiidY-h4_FTTPWgl8CcIT8qY1g2x7tY'),
  montserrat: folder('1xqGdDScaKGlTbwhghiT_yzEZ8eN-YvIO'),
} as const

/** Тека з усіма варіантами логотипа. */
export const LOGO_FOLDER = folder('1xrwXxj2pVks-g_eNL9gNt2sGs9-RQSYL')

/** Бренд-гайд логотипів та айдентики. */
export const BRAND_GUIDE = file('190DRTYKln--SEacHfjf3AZILi15p7Vbz')

/** Теки з фото, відео та документами. */
export const MEDIA = {
  newPlant: folder('1byhnzsGK31w_O5-rGk6dbpKNcOQ8Tecm'),
  history: folder('1qpcr_gMmh2etfwFuNk0a0YuKwm8RLpky'),
  permits: folder('1KYgOf9pgY4Ch8IDeWw_833wShNxtpy-V'),
} as const

/** Специфікації торговельного обладнання. */
export const EQUIPMENT_DOCS = {
  list: file('1p4i8jDIQWLe3Kf0OhSIVvCJpURuDB4tZ'),
  force: file('1_IICFu9kjtoZf_bwsX-zmDRIvNBzWs2H'),
  leader: file('1VL69ievJmNkfRkVpbEPCBUcsgb-9cF7A'),
  dynamic: file('1wTNRDNOs_vR6eAeyYRizmsgAS4TZk0DT'),
} as const
