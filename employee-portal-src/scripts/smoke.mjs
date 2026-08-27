/**
 * Функціональна перевірка ключових сценаріїв внутрішнього порталу.
 * Запуск: npm run build && npm run preview, у другому терміналі — npm run smoke
 * Потрібен браузер Playwright: npx playwright install chromium
 */
import { chromium } from 'playwright'

// За замовчуванням — локальний preview. SMOKE_URL дозволяє перевірити
// опубліковану збірку там, де вона реально лежить (у підкаталозі).
const base = process.env.SMOKE_URL ?? 'http://localhost:4173/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

/**
 * Фото продукції й обладнання живуть на Google Drive, а середовище перевірки
 * туди не ходить. Замість того щоб залежати від мережі, підміняємо кожну
 * відповідь Drive однопіксельним зображенням: так перевіряється те, що можна
 * перевірити локально — які саме адреси запитує портал і чи малює він те, що
 * прийшло.
 */
const driveRequests = []
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
await ctx.route(/drive\.google\.com|googleusercontent\.com/, async (route) => {
  driveRequests.push(route.request().url())
  await route.fulfill({ contentType: 'image/png', body: PIXEL })
})

const page = await ctx.newPage()
const problems = []
let blockedImages = 0
let failures = 0
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  if (/Failed to load resource/i.test(m.text())) {
    blockedImages++
    return
  }
  problems.push('CONSOLE ' + m.text())
})
page.on('requestfailed', (r) => {
  const url = r.url()
  if (!/drive\.google\.com|googleusercontent/.test(url)) {
    problems.push('REQFAIL ' + url.slice(0, 90))
  }
})

const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
}

/** Вузький нерозривний пробіл між розрядами заважає звіряти числа. */
const flat = (s) => s.replace(/ /g, ' ').replace(/\n/g, ' | ')

// --- Головна: позначка внутрішнього документа й розвилка ---
await page.goto(base + '#/start', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check(
  'у шапці — позначка внутрішнього документа',
  /Внутрішній документ/i.test(await page.locator('.app-header').innerText()),
)
const home = await page.locator('.content').innerText()
check('слоган на головній', /ІЗ САМОГО СЕРЦЯ КАРПАТ/i.test(home))
check('головна веде на продажі й на склад', /Менеджеру з продажу/i.test(home) && /Складу й логістиці/i.test(home))
const tiles = await page.locator('.linkcard').count()
check('плитка переходів', tiles >= 6, `${tiles} плиток`)
await page.locator('.linkcard').first().click()
await page.waitForTimeout(400)
check('перехід із плитки працює', page.url().includes('#/prices'), page.url())

// --- Ціни: на відміну від зовнішнього порталу, вони тут є ---
const priceText = flat(await page.locator('.content').innerText())
check('прайс показує гривні', /\d+,\d{2}/.test(priceText))
check('дві цінові зони', /Захід, Київ/.test(priceText) && /Центр, Схід, Південь/.test(priceText))
check('редакція прайсу вказана', /липень 2026/i.test(priceText))
check(
  'сказано, чого менеджер не обіцяє сам',
  /Про що менеджер не домовляється сам/i.test(priceText),
)

// Калькулятор націнки: 0,3 л скло, західна зона
let out = flat(await page.locator('.out').first().innerText())
check('калькулятор націнки рахує заробіток точки', /націнка/i.test(out) && /маржа/i.test(out), out)
await page.locator('#price-zone').selectOption('east')
await page.waitForTimeout(250)
const eastOut = flat(await page.locator('.out').first().innerText())
check('зміна зони змінює ціну', eastOut !== out, eastOut)

// --- Калькулятор палети (розділ комплектації) ---
await page.goto(base + '#/picking', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
out = flat(await page.locator('.out').first().innerText())
check(
  'палета 0,3 скло: 1200 пляшок = 100 упаковок',
  /100/.test(out) && /1 200/.test(out),
  out,
)
let gap = await page.locator('.out-gap').first().innerText()
check('неповна палета показує, скільки бракує', /не вистачає/.test(gap), gap)

await page.locator('#pallet-format').selectOption('g15')
await page.locator('#pallet-unit').selectOption('pallet')
await page.locator('#pallet-qty').fill('1')
await page.waitForTimeout(250)
out = flat(await page.locator('.out').first().innerText())
check('1 палета 1,5 л = 504 пляшки, 756 л', /504/.test(out) && /756/.test(out), out)

// --- Калькулятор терміну придатності ---
await page.goto(base + '#/storage', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
// 0,3 л скло негазована — 12 місяців: рівно рік від дати розливу
await page.locator('#life-date').fill('2026-01-15')
await page.waitForTimeout(300)
let life = flat(await page.locator('.out').first().innerText())
check('12 місяців від 15.01.2026 → 15.01.2027', /15\.01\.2027/.test(life), life)

// Газований ПЕТ — 9 місяців, і це має бути видно
await page.locator('#life-format').selectOption('g05')
await page.locator('#life-gas').selectOption('сильногазована')
await page.waitForTimeout(300)
life = flat(await page.locator('.out').first().innerText())
check('газований ПЕТ — 9 місяців', /9\b/.test(life) && /15\.10\.2026/.test(life), life)

// Прострочена партія — окремий вердикт
await page.locator('#life-date').fill('2020-01-15')
await page.waitForTimeout(300)
check(
  'прострочену партію не приймати',
  /Не приймати/i.test(await page.locator('.out-gap').first().innerText()),
)
const meter = await page.locator('.life-meter__fill--expired').count()
check('шкала показує прострочення', meter === 1, `${meter}`)

// --- Калькулятор завантаження: воду обмежує вага, а не місця ---
await page.goto(base + '#/transport', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.locator('#load-vehicle').selectOption('tent-20')
await page.locator('#load-format').selectOption('g15')
await page.waitForTimeout(300)
const load = flat(await page.locator('.out').first().innerText())
// 20 000 кг / 804,41 кг = 24 палети, при 33 палетомісцях
check('1,5 л у 20-тонник: 24 палети за вагою', /24/.test(load) && /33/.test(load), load)
check(
  'сказано, що обмежує саме вага',
  /Обмежує.*вага/i.test(await page.locator('.out-gap').first().innerText()),
)

// --- Збірка змішаного замовлення ---
await page.goto(base + '#/visit', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const rows = await page.locator('.mix__row').count()
check('у збірці замовлення є рядки', rows === 2, `${rows} рядків`)
let mix = flat(await page.locator('.out').first().innerText())
check(
  'підсумок рахує палетомісця й суму',
  /палетомісць/i.test(mix) && /сума з ПДВ/i.test(mix),
  mix,
)
check('суми згруповані по розрядах', /\d \d{3},\d{2}/.test(mix), mix)

// Дробова палета займає ціле палетомісце
await page.locator('.mix__row input').first().fill('0.5')
await page.waitForTimeout(300)
mix = flat(await page.locator('.out').first().innerText())
check('0,5 + 2 палети = 3 палетомісця', /\| 3 \|/.test(` | ${mix} | `), mix)

// Перевантаження видно одразу
await page.locator('.mix__row input').first().fill('40')
await page.waitForTimeout(300)
check(
  'перевантаження авто помічене',
  /Не влізе/i.test(await page.locator('.out-gap').first().innerText()),
)

// --- Заперечення: акордеон ---
await page.goto(base + '#/selling', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const objections = await page.locator('.accordion__item').count()
check('дванадцять заперечень', objections === 12, `${objections}`)
await page.locator('.accordion__head').first().click()
await page.waitForTimeout(200)
check(
  'відповідь розкривається',
  (await page.locator('.accordion__body').count()) === 1,
)

// --- Комплаєнс: межі дозволеного й питання покупця ---
await page.goto(base + '#/compliance', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const compliance = await page.locator('.content').innerText()
check(
  'є переліки «можна» і «не можна»',
  /(^|\W)можна/i.test(compliance) && /не можна/i.test(compliance),
)
const faqCount = await page.locator('.faq details').count()
check('питання покупця зібрані окремо', faqCount >= 6, `${faqCount} питань`)

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
await page.keyboard.press('Escape')

// --- Полиця й каталог ---
await page.goto(base + '#/catalog', { waitUntil: 'networkidle' })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const skuCount = await page.locator('.sku').count()
check('каталог показує всі позиції', skuCount === 18, `${skuCount} позицій`)

// Мітка газації — кружечок одного кольору скрізь: під пляшкою на полиці,
// у картці позиції й у таблиці форматів. Кольори беремо з реального DOM.
const FILL = {
  негазована: 'rgb(255, 255, 255)',
  слабогазована: 'rgb(0, 150, 108)',
  сильногазована: 'rgb(0, 94, 184)',
}
const dots = await page.evaluate(() => {
  const read = (sel) =>
    [...document.querySelectorAll(sel)].map((el) => ({
      label: el.getAttribute('aria-label') ?? '',
      fills: [...el.querySelectorAll('.gasdot')].map(
        (d) => getComputedStyle(d).backgroundColor,
      ),
    }))
  return {
    shelf: read('.bottle__label .gasdots'),
    table: read('.card .gasdots'),
    sku: [...document.querySelectorAll('.sku .gasdot')].map((d) =>
      getComputedStyle(d).backgroundColor,
    ),
  }
})
check('під кожною пляшкою є кружечки газації', dots.shelf.length === 8, `${dots.shelf.length} із 8`)
check(
  '0,5 л ПЕТ — три газації трьома кольорами',
  dots.shelf[2]?.fills.join(' ') ===
    [FILL.негазована, FILL.слабогазована, FILL.сильногазована].join(' '),
  dots.shelf[2]?.fills.join(' '),
)
check(
  'SPORT — одна газація, один кружечок',
  dots.shelf[4]?.fills.length === 1 && dots.shelf[4].fills[0] === FILL.негазована,
  dots.shelf[4]?.fills.join(' '),
)
check(
  'кружечки підписані словами для читача з екрана',
  /Газації: негазована · слабогазована · сильногазована/.test(dots.shelf[2]?.label ?? ''),
  dots.shelf[2]?.label,
)
check(
  'у таблиці форматів газації теж кружечками',
  dots.table.length === 8 && dots.table[2]?.fills.length === 3,
  `${dots.table.length} рядків`,
)
check(
  'картка позиції має кружечок того самого кольору',
  dots.sku.length === 18 && dots.sku.every((c) => Object.values(FILL).includes(c)),
  `${dots.sku.length} із 18`,
)
await page.locator('.bottle').nth(2).click() // 0,5 л ПЕТ
await page.waitForTimeout(400)
check(
  'дотик по пляшці фільтрує каталог (0,5 л ПЕТ → 3 позиції)',
  (await page.locator('.sku').count()) === 3,
)

// --- Обладнання ---
await page.goto(base + '#/equipment', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('каталог обладнання', (await page.locator('.equip').count()) === 11)

// --- Довідник: скорочення й глосарій ---
await page.goto(base + '#/reference', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const refText = await page.locator('.content').innerText()
for (const want of ['ТТН', 'FIFO', 'Палетомісце', 'Відсічка', 'РРЦ']) {
  check(`довідник пояснює «${want}»`, refText.includes(want))
}

// --- Мітки аудиторії у шторці розділів ---
await page.setViewportSize({ width: 420, height: 900 })
await page.goto(base + '#/start', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Розділи' }).click()
await page.waitForTimeout(300)
const badges = await page.locator('.drawer__badge').allInnerTexts()
check('розділи позначені аудиторією', badges.length > 0, `${badges.length} міток`)
check(
  'мітки лише «Продажі» і «Склад»',
  badges.every((b) => /^(продажі|склад)$/i.test(b)),
  [...new Set(badges)].join(', '),
)
await page.keyboard.press('Escape')
await page.setViewportSize({ width: 1280, height: 900 })

// --- Навігація: усі розділи відкриваються без помилок ---
await page.goto(base + '#/start', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const ids = await page.evaluate(() =>
  [...document.querySelectorAll('.tabs a')].map((a) => a.getAttribute('href')),
)
check('меню містить усі розділи', ids.length === 23, `${ids.length} пунктів`)
for (const href of ids) {
  await page.goto(base + href.replace(/^#?/, '#'), { waitUntil: 'networkidle' })
  await page.waitForTimeout(150)
  const heading = await page.locator('h1, h2').first().innerText()
  check(`розділ ${href} відкривається`, heading.length > 0, heading)
}

console.log(`\nзапитів до Drive перехоплено: ${driveRequests.length}`)
if (blockedImages) {
  console.log(`не завантажилось зображень: ${blockedImages}`)
}
if (problems.length) {
  console.log('\nПОМИЛКИ:\n' + problems.join('\n'))
} else {
  console.log('\nінших помилок немає')
}
await browser.close()
process.exit(failures || problems.length ? 1 : 0)
