import { useMemo, useState } from 'react'
import {
  EQUIPMENT,
  EQUIPMENT_KINDS,
  type Equipment,
  type EquipmentKind,
} from '@/data/equipment'
import { int } from '@/lib/format'

/**
 * Каталог торговельного обладнання.
 *
 * Силуети намальовані в одному масштабі для всіх позицій — так видно, що
 * стійка П2 вища за холодильник Power 250, а підставка поруч із ними майже
 * непомітна. Масштаб рахується від найвищої позиції, тому додавання нової
 * не ламає картинку.
 */

/** Висота найвищої позиції на екрані, px */
const TALLEST_PX = 168
const tallestMm = Math.max(...EQUIPMENT.map((e) => e.heightMm))
const SCALE = TALLEST_PX / tallestMm

const FILL: Record<EquipmentKind, string> = {
  Полиці: '#FFFFFF',
  Стійки: '#F2F6FA',
  Підставки: '#FFFFFF',
  Холодильники: '#E3EEF8',
}

const STROKE: Record<EquipmentKind, string> = {
  Полиці: '#9DB1C4',
  Стійки: '#8A8D8F',
  Підставки: '#9DB1C4',
  Холодильники: '#005EB8',
}

export function EquipmentCatalog() {
  const [kind, setKind] = useState<EquipmentKind | 'всі'>('всі')

  const visible = useMemo(
    () => EQUIPMENT.filter((e) => kind === 'всі' || e.kind === kind),
    [kind],
  )

  return (
    <>
      <div className="filters">
        <div className="filter-row" role="group" aria-label="Тип обладнання">
          <span className="filter-row__label">Тип</span>
          {(['всі', ...EQUIPMENT_KINDS] as const).map((option) => (
            <button
              type="button"
              key={option}
              className={`chip${option === kind ? ' chip--on' : ''}`}
              aria-pressed={option === kind}
              onClick={() => setKind(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="equip-grid">
        {visible.map((item) => (
          <EquipmentCard item={item} key={item.id} />
        ))}
      </div>

      <p className="hint">
        Силуети — в одному масштабі для всіх позицій, за фактичними габаритами
        з документів. Показано вигляд спереду: довжина × висота.
      </p>
    </>
  )
}

function EquipmentCard({ item }: { item: Equipment }) {
  const border = `1.5px solid ${STROKE[item.kind]}`

  return (
    <article className="equip">
      <div className="equip__stage">
        <div
          className="equip__shape"
          style={{
            width: Math.max(10, item.widthMm * SCALE),
            height: Math.max(4, item.heightMm * SCALE),
            background: FILL[item.kind],
            border,
          }}
          aria-hidden="true"
        >
          {item.kind === 'Холодильники' && (
            <span className="equip__door" style={{ borderColor: STROKE[item.kind] }} />
          )}
        </div>
        <span className="equip__floor" />
      </div>

      <h4 className="equip__name">{item.name}</h4>
      <div className="equip__kind">{item.kind}</div>

      <dl className="equip__dims">
        <div>
          <dt>Довжина</dt>
          <dd>{int(item.widthMm)} мм</dd>
        </div>
        <div>
          <dt>Глибина</dt>
          <dd>{int(item.depthMm)} мм</dd>
        </div>
        <div>
          <dt>Висота</dt>
          <dd>{int(item.heightMm)} мм</dd>
        </div>
      </dl>

      <p className="equip__use">{item.use}</p>
      {item.note && <p className="equip__note">{item.note}</p>}

      {item.specUrl && (
        <a
          className="equip__link"
          href={item.specUrl}
          target="_blank"
          rel="noreferrer"
        >
          Специфікація →
        </a>
      )}
    </article>
  )
}
