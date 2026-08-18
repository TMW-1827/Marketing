/**
 * Функціональна перевірка ключових сценаріїв зовнішнього порталу.
 * Запуск: npm run build && npm run preview, у другому терміналі — npm run smoke
 * Потрібен браузер Playwright: npx playwright install chromium
 */
import { chromium } from 'playwright'

// За замовчуванням — локальний preview. SMOKE_URL дозволяє перевірити
// опубліковану збірку там, де вона реально лежить (у підкаталозі).
const base = process.env.SMOKE_URL ?? 'http://localhost:4173/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const problems = []
let failures = 0
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message))
page.on('console', (m) => m.type() === 'error' && problems.push('CONSOLE ' + m.text()))

const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
}

// --- Головна: слоган і плитка переходів ---
await page.goto(base + '#/start', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const home = await page.locator('.content').innerText()
check('слоган на головній', /ІЗ САМОГО СЕРЦЯ КАРПАТ/i.test(home))
// Другий слоган навчального порталу в зовнішній комунікації не вживається
check('на порталі один слоган', !/енергія природи/i.test(home))
const tiles = await page.locator('.linkcard').count()
check('плитка переходів для аудиторій', tiles >= 7, `${tiles} плиток`)
await page.locator('.linkcard').first().click()
await page.waitForTimeout(400)
check('перехід із плитки працює', page.url().includes('#/water'), page.url())

// --- Цін на порталі немає ---
const priceWords = /грн|РРЦ|без ПДВ|з ПДВ|прайс/i
for (const id of ['start', 'water', 'catalog', 'distributors', 'retail', 'logistics']) {
  await page.goto(base + '#/' + id, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  const text = await page.locator('.content').innerText()
  // «за прайсом» у тексті-запиті допустимо, самих цін бути не може
  check(`розділ ${id}: без цін`, !priceWords.test(text) || !/\d+,\d{2}\s*грн/.test(text))
}

// --- Калькулятор палети ---
await page.goto(base + '#/logistics', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
let out = await page.locator('.out').first().innerText()
// за замовчуванням обрано перший формат — 0,3 л скло: 12 шт/упак, 1296 на палеті
check(
  'палета 0,3 скло: 1200 пляшок = 100 упаковок',
  /100/.test(out) && /1\s200/.test(out),
  out.replace(/\n/g, ' | '),
)
let gap = await page.locator('.out-gap').innerText()
check('неповна палета показує, скільки бракує', /не вистачає/.test(gap), gap)

await page.locator('#pallet-qty').fill('1296')
await page.waitForTimeout(250)
gap = await page.locator('.out-gap').innerText()
check('рівно палета — залишків немає', /Рівно/.test(gap), gap)

await page.locator('#pallet-format').selectOption('g15')
await page.locator('#pallet-unit').selectOption('pallet')
await page.locator('#pallet-qty').fill('1')
await page.waitForTimeout(250)
out = await page.locator('.out').first().innerText()
check(
  '1 палета 1,5 л = 504 пляшки, 756 л',
  /504/.test(out) && /756/.test(out),
  out.replace(/\n/g, ' | '),
)

// Шари заокруглюються вгору: 100 упаковок 0,3 скло / 18 у шарі = 5,55 → 6
await page.locator('#pallet-format').selectOption('g03s')
await page.locator('#pallet-unit').selectOption('bottle')
await page.locator('#pallet-qty').fill('1200')
await page.waitForTimeout(250)
let layers = await page.locator('.out div').nth(2).innerText()
check('5,55 шара показані як 6', /\b6\b/.test(layers), layers.replace(/\n/g, ' '))

// Розрахунок за літрами: неповна пляшка округлюється вгору
await page.locator('#pallet-format').selectOption('g15')
await page.locator('#pallet-unit').selectOption('litre')
await page.locator('#pallet-qty').fill('100')
await page.waitForTimeout(250)
out = await page.locator('.out').first().innerText()
check(
  '100 л формату 1,5 л = 67 пляшок (100,5 л)',
  /\b67\b/.test(out) && /100,5/.test(out),
  out.replace(/\n/g, ' | '),
)

// --- Пошук по штрих-коду ---
await page.goto(base + '#/start', { waitUntil: 'networkidle' })
await page.locator('.searchbox--inline input').fill('4820124820751')
await page.waitForTimeout(300)
const hits = await page.locator('.searchres button').count()
check('пошук за штрих-кодом знаходить товар', hits > 0, `знайдено ${hits}`)
await page.locator('.searchres button').first().click()
await page.waitForTimeout(400)
const sheet = await page.locator('.sheet').innerText()
check(
  'картка товару відкрилась із результатів пошуку',
  /2,0 Л ПЕТ/i.test(sheet) && /4820124820751/.test(sheet),
)
check(
  'у картці товару немає цін',
  !/грн|РРЦ|ПДВ/i.test(sheet) || /узгоджуються індивідуально/.test(sheet),
)
await page.keyboard.press('Escape')

// --- Фільтри каталогу з полиці ---
await page.goto(base + '#/catalog', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.locator('.bottle').nth(2).click() // 0,5 л ПЕТ
await page.waitForTimeout(400)
const cards = await page.locator('.sku').count()
check(
  'дотик по пляшці фільтрує каталог (0,5 л ПЕТ → 3 позиції)',
  cards === 3,
  `${cards} карток`,
)

// --- FAQ для споживачів ---
await page.goto(base + '#/consumers', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const faqCount = await page.locator('.faq details').count()
check('блок питань і відповідей', faqCount >= 8, `${faqCount} питань`)
await page.locator('.faq summary').first().click()
await page.waitForTimeout(200)
check(
  'відповідь розкривається',
  await page.locator('.faq details[open]').count() === 1,
)

// --- Логотипи: вигляд і посилання на формати ---
await page.goto(base + '#/materials', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const logoImg = page.locator('.gallery img').first()
check('логотип показаний на сторінці', await logoImg.count() === 1)
const logoBox = await logoImg.boundingBox()
check(
  'логотип реально відмалювався',
  Boolean(logoBox && logoBox.width > 80 && logoBox.height > 30),
  logoBox ? `${Math.round(logoBox.width)}×${Math.round(logoBox.height)} px` : 'немає',
)
const formats = await page.locator('.asset__format').allInnerTexts()
for (const want of ['SVG', 'PDF', 'EPS', 'AI', 'PNG']) {
  check(`є посилання на формат ${want}`, formats.includes(want))
}
const assetLinks = await page.locator('.asset').count()
check('картки файлів логотипів', assetLinks >= 10, `${assetLinks} карток`)
const driveLinks = await page.evaluate(() =>
  [...document.querySelectorAll('.asset')].every((a) =>
    a.getAttribute('href').startsWith('https://drive.google.com/'),
  ),
)
check('усі файли ведуть на Google Drive', driveLinks)

// --- Обладнання: каталог ---
await page.goto(base + '#/equipment', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const equipCards = await page.locator('.equip').count()
check('каталог обладнання', equipCards === 11, `${equipCards} позицій`)
// Розряди відокремлені вузьким нерозривним пробілом — нормалізуємо перед звіркою
const equipText = (await page.locator('.content').innerText()).replace(/\u202f/g, ' ')
for (const want of ['Полиця вузька 423', 'Стійка П2', 'Ice Stream Leader', '2 145 мм']) {
  check(`каталог містить «${want}»`, equipText.includes(want))
}
// Фільтр за типом лишає тільки холодильники
await page.getByRole('button', { name: 'Холодильники', exact: true }).click()
await page.waitForTimeout(300)
const fridges = await page.locator('.equip').count()
check('фільтр «Холодильники» → 4 позиції', fridges === 4, `${fridges} позицій`)
// Силуети — в одному масштабі: найвища позиція вища за найнижчу
await page.getByRole('button', { name: 'всі', exact: true }).click()
await page.waitForTimeout(300)
const shapes = await page.evaluate(() =>
  [...document.querySelectorAll('.equip__shape')].map((s) => s.getBoundingClientRect().height),
)
check(
  'силуети масштабовані за висотою',
  Math.max(...shapes) > Math.min(...shapes) * 5,
  `${Math.round(Math.min(...shapes))}…${Math.round(Math.max(...shapes))} px`,
)

// --- Нові матеріали: завод, історія, дозвільні документи ---
await page.goto(base + '#/source', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const sourceText = await page.locator('.content').innerText()
check('розділ про третій завод', /Третій завод/i.test(sourceText))
check(
  'третій завод більший за перші два',
  /перевищить перші два/i.test(sourceText),
)
check('архів історичних фото', /Історичні фото продукції/i.test(sourceText))

await page.goto(base + '#/quality', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
check(
  'дозвільні документи',
  /Дозвільні документи/i.test(await page.locator('.content').innerText()),
)

// --- Спонсорство і контакти ---
await page.goto(base + '#/sponsorship', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const sponsor = await page.locator('.content').innerText()
check(
  'розділ спонсорства описує внесок бренду',
  /Що ми даємо як спонсор/i.test(sponsor),
)
check('розділ спонсорства повторює слоган', /ІЗ САМОГО СЕРЦЯ КАРПАТ/i.test(sponsor))

await page.goto(base + '#/contacts', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const contacts = await page.locator('.contact').count()
check('контакти показані картками', contacts >= 3, `${contacts} карток`)

// --- Навігація: усі розділи відкриваються без помилок ---
const ids = await page.evaluate(() =>
  [...document.querySelectorAll('.tabs a')].map((a) => a.getAttribute('href')),
)
check('меню містить усі розділи', ids.length === 16, `${ids.length} пунктів`)
for (const href of ids) {
  await page.goto(base + href.replace(/^#?/, '#'), { waitUntil: 'networkidle' })
  await page.waitForTimeout(150)
  const heading = await page.locator('h1, h2').first().innerText()
  check(`розділ ${href} відкривається`, heading.length > 0, heading)
}

if (problems.length) {
  console.log('\nПОМИЛКИ:\n' + problems.join('\n'))
} else {
  console.log('\nпомилок у консолі немає')
}
await browser.close()
process.exit(failures || problems.length ? 1 : 0)
