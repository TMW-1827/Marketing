import { useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { sections } from '@/content/course'
import { GROUP_LABEL, GROUP_ORDER, type SectionGroup } from '@/types/content'
import { useProgress } from '@/features/progress/ProgressProvider'
import {
  CheckCircleIcon,
  HomeIcon,
  ListIcon,
  UserIcon,
} from './Icons'

const byGroup = (group: SectionGroup) => sections.filter((s) => s.group === group)

/** Горизонтальне меню розділів — десктоп. */
export function Tabs() {
  const { isDone } = useProgress()

  return (
    <nav className="tabs" aria-label="Розділи порталу">
      {GROUP_ORDER.map((group) => (
        <div className="tabs__group" key={group}>
          <span className="tabs__label">{GROUP_LABEL[group]}</span>
          {byGroup(group).map((section) => (
            <NavLink
              key={section.id}
              to={`/${section.id}`}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            >
              {section.nav}
              {section.trackable && isDone(section.id) && (
                <span className="tabs__check" aria-label="пройдено">
                  ✓
                </span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Шторка розділів — телефон і планшет. */
export function SectionDrawer({ onClose }: { onClose: () => void }) {
  const { isDone } = useProgress()
  const { pathname } = useLocation()
  const openedAt = useRef(pathname)

  // Закривається сама при переході — інакше після вибору розділу
  // користувач лишається дивитись у шторку. Перший запуск ефекту
  // пропускаємо: інакше шторка закрилась би одразу після відкриття.
  useEffect(() => {
    if (pathname !== openedAt.current) onClose()
  }, [pathname, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer">
      <button
        type="button"
        className="drawer__scrim"
        aria-label="Закрити меню"
        onClick={onClose}
      />
      <div className="drawer__panel" role="dialog" aria-label="Розділи порталу">
        <div className="drawer__grip" />
        {GROUP_ORDER.map((group) => (
          <div key={group}>
            <div className="drawer__label">{GROUP_LABEL[group]}</div>
            {byGroup(group).map((section) => (
              <NavLink
                key={section.id}
                to={`/${section.id}`}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                <span>{section.nav}</span>
                {section.trackable && isDone(section.id) && (
                  <span style={{ color: 'var(--green)' }} aria-label="пройдено">
                    ✓
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Нижня панель — телефон. Повторює нативну модель навігації. */
export function TabBar({ onOpenSections }: { onOpenSections: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="tabbar" aria-label="Основна навігація">
      <button
        type="button"
        className={pathname === '/start' ? 'is-active' : undefined}
        onClick={() => navigate('/start')}
      >
        <HomeIcon />
        Старт
      </button>
      <button type="button" onClick={onOpenSections}>
        <ListIcon />
        Розділи
      </button>
      <button
        type="button"
        className={pathname === '/test' ? 'is-active' : undefined}
        onClick={() => navigate('/test')}
      >
        <CheckCircleIcon />
        Тест
      </button>
      <button
        type="button"
        className={pathname === '/profile' ? 'is-active' : undefined}
        onClick={() => navigate('/profile')}
      >
        <UserIcon />
        Профіль
      </button>
    </nav>
  )
}
