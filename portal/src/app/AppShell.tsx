import { useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Search } from '@/components/Search'
import {
  SectionDrawer,
  TabBar,
  Tabs,
} from '@/components/Navigation'
import { SkuSheet } from '@/features/catalog/SkuSheet'
import { useProgress } from '@/features/progress/ProgressProvider'
import { useAuth } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { AdminPage } from '@/features/admin/AdminPage'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { SectionPage } from './SectionPage'
import { ProfilePage } from './ProfilePage'

export function AppShell() {
  const { ready, backend, session } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!ready) {
    return (
      <div className="splash">
        <div className="logo">
          Трускавецька
          <span>Навчальний портал</span>
        </div>
      </div>
    )
  }

  // З бекендом матеріали доступні лише працівникам компанії.
  if (backend && !session) return <LoginPage />

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__top">
          <Link className="logo" to="/start">
            Трускавецька
            <span>Навчальний портал</span>
          </Link>

          {/* Кнопки «Розділи» в шапці немає навмисно: на телефоні цю роль
              виконує нижня панель, і шапка лишається компактною. */}
          <Search />
          <div className="header-spacer" />
          <ProgressIndicator />
        </div>
        <Tabs />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/start" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/:sectionId" element={<SectionPage />} />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Routes>
      </main>

      <TabBar onOpenSections={() => setDrawerOpen(true)} />

      {drawerOpen && <SectionDrawer onClose={() => setDrawerOpen(false)} />}
      <SkuSheet />
      <UpdatePrompt />
    </div>
  )
}

function ProgressIndicator() {
  const { doneCount, totalCount } = useProgress()
  const percent = totalCount === 0 ? 0 : (doneCount / totalCount) * 100

  return (
    <Link
      className="progress"
      to="/profile"
      aria-label={`Пройдено ${doneCount} із ${totalCount} розділів`}
      style={{ textDecoration: 'none' }}
    >
      <span>
        {doneCount} / {totalCount}
      </span>
      <div className="progress__bar">
        <i style={{ width: `${percent}%` }} />
      </div>
    </Link>
  )
}
