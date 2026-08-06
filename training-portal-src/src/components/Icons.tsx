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

export function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  )
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
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

export function OfflineIcon() {
  return (
    <svg viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M12 19.5h.01M5 12.5a9.9 9.9 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M3 3l18 18" />
    </svg>
  )
}
