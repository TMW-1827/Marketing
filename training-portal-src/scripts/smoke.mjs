/**
 * Функціональна перевірка ключових сценаріїв порталу.
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
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message))
page.on('console', (m) => m.type() === 'error' && problems.push('CONSOLE ' + m.text()))

const check = (name, ok, detail = '') =>
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)

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
check('1 палета 1,5 л = 504 пляшки, 756 л', /504/.test(out) && /756/.test(out), out.replace(/\n/g, ' | '))

// Шари заокруглюються вгору: 100 упаковок 0,3 скло / 18 у шарі = 5,55 → 6
await page.locator('#pallet-format').selectOption('g03s')
await page.locator('#pallet-unit').selectOption('bottle')
await page.locator('#pallet-qty').fill('1200')
await page.waitForTimeout(250)
let layers = await page.locator('.out div').nth(2).innerText()
check('5,55 шара показані як 6', /\b6\b/.test(layers), layers.replace(/\n/g, ' '))

// 4,2 шара теж мають дати 5, а не 4
await page.locator('#pallet-unit').selectOption('case')
await page.locator('#pallet-qty').fill('76') // 76 / 18 = 4,22
await page.waitForTimeout(250)
layers = await page.locator('.out div').nth(2).innerText()
check('4,22 шара показані як 5', /\b5\b/.test(layers), layers.replace(/\n/g, ' '))

// Рівно ціла кількість шарів не має підстрибувати вгору
await page.locator('#pallet-qty').fill('54') // 54 / 18 = рівно 3
await page.waitForTimeout(250)
layers = await page.locator('.out div').nth(2).innerText()
check('рівно 3 шари лишаються 3', /\b3\b/.test(layers), layers.replace(/\n/g, ' '))

// --- Розрахунок за літрами ---
await page.locator('#pallet-format').selectOption('g15')
await page.locator('#pallet-unit').selectOption('litre')
await page.locator('#pallet-qty').fill('756')
await page.waitForTimeout(250)
out = await page.locator('.out').first().innerText()
check(
  '756 л формату 1,5 л = 504 пляшки, рівно палета',
  /504/.test(out) && /756/.test(out),
  out.replace(/\n/g, ' | '),
)
gap = await page.locator('.out-gap').innerText()
check('756 л — рівно повна палета', /Рівно/.test(gap), gap)

// Літри, що не діляться націло, округлюються вгору до цілої пляшки
await page.locator('#pallet-qty').fill('100')
await page.waitForTimeout(250)
out = await page.locator('.out').first().innerText()
check(
  '100 л формату 1,5 л = 67 пляшок (100,5 л)',
  /\b67\b/.test(out) && /100,5/.test(out),
  out.replace(/\n/g, ' | '),
)

// --- Десяткова кома у вазі й об'ємі ---
await page.locator('#pallet-unit').selectOption('case')
await page.locator('#pallet-qty').fill('5')
await page.waitForTimeout(250)
out = await page.locator('.out').first().innerText()
// 5 упаковок 1,5 л: 30 пляшок = 45 л, вага (5/84) × 804,41 = 47,9 кг
check(
  'вага показана з десятковою комою (47,9 кг)',
  /47,9/.test(out),
  out.replace(/\n/g, ' | '),
)
await page.locator('#pallet-format').selectOption('g05')
await page.locator('#pallet-qty').fill('7')
await page.waitForTimeout(250)
out = await page.locator('.out').first().innerText()
// 7 упаковок 0,5 л = 56 пляшок = 28 л, вага (7/150) × 676 = 31,5 кг
check(
  'об’єм і вага з комою (28 л, 31,5 кг)',
  /\b28\b/.test(out) && /31,5/.test(out),
  out.replace(/\n/g, ' | '),
)

// --- Калькулятор націнки ---
await page.goto(base + '#/prices', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
out = await page.locator('.out').first().innerText()
// 0,3 скло, захід: закупівля 23,40, РРЦ 33,00 → прибуток 9,60, націнка 41%
check('націнка 0,3 скло (захід): 23,40 → 33,00', /23,40/.test(out) && /33,00/.test(out) && /9,60/.test(out), out.replace(/\n/g, ' | '))

// --- Пошук по штрих-коду ---
await page.goto(base + '#/start', { waitUntil: 'networkidle' })
await page.locator('.searchbox--inline input').fill('4820124820751')
await page.waitForTimeout(300)
const hits = await page.locator('.searchres button').count()
check('пошук за штрих-кодом знаходить товар', hits > 0, `знайдено ${hits}`)
await page.locator('.searchres button').first().click()
await page.waitForTimeout(400)
const sheet = await page.locator('.sheet').innerText()
check('картка товару відкрилась із каталогу пошуку', /2,0 Л ПЕТ/i.test(sheet) && /4820124820751/.test(sheet))
await page.keyboard.press('Escape')

// --- Позначка «пройдено» і прогрес ---
await page.goto(base + '#/brand', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Позначити пройденим' }).click()
await page.waitForTimeout(300)
let progress = await page.locator('.progress span').innerText()
check('прогрес зріс після позначки', progress.trim() === '1 / 12', progress)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
progress = await page.locator('.progress span').innerText()
check('прогрес пережив перезавантаження', progress.trim() === '1 / 12', progress)

// --- Тест: відповіді, підрахунок, сертифікат ---
await page.goto(base + '#/test', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const questions = page.locator('.question')
const total = await questions.count()
check('у тесті 20 питань', total === 20, String(total))

// Відповідаємо правильно на всі, крім останнього — маємо отримати 19
const answers = [2, 0, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 0, 2, 2, 1, 0]
for (let i = 0; i < total; i++) {
  const pick = i === total - 1 ? (answers[i] + 1) % 4 : answers[i]
  await questions.nth(i).locator('.option').nth(pick).click()
}
await page.getByRole('button', { name: 'Показати результат' }).click()
await page.waitForTimeout(400)
const result = await page.locator('.note--ok, .note--warn').first().innerText()
check('тест зарахував 19 із 20', /19 із 20/i.test(result), result.replace(/\n/g, ' '))
check('сертифікат доступний після проходження', await page.locator('.certificate, #cert-name').count() > 0)

await page.locator('#cert-name').fill('Тест Тестовий')
await page.getByRole('button', { name: 'Сформувати' }).click()
await page.waitForTimeout(300)
const cert = await page.locator('.certificate').innerText()
check('сертифікат містить ПІБ і результат', /ТЕСТ ТЕСТОВИЙ/i.test(cert) && /19 із 20/.test(cert))

// --- Фільтри каталогу з полиці ---
await page.goto(base + '#/catalog', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.locator('.bottle').nth(2).click() // 0,5 л ПЕТ
await page.waitForTimeout(400)
const cards = await page.locator('.sku').count()
check('дотик по пляшці фільтрує каталог (0,5 л ПЕТ → 3 позиції)', cards === 3, `${cards} карток`)

console.log(problems.length ? '\nПОМИЛКИ:\n' + problems.join('\n') : '\nпомилок у консолі немає')
await browser.close()
