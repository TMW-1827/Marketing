/** Інлайн-іконки: без мережевих запитів, працюють офлайн і в нативній обгортці. */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  )
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  )
}

/** Крапля — розділ про воду. */
export function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M12 3.5c3.2 3.6 5.5 6.6 5.5 9.4a5.5 5.5 0 0 1-11 0c0-2.8 2.3-5.8 5.5-9.4Z" />
    </svg>
  )
}

/** Цінник — розділ про ціни й канали. */
export function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M4 11.2V4.8a.8.8 0 0 1 .8-.8h6.4a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-6.4 6.4a1 1 0 0 1-1.4 0L4.3 12a1 1 0 0 1-.3-.8Z" />
      <path d="M8 8h.01" />
    </svg>
  )
}

/** Коробка — склад і логістика. */
export function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M20.5 7.8v8.4a1 1 0 0 1-.55.9l-7.5 3.6a1 1 0 0 1-.9 0l-7.5-3.6a1 1 0 0 1-.55-.9V7.8" />
      <path d="m3.7 7.4 8.3-3.9 8.3 3.9-8.3 3.9z" />
      <path d="M12 11.3V20" />
    </svg>
  )
}

/** Конверт — контакти й запити на співпрацю. */
export function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 7 8.2 6 8.2-6" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}
