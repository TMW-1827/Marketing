import { useEffect, useRef } from 'react'
import { skuById } from '@/lib/catalog'
import { dec } from '@/lib/format'
import { closeSku, useSelectedSkuId } from './store'

/**
 * Картка товару.
 *
 * На телефоні відкривається як нижня шторка (звична мобільна модель),
 * на десктопі — як діалог по центру. Рендериться в оболонці застосунку,
 * тому відкрити її можна і з каталогу, і з результатів пошуку.
 *
 * Показує лише сталі характеристики з паспорта товару. Комерційні умови
 * сюди не потрапляють: портал зовнішній, а ціна залежить від договору.
 */
export function SkuSheet() {
  const id = useSelectedSkuId()
  const sku = id === null ? undefined : skuById(id)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sku) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSku()
    }
    document.addEventListener('keydown', onKey)

    // Фон не має прокручуватись під відкритою шторкою.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [sku])

  if (!sku) return null

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSku()
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Картка товару ${sku.name}`}
        tabIndex={-1}
        ref={panelRef}
      >
        <button
          type="button"
          className="sheet__close"
          onClick={closeSku}
          aria-label="Закрити"
        >
          ×
        </button>
        <div className="sheet__grip" aria-hidden="true" />

        <div className="eyebrow">{sku.category}</div>
        <h3 style={{ fontSize: 28, marginBottom: 4 }}>
          {sku.line === 'Особлива' && 'Особлива '}
          {sku.volume} {sku.packaging}
        </h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          {sku.carbonation}
          {sku.line === 'SPORT' && ' · лінійка SPORT'}
        </p>

        {sku.note && <div className="note note--info">{sku.note}</div>}

        <dl className="definitions">
          <Row label="Штрих-код одиниці" value={sku.ean} mono />
          <Row label="Штрих-код упаковки" value={sku.eanCase} mono />
          <Row label="Код УКТЗЕД" value={sku.uktzed} mono />
          <Row label="Термін придатності" value={`${sku.shelfLifeMonths} місяців`} />
          <Row label="Зберігання" value="+2…+25 °C" />
          <Row
            label="Габарити пляшки (Ш×В)"
            value={`${dec(sku.bottleWidthCm, 1)} × ${dec(sku.bottleHeightCm, 1)} см`}
            mono
          />
          <Row
            label="Вага брутто одиниці"
            value={`${dec(sku.weightBottleKg, 3)} кг`}
            mono
          />
          <Row label="Пляшок в упаковці" value={String(sku.bottlesPerCase)} />
          <Row label="Вага упаковки" value={`${dec(sku.weightCaseKg, 2)} кг`} mono />
          <Row label="Упаковок у шарі" value={String(sku.casesPerLayer)} />
          <Row label="Шарів на палеті" value={String(sku.layersPerPallet)} />
          <Row label="Пляшок на палеті" value={String(sku.bottlesPerPallet)} />
          <Row
            label="Упаковок на палеті"
            value={String(sku.bottlesPerPallet / sku.bottlesPerCase)}
          />
          <Row
            label="Вага палети брутто"
            value={`${dec(sku.weightPalletKg, 2)} кг`}
            mono
          />
        </dl>

        <div className="note note--info">
          <b>Комерційні умови</b>
          Ціни, обсяги та умови постачання узгоджуються індивідуально —
          напишіть нам через розділ «Контакти».
        </div>

        {sku.line === 'Особлива' && (
          <div className="note note--warn" style={{ marginBottom: 0 }}>
            <b>Увага</b>
            Це питна оброблена вода, а не мінеральна. Не використовуйте для неї
            аргументи про мінералізацію та pH мінеральної лінійки.
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </>
  )
}
