import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

// Шрифти пакуються в бандл: жодних запитів до Google Fonts.
// Це умова офлайн-роботи й майбутньої нативної збірки, де CDN недоступний.
//
// Підключаємо тільки потрібні підмножини — кирилицю й латиницю. Повні пакети
// тягнуть ще грецьку та в'єтнамську, які нам ніколи не знадобляться, але
// потрапляють в офлайн-кеш і у вагу нативного додатка.
import '@fontsource/montserrat/cyrillic-400.css'
import '@fontsource/montserrat/cyrillic-500.css'
import '@fontsource/montserrat/cyrillic-600.css'
import '@fontsource/montserrat/cyrillic-700.css'
import '@fontsource/montserrat/cyrillic-ext-400.css'
import '@fontsource/montserrat/cyrillic-ext-700.css'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-600.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/sofia-sans-extra-condensed/cyrillic-700.css'
import '@fontsource/sofia-sans-extra-condensed/cyrillic-800.css'
import '@fontsource/sofia-sans-extra-condensed/cyrillic-900.css'
import '@fontsource/sofia-sans-extra-condensed/latin-700.css'
import '@fontsource/sofia-sans-extra-condensed/latin-800.css'
import '@fontsource/sofia-sans-extra-condensed/latin-900.css'

import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/layout.css'
import '@/styles/components.css'
import '@/styles/features.css'

import { AppShell } from '@/app/AppShell'

const root = document.getElementById('root')
if (!root) throw new Error('Не знайдено кореневий елемент #root')

createRoot(root).render(
  <StrictMode>
    {/*
      HashRouter, а не BrowserRouter: у Capacitor сторінка віддається з
      файлової системи, де серверного роутингу немає. Той самий білд працює
      і у вебі, і в нативній обгортці без окремої конфігурації.
    */}
    <HashRouter>
      <AppShell />
    </HashRouter>
  </StrictMode>,
)
