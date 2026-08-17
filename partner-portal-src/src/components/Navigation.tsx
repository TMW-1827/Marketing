import { useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { sections } from '@/content/portal'
import { GROUP_LABEL, GROUP_ORDER, type SectionGroup } from '@/types/content'
import { DropIcon, HomeIcon, ListIcon, MailIcon } from './Icons'

const byGroup = (group: SectionGroup) => sections.filter((s) => s.group === group)

/** Горизонтальне меню розділів — десктоп. */
export function Tabs() {
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
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Шторка розділів — телефон і планшет. */
export function SectionDrawer({ onClose }: { onClose: () => void }) {
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
        Головна
      </button>
      <button
        type="button"
        className={pathname === '/water' ? 'is-active' : undefined}
        onClick={() => navigate('/water')}
      >
        <DropIcon />
        Про воду
      </button>
      <button type="button" onClick={onOpenSections}>
        <ListIcon />
        Розділи
      </button>
      <button
        type="button"
        className={pathname === '/contacts' ? 'is-active' : undefined}
        onClick={() => navigate('/contacts')}
      >
        <MailIcon />
        Контакти
      </button>
    </nav>
  )
}
