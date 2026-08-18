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

/**
 * Логотипи: сирі ідентифікатори файлів, згруповані за варіантом знака.
 *
 * Саме ідентифікатори, а не готові посилання: та сама картка формату під
 * знаком робить із них адресу завантаження, а перелік — адресу перегляду.
 */
export const LOGO_ID = {
  /** Основний знак: гори + напис, кольоровий */
  mountains: {
    svg: '1ZV7j9wX4G3oiy3Ynt9KswfDvgAeQaNH3',
    pdf: '16grwVWfo-79DQmrlwQLsCHMLnrJxCQtr',
    eps: '1xQ7DZnv1f9xS6L1-IXWrRMZQWDSaJsng',
    ai: '1F4q5x1Bq7OH3oOB_elGOd9AnCrWM8dRG',
    png: '1rcBTIDISuAu94xCfv3Up0J_I8MNpJIuU',
    png1080: '1mSxF6MYbeuMnj6ePpFUB9vt80XeO9maJ',
  },
  /** Той самий знак у біло-срібному виконанні — для темних фонів */
  whiteSilver: {
    svg: '1CmfOPXFaf2_n2--1GOexsgwgTA0CVDOf',
    pdf: '1D4EXkeO-XhlJO0FjpruRF7YEN9DN963B',
    ai: '1aw_PoDqzHDcEXhzoPimaVO-KVSKJUWdO',
    png: '1HW7kahVY3TSaDHL-EpBSP3f4mWrzsIzz',
  },
  /** Тільки напис, без гір */
  text: {
    svg: '10G6rqLyEHv2H5t_du5CF8ociajH4c2Jt',
    pdf: '10Bw18QT1uuJyQ4ezzMV2b6QYJL9RAlcp',
    png: '1SyA9SMjHxPWGQwroqBwnuKkv8YcOVBEP',
    png1080: '1bdsPjXDfAukxM539vRTEcY4ZD4wPNq8w',
    pdfEn: '1WbXZqUm9NtC3kERyafTDPDydDO6kOozc',
  },
  textWhite: {
    svg: '1850Vlq6AH3DFcx0zeY5_knu96-3zsMyl',
    pdf: '1hIyxW6ldStsS47BKs_coL_LzyqAhjK9f',
    png: '1lXb3d4kuIzmBIU7yNvRWWHg_auXyb9dG',
  },
  /** Окремий знак лінійки SPORT */
  sport: {
    svg: '1t_5_h5Afz7o0zgDlPp4JE4MVQND2GIOC',
    pdf: '1mvDrkpokeg5Q3RCavB9gpDFNct0enH1R',
    png: '1DLGaF5xZngWG701kkL1tCK8sOhhTWqS1',
    png1080: '1RogcrngZ90vTzSRsUsPH9XHpj-fSE_-L',
  },
  sportWhite: {
    svg: '1fGfns9_9NDPNwT4vogeaYNbXc-vy2_fk',
    pdf: '1diRG4p7Zl36NUAucXhokC7gbcTY30TDh',
    png: '1RpQl79ac6Vy0ks8klLHqVCzv3TfllCyQ',
    png1080: '1XkKyrYm4FTLTGIO0lBSj6xeoVxkVGWeL',
  },
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
