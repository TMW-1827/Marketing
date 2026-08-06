/**
 * Перевірка демонстраційного входу.
 *
 * Працює на демо-збірці, де VITE_DEMO_AUTH увімкнено:
 *   npm run build:demo
 *   node scripts/smoke-auth.mjs
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const page_url =
  'file://' + fileURLToPath(new URL('../dist-demo/wrapped.html', import.meta.url))

const browser = await chromium.launch()
const problems = []
const check = (name, ok, detail = '') =>
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message))
page.on('console', (m) => m.type() === 'error' && problems.push('CONSOLE ' + m.text()))

await page.goto(page_url + '#/start', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// --- Матеріали закриті до входу ---
check(
  'без входу показується екран логіна',
  await page.locator('.auth__card').isVisible(),
)
check(
  'матеріали недоступні до входу',
  (await page.locator('.app-header').count()) === 0,
)
check(
  'реєстрація в демо-режимі не пропонується',
  (await page.locator('.auth__switch').count()) === 0,
)
check(
  'на екрані показані обидва тестові акаунти',
  (await page.locator('.demo-accounts__item').count()) === 2,
)

// --- Невірний пароль ---
await page.locator('#auth-email').fill('pracivnyk@truskavetska.test')
await page.locator('#auth-password').fill('bad-password')
await page.getByRole('button', { name: 'Увійти' }).click()
await page.waitForTimeout(400)
check(
  'невірний пароль дає зрозумілу помилку',
  /Невірна пошта або пароль/.test(await page.locator('.note--warn').innerText()),
)

// --- Вхід працівником через підстановку ---
await page.locator('.demo-accounts__item').first().click()
await page.waitForTimeout(200)
check(
  'клік по акаунту підставляє дані у форму',
  (await page.locator('#auth-email').inputValue()) === 'pracivnyk@truskavetska.test',
)
await page.getByRole('button', { name: 'Увійти' }).click()
await page.waitForTimeout(700)
check('після входу відкрились матеріали', await page.locator('.app-header').isVisible())

// --- Профіль показує саме цей акаунт ---
await page.goto(page_url + '#/profile', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
let profile = await page.locator('article').innerText()
check(
  'у профілі — дані працівника',
  /Тест Працівник/.test(profile) && /Торговий представник/.test(profile),
)
check('працівник не бачить адмінки', !/Адміністрування/i.test(profile))

// --- Прогрес прив'язаний до акаунта ---
await page.goto(page_url + '#/brand', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Позначити пройденим' }).click()
await page.waitForTimeout(300)
check(
  'прогрес працівника зарахований',
  (await page.locator('.progress span').innerText()).trim() === '1 / 12',
)

// --- Сесія переживає перезавантаження ---
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
check('сесія збереглася після перезавантаження', await page.locator('.app-header').isVisible())

// --- Вихід ---
await page.goto(page_url + '#/profile', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Вийти з акаунта' }).click()
await page.waitForTimeout(600)
check('після виходу знову екран логіна', await page.locator('.auth__card').isVisible())

// --- Вхід керівником ---
await page.locator('.demo-accounts__item').nth(1).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Увійти' }).click()
await page.waitForTimeout(700)
await page.goto(page_url + '#/profile', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
profile = await page.locator('article').innerText()
check('у профілі — дані керівника', /Тест Керівник/.test(profile))
check('керівник бачить розділ адміністрування', /Адміністрування/i.test(profile))
check(
  'прогрес керівника окремий від працівника',
  (await page.locator('.progress span').innerText()).trim() === '0 / 12',
)

// --- Звіт ---
await page.goto(page_url + '#/admin', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const report = await page.locator('article').innerText()
check('звіт відкривається', /Звіт про навчання/i.test(report))
check('звіт позначений як зразок', /Зразок даних/i.test(report))
check(
  'у звіті є рядки',
  (await page.locator('tbody tr').count()) === 5,
  `${await page.locator('tbody tr').count()} рядків`,
)

// Сортування за балом
await page.locator('#admin-sort').selectOption('score')
await page.waitForTimeout(300)
const firstRow = await page.locator('tbody tr').first().innerText()
check('сортування за балом ставить 20 угорі', /20/.test(firstRow), firstRow.replace(/\n/g, ' | '))

// Пошук
await page.locator('#admin-search').fill('Одеська')
await page.waitForTimeout(300)
check(
  'пошук у звіті фільтрує',
  (await page.locator('tbody tr').count()) === 1,
)

console.log(problems.length ? '\nПОМИЛКИ:\n' + problems.join('\n') : '\nпомилок у консолі немає')
await browser.close()
