import { useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Search } from '@/components/Search'
import { SectionDrawer, TabBar, Tabs } from '@/components/Navigation'
import { SkuSheet } from '@/features/catalog/SkuSheet'
import { portal } from '@/content/portal'
import { SectionPage } from './SectionPage'

/**
 * Оболонка внутрішнього порталу.
 *
 * Без входу й без обліку прогресу: це довідник, а не курс. Його відкривають
 * посеред зміни, щоб звірити одну цифру, і закривають за десять секунд —
 * тому в шапці пошук, а не особистий кабінет. Навчання з тестом і
 * сертифікатом живе окремо, у навчальному порталі.
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__top">
          <Link className="logo" to="/start">
            {portal.title}
            <span>{portal.subtitle}</span>
          </Link>

          {/* Кнопки «Розділи» в шапці немає навмисно: на телефоні цю роль
              виконує нижня панель, і шапка лишається компактною. */}
          <Search />
          <div className="header-spacer" />
          {/* Замість слогана — попередження: це те, що має бути перед очима
              щоразу, коли працівник показує екран комусь у торговій точці. */}
          <span className="header-slogan header-slogan--warn">
            Внутрішній документ
          </span>
        </div>
        <Tabs />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/start" replace />} />
          <Route path="/:sectionId" element={<SectionPage />} />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Routes>
      </main>

      <TabBar onOpenSections={() => setDrawerOpen(true)} />

      {drawerOpen && <SectionDrawer onClose={() => setDrawerOpen(false)} />}
      <SkuSheet />
    </div>
  )
}
