import { useMemo, useState } from 'react'
import {
  EQUIPMENT,
  EQUIPMENT_KINDS,
  type Equipment,
  type EquipmentKind,
} from '@/data/equipment'
import { driveFile } from '@/lib/drive'
import { DriveImage } from '@/components/DriveImage'
import { int } from '@/lib/format'

/**
 * Каталог торговельного обладнання.
 *
 * Основне зображення — фото або рендер позиції. Поруч із ним лишається
 * шкала висоти: усі позиції міряються від найвищої, тому видно, що стійка
 * П2 вища за холодильник Power 250, а підставка поруч із ними — смужка.
 * Фото цього не показують: кожне зняте у власному кадрі.
 *
 * Якщо фото не завантажилось (немає доступу, немає мережі), картка не
 * ламається: замість нього стає силует у тому самому масштабі.
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
        Габарити — фактичні, з документів. Смужка ліворуч від фото показує
        висоту позиції відносно найвищої в каталозі: фото цього не передають,
        бо кожне зняте у власному кадрі.
      </p>
    </>
  )
}

function EquipmentCard({ item }: { item: Equipment }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = Boolean(item.photoId) && !photoFailed
  const barHeight = Math.max(3, item.heightMm * SCALE)

  return (
    <article className="equip">
      <div className="equip__stage">
        <div
          className="equip__scale"
          title={`${int(item.heightMm)} мм заввишки`}
          aria-hidden="true"
        >
          <span style={{ height: barHeight }} />
        </div>

        <div className="equip__visual">
          {showPhoto ? (
            <DriveImage
              id={item.photoId as string}
              width={500}
              alt={item.name}
              onGiveUp={() => setPhotoFailed(true)}
            />
          ) : (
            <div
              className="equip__shape"
              style={{
                width: Math.max(10, item.widthMm * SCALE),
                height: barHeight,
                background: FILL[item.kind],
                border: `1.5px solid ${STROKE[item.kind]}`,
              }}
              aria-hidden="true"
            >
              {item.kind === 'Холодильники' && (
                <span
                  className="equip__door"
                  style={{ borderColor: STROKE[item.kind] }}
                />
              )}
            </div>
          )}
        </div>
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

      <div className="equip__links">
        {item.photoId && (
          <a href={driveFile(item.photoId)} target="_blank" rel="noreferrer">
            Зображення →
          </a>
        )}
        {item.specUrl && (
          <a href={item.specUrl} target="_blank" rel="noreferrer">
            Специфікація →
          </a>
        )}
      </div>
    </article>
  )
}
