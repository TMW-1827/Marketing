import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { search, type SearchHit } from '@/lib/search'
import { openSku } from '@/features/catalog/store'
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery'
import { CloseIcon, SearchIcon } from './Icons'

/**
 * Пошук по розділах, товарах і глосарію.
 *
 * На десктопі — інлайн-поле з випадним списком. На телефоні — повноекранна
 * панель: список результатів має бути читабельним, а клавіатура не повинна
 * перекривати половину видачі.
 */
export function Search() {
  const isDesktop = useMediaQuery(DESKTOP)
  const [open, setOpen] = useState(false)

  if (isDesktop) return <SearchField variant="inline" />

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Пошук"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </button>
      {open && (
        <div className="search-overlay">
          <div className="search-overlay__bar">
            <SearchField variant="overlay" autoFocus onDone={() => setOpen(false)} />
            <button
              type="button"
              className="icon-btn"
              aria-label="Закрити пошук"
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function SearchField({
  variant,
  autoFocus,
  onDone,
}: {
  variant: 'inline' | 'overlay'
  autoFocus?: boolean
  onDone?: () => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [focused, setFocused] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => search(query), [query])
  const showList = variant === 'overlay' ? query.length >= 2 : focused && hits.length > 0

  useEffect(() => setActive(-1), [query])

  useEffect(() => {
    if (variant !== 'inline') return
    const onClickOutside = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [variant])

  const go = (hit: SearchHit) => {
    setQuery('')
    setFocused(false)
    onDone?.()
    if (hit.type === 'sku') {
      openSku(hit.id)
      return
    }
    if (hit.type === 'glossary') {
      navigate('/reference')
      return
    }
    navigate(`/${hit.id}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      const hit = hits[active] ?? hits[0]
      if (hit) go(hit)
    } else if (e.key === 'Escape') {
      setQuery('')
      onDone?.()
    }
  }

  return (
    <div className={`searchbox searchbox--${variant}`} ref={boxRef}>
      <span className="searchbox__icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <input
        type="search"
        value={query}
        autoFocus={autoFocus}
        placeholder="Штрих-код, об’єм, термін або розділ"
        aria-label="Пошук по порталу"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={onKeyDown}
      />
      {query && (
        <button
          type="button"
          className="searchbox__clear"
          aria-label="Очистити пошук"
          onClick={() => setQuery('')}
        >
          ×
        </button>
      )}

      {showList && (
        <div className="searchres" role="listbox">
          {hits.map((hit, i) => (
            <button
              type="button"
              key={`${hit.type}-${hit.id}`}
              className={i === active ? 'is-active' : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(hit)}
            >
              {hit.title}
              <span className="searchres__hint">
                {hit.type === 'section'
                  ? 'Розділ'
                  : hit.type === 'sku'
                    ? 'Товар'
                    : 'Глосарій'}{' '}
                · {hit.hint}
              </span>
            </button>
          ))}
          {hits.length === 0 && (
            <div className="searchres__empty">
              Нічого не знайшли. Спробуйте частину штрих-коду, об’єм або
              назву розділу.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
