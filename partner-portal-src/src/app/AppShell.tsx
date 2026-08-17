import { useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Search } from '@/components/Search'
import { SectionDrawer, TabBar, Tabs } from '@/components/Navigation'
import { SkuSheet } from '@/features/catalog/SkuSheet'
import { portal } from '@/content/portal'
import { SectionPage } from './SectionPage'

/**
 * Оболонка зовнішнього порталу.
 *
 * Без входу й без прогресу: портал публічний, його відкривають за
 * посиланням і читають із того розділу, який стосується саме читача.
 * Тому в шапці — слоган і пошук, а не лічильник пройденого.
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
          <span className="header-slogan">{portal.slogan}</span>
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
