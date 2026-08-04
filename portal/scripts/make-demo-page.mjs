/**
 * Готує однофайлову демо-збірку до публікації як сторінку.
 *
 * Хостинг сторінок сам обгортає вміст у <!doctype>/<html>/<head>/<body>,
 * тому з готового index.html треба лишити тільки внутрішній вміст.
 * Збираємо його в порядку: заголовок → стилі → розмітка → скрипти.
 * Скрипт іде останнім, хоча в оригіналі він у <head>: там він працює
 * завдяки type="module" (відкладене виконання), а тут порядок явний.
 *
 * Запуск: BUILD_TARGET=demo npx vite build --outDir dist-demo
 *         node scripts/make-demo-page.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const html = readFileSync(root + 'dist-demo/index.html', 'utf8')

const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/)
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/)
if (!headMatch || !bodyMatch) throw new Error('Несподівана структура index.html')

/**
 * Усередині зібраного JS трапляється рядок "<script><\/script>" — саме
 * екранований, щоб не закрити тег. Тому нежадібний пошук до першого
 * справжнього </script> безпечний.
 */
const collect = (source, tag) =>
  [...source.matchAll(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g'))].map(
    (m) => m[0],
  )

const styles = [...collect(headMatch[1], 'style'), ...collect(bodyMatch[1], 'style')]
const scripts = [...collect(headMatch[1], 'script'), ...collect(bodyMatch[1], 'script')]

if (styles.length === 0) throw new Error('Не знайдено вбудованих стилів')
if (scripts.length === 0) throw new Error('Не знайдено вбудованого скрипта')

// Розмітка без скриптів і стилів — вони додаються окремо, у явному порядку
const markup = bodyMatch[1]
  .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
  .trim()

const page = [
  '<title>Навчальний портал ТМ «Трускавецька»</title>',
  ...styles,
  markup,
  ...scripts,
].join('\n')

writeFileSync(root + 'dist-demo/page.html', page)
console.log(
  `page.html — ${(page.length / 1024 / 1024).toFixed(2)} МБ ` +
    `(стилів: ${styles.length}, скриптів: ${scripts.length})`,
)
