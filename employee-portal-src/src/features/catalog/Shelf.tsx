import { useEffect, useRef, useState } from 'react'
import { formats } from '@/lib/catalog'
import type { Carbonation } from '@/types/catalog'
import { setFilters } from './store'
import { BottleTooltip, useTooltip } from './BottleTooltip'
import { CarbonationDot, CarbonationDots } from './CarbonationDot'

/** Порядок газацій у легенді — від найлегшої до найгазованішої. */
const CARBONATIONS: Carbonation[] = [
  'негазована',
  'слабогазована',
  'сильногазована',
]

/**
 * Полиця з форматами в реальному масштабі.
 *
 * Один силует на формат: усі газації одного об'єму розливаються в однакову
 * пляшку. Масштаб перераховується під фактичну ширину контейнера, щоб лінійка
 * вміщалась без горизонтальної прокрутки — на телефоні це критично.
 */

const MIN_SCALE = 2.6
const MAX_SCALE = 5.4

export function Shelf() {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(MAX_SCALE)
  const [narrow, setNarrow] = useState(false)
  const tooltip = useTooltip()

  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    const recalc = () => {
      const width = box.clientWidth
      if (!width) return
      const isNarrow = width <= 560
      const gap = isNarrow ? 10 : 14
      const separator = isNarrow ? 13 : 21
      const padding = isNarrow ? 28 : 40

      const totalCm = formats.reduce((sum, f) => sum + f.source.bottleWidthCm, 0)
      const fixed = gap * (formats.length - 1) + separator
      const available = width - padding - fixed

      setNarrow(isNarrow)
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, available / totalCm)))
    }

    recalc()
    // ResizeObserver, а не resize на window: у мобільному WebView поява
    // адресного рядка змінює висоту, але не ширину — зайвих перемальовок немає.
    const observer = new ResizeObserver(recalc)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const gap = narrow ? 10 : 14
  const separator = narrow ? 13 : 21
  const glass = formats.filter((f) => f.source.packaging === 'Скло')
  const pet = formats.filter((f) => f.source.packaging !== 'Скло')
  const spanOf = (list: typeof formats) =>
    list.reduce((sum, f) => sum + f.source.bottleWidthCm * scale, 0) +
    gap * (list.length - 1)

  return (
    <div className="shelf" ref={boxRef}>
      <div className="shelf__header">
        <span style={{ width: spanOf(glass) }}>Скло</span>
        {/* Проміжок між групами: два флекс-відступи, поля розділювача і його 1px */}
        <i style={{ width: gap + separator + 1 }} />
        <span style={{ width: spanOf(pet) }}>ПЕТ</span>
      </div>

      <div className="shelf__row" style={{ gap }}>
        {formats.map((format, i) => {
          const sku = format.source
          const isGlass = sku.packaging === 'Скло'
          const prev = formats[i - 1]
          const needsSeparator = prev && (prev.source.packaging === 'Скло') !== isGlass

          const fill = isGlass ? '#E3EEF8' : '#FFFFFF'
          const stroke = isGlass ? '#7FA3C4' : '#9DB1C4'
          const border = `1.5px ${isGlass ? 'dashed' : 'solid'} ${stroke}`

          return (
            <div key={format.key} style={{ display: 'contents' }}>
              {needsSeparator && (
                <span
                  className="shelf__separator"
                  style={{ marginInline: (separator - gap) / 2 }}
                />
              )}
              <button
                type="button"
                className="bottle"
                style={{ width: sku.bottleWidthCm * scale }}
                aria-label={`${format.label}. Показати габарити й палетні дані`}
                onMouseEnter={(e) => tooltip.show(e.currentTarget, format)}
                onMouseLeave={tooltip.hide}
                onFocus={(e) => tooltip.show(e.currentTarget, format)}
                onBlur={tooltip.hide}
                onClick={(e) => {
                  // На сенсорному екрані наведення не існує: дотик показує
                  // підказку й одночасно фільтрує каталог на цей формат.
                  tooltip.show(e.currentTarget, format)
                  setFilters({
                    volume: sku.volume,
                    packaging: sku.packaging,
                    carbonation: 'всі',
                  })
                  document
                    .getElementById('sku-grid')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                <span
                  className="bottle__cap"
                  style={{ background: fill, border, borderBottom: 0 }}
                />
                <span
                  className="bottle__neck"
                  style={{
                    background: fill,
                    borderLeft: border,
                    borderRight: border,
                  }}
                />
                <span
                  className="bottle__body"
                  style={{
                    height: (sku.bottleHeightCm - 2.5) * scale,
                    background: fill,
                    border,
                  }}
                />
                <span className="bottle__label">
                  {sku.volume.replace(' л', '')}
                  {format.key === 'g075s' && <em> S</em>}
                  <br />
                  <CarbonationDots carbonations={format.carbonations} />
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <div className="shelf__base" />

      <div className="legend">
        <span>
          <i style={{ background: '#E3EEF8', border: '1.5px dashed #7FA3C4' }} />{' '}
          скло
        </span>
        <span>
          <i style={{ background: '#FFFFFF', border: '1.5px solid #9DB1C4' }} />{' '}
          ПЕТ
        </span>
        {/* Ті самі кольори, що й на картках позицій нижче по сторінці */}
        {CARBONATIONS.map((carbonation) => (
          <span key={carbonation}>
            <CarbonationDot carbonation={carbonation} /> {carbonation}
          </span>
        ))}
        <span>
          <b style={{ color: 'var(--red)' }}>S</b> — лінійка SPORT
        </span>
      </div>

      <p className="shelf__note">
        Один силует на кожен формат — усі газації одного об’єму розливаються в
        однакову пляшку. Кружечки під об’ємом показують, які газації бувають
        у цьому форматі. Торкніться пляшки, щоб побачити розміри й палетні дані.
      </p>

      <BottleTooltip state={tooltip.state} />
    </div>
  )
}
