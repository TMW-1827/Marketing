import { useCallback, useEffect, useRef, useState } from 'react'
import type { Format } from '@/types/catalog'
import { dec } from '@/lib/format'

export interface TooltipState {
  format: Format
  left: number
  top: number
}

/**
 * Підказка з габаритами пляшки.
 *
 * На сенсорних екранах ховається сама через кілька секунд: там немає події
 * «курсор пішов», а залишена підказка перекриває каталог.
 */
export function useTooltip() {
  const [state, setState] = useState<TooltipState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    setState(null)
  }, [])

  const show = useCallback((anchor: HTMLElement, format: Format) => {
    const rect = anchor.getBoundingClientRect()
    const width = 232
    const height = 210
    let left = rect.left + rect.width / 2 - width / 2
    left = Math.max(10, Math.min(left, window.innerWidth - width - 10))
    let top = rect.top - height - 10
    if (top < 10) top = rect.bottom + 10

    setState({ format, left, top })

    window.clearTimeout(timer.current)
    if (window.matchMedia('(hover: none)').matches) {
      timer.current = window.setTimeout(() => setState(null), 2600)
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const onScroll = () => setState(null)
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [state])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { state, show, hide }
}

export function BottleTooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null
  const { format } = state
  const sku = format.source

  const subtitle = [
    format.carbonations.join(', '),
    format.key === 'g075s' ? 'корок фліп-топ' : null,
    sku.line === 'Особлива' ? 'питна оброблена' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="tooltip" role="tooltip" style={{ left: state.left, top: state.top }}>
      <b className="tooltip__title">
        {sku.line === 'Особлива' && 'Особлива '}
        {sku.volume} {sku.packaging}
        {sku.line === 'SPORT' && ' SPORT'}
      </b>
      <div className="tooltip__sub">{subtitle}</div>
      <Row label="Ширина" value={`${dec(sku.bottleWidthCm, 1)} см`} />
      <Row label="Висота" value={`${dec(sku.bottleHeightCm, 1)} см`} />
      <Row label="Вага брутто" value={`${dec(sku.weightBottleKg, 3)} кг`} />
      <Row label="Пляшок в упаковці" value={String(sku.bottlesPerCase)} />
      <Row label="Пляшок на палеті" value={String(sku.bottlesPerPallet)} />
      <Row
        label="Упаковок на палеті"
        value={String(sku.bottlesPerPallet / sku.bottlesPerCase)}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="tooltip__row">
      <span>{label}</span>
      <i>{value}</i>
    </div>
  )
}
