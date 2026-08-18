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

/** Логотипи в різних форматах. */
export const LOGO = {
  /** Основний, з горами, кольоровий */
  svg: file('1ZV7j9wX4G3oiy3Ynt9KswfDvgAeQaNH3'),
  pdf: file('16grwVWfo-79DQmrlwQLsCHMLnrJxCQtr'),
  eps: file('1xQ7DZnv1f9xS6L1-IXWrRMZQWDSaJsng'),
  ai: file('1F4q5x1Bq7OH3oOB_elGOd9AnCrWM8dRG'),
  png: file('1rcBTIDISuAu94xCfv3Up0J_I8MNpJIuU'),
  /** Біло-срібний, для кольорових і темних фонів */
  whiteSilverAi: file('1aw_PoDqzHDcEXhzoPimaVO-KVSKJUWdO'),
  whiteSilverPdf: file('1D4EXkeO-XhlJO0FjpruRF7YEN9DN963B'),
  /** Квадратні PNG 1080×1080 для соцмереж */
  socialMountains: file('1mSxF6MYbeuMnj6ePpFUB9vt80XeO9maJ'),
  socialText: file('1bdsPjXDfAukxM539vRTEcY4ZD4wPNq8w'),
  /** Тека з усіма варіантами */
  all: folder('1xrwXxj2pVks-g_eNL9gNt2sGs9-RQSYL'),
} as const

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
