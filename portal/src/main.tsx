import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

// Шрифти пакуються в бандл: жодних запитів до Google Fonts.
// Це умова офлайн-роботи й майбутньої нативної збірки, де CDN недоступний.
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/sofia-sans-extra-condensed/700.css'
import '@fontsource/sofia-sans-extra-condensed/800.css'
import '@fontsource/sofia-sans-extra-condensed/900.css'

import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/layout.css'
import '@/styles/components.css'
import '@/styles/features.css'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProgressProvider } from '@/features/progress/ProgressProvider'
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
      <AuthProvider>
        <ProgressProvider>
          <AppShell />
        </ProgressProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
