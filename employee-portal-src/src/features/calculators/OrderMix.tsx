import { useMemo, useState } from 'react'
import { formats, sumOrder, type OrderLine } from '@/lib/catalog'
import { VEHICLES } from '@/data/vehicles'
import { PRICE_ZONE_LABEL, type PriceZone } from '@/types/catalog'
import { PRICE_REVISION } from '@/content/brand'
import { grouped, int, money } from '@/lib/format'

/**
 * Збірка змішаного замовлення.
 *
 * Єдиний віджет, за яким продажі й склад дивляться на одну й ту саму
 * цифру. Менеджер набирає замовлення в палетах і одразу бачить суму;
 * комірник за тим самим переліком бачить вагу, палетомісця й те, чи влізе
 * це в машину. Розбіжність «домовились на одне, поїхало інше» починається
 * саме тут — коли кожен рахує у своєму файлі.
 *
 * Палети можна вказувати дробові: 0,5 палети — це реальне замовлення, а от
 * палетомісце воно займає ціле, і саме так воно й рахується.
 */
export function OrderMix() {
  const [lines, setLines] = useState<OrderLine[]>([
    { formatKey: 'g15', pallets: 4 },
    { formatKey: 'g05', pallets: 2 },
  ])
  const [zone, setZone] = useState<PriceZone>('west')
  const [vehicleId, setVehicleId] = useState(VEHICLES[1].id)

  const totals = useMemo(() => sumOrder(lines, zone), [lines, zone])
  const vehicle = VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0]

  const overWeight = totals.weightKg > vehicle.payloadKg
  const overPlaces = totals.places > vehicle.places
  const unused = formats.filter(
    (f) => !lines.some((l) => l.formatKey === f.key),
  )

  const setLine = (index: number, patch: Partial<OrderLine>) =>
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    )

  return (
    <>
      <div className="mix">
        {lines.map((line, i) => {
          const format = formats.find((f) => f.key === line.formatKey)
          return (
            <div className="mix__row" key={i}>
              <select
                aria-label={`Формат, рядок ${i + 1}`}
                value={line.formatKey}
                onChange={(e) => setLine(i, { formatKey: e.target.value })}
              >
                {formats.map((f) => (
                  <option value={f.key} key={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                aria-label={`Палет, рядок ${i + 1}`}
                value={line.pallets}
                onChange={(e) =>
                  setLine(i, { pallets: Math.max(0, Number(e.target.value) || 0) })
                }
              />
              <span className="mix__unit">палет</span>
              <span className="mix__weight">
                {format ? grouped(line.pallets * format.source.weightPalletKg) : '—'}{' '}
                кг
              </span>
              <button
                type="button"
                className="mix__remove"
                aria-label={`Прибрати рядок ${i + 1}`}
                onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className="button-row">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={unused.length === 0}
          onClick={() =>
            setLines((prev) => [...prev, { formatKey: unused[0].key, pallets: 1 }])
          }
        >
          + Додати позицію
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setLines([])}
        >
          Очистити
        </button>
      </div>

      <div className="calc-row" style={{ marginTop: 14 }}>
        <div style={{ flex: '1 1 220px' }}>
          <label className="field-label" htmlFor="mix-zone">
            Цінова зона
          </label>
          <select
            id="mix-zone"
            value={zone}
            onChange={(e) => setZone(e.target.value as PriceZone)}
          >
            {(['west', 'east'] as const).map((z) => (
              <option value={z} key={z}>
                {PRICE_ZONE_LABEL[z]}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <label className="field-label" htmlFor="mix-vehicle">
            Транспорт
          </label>
          <select
            id="mix-vehicle"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            {VEHICLES.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="empty">Додайте хоча б одну позицію.</p>
      ) : (
        <>
          <div className="out out--money">
            <Out label="Палет" value={grouped(totals.pallets, 2)} />
            <Out label="Палетомісць" value={`${totals.places}`} />
            <Out label="Упаковок" value={grouped(totals.cases)} />
            <Out label="Пляшок" value={int(totals.bottles)} />
            <Out label="Вага брутто" value={grouped(totals.weightKg)} unit="кг" />
            <Out label="Об’єм води" value={grouped(totals.litres)} unit="л" />
            <Out label="Сума без ПДВ" value={money(totals.net)} unit="грн" />
            <Out label="Сума з ПДВ" value={money(totals.gross)} unit="грн" />
          </div>

          <div className="out-gap">
            {overWeight || overPlaces ? (
              <>
                <b>Не влізе в {vehicle.name.toLowerCase()}.</b>{' '}
                {overWeight && (
                  <>
                    Перевищення за вагою:{' '}
                    <b>{grouped(totals.weightKg - vehicle.payloadKg)}</b> кг.{' '}
                  </>
                )}
                {overPlaces && (
                  <>
                    Не вистачає <b>{totals.places - vehicle.places}</b>{' '}
                    палетомісць.{' '}
                  </>
                )}
                Знімайте важкі формати або діліть на два рейси.
              </>
            ) : (
              <>
                Влізе в {vehicle.name.toLowerCase()}: зайнято{' '}
                <b>{totals.places}</b> із {vehicle.places} палетомісць і{' '}
                <b>{grouped(totals.weightKg)}</b> кг із{' '}
                {grouped(vehicle.payloadKg)} кг. Запас за вагою —{' '}
                {grouped(vehicle.payloadKg - totals.weightKg)} кг.
              </>
            )}
          </div>
        </>
      )}

      <p className="hint">
        Палетомісце рахується цілим: 0,5 палети займає в кузові стільки ж
        підлоги, скільки повна. Суми — за прайсом дистриб’ютора, редакція:{' '}
        {PRICE_REVISION}; це орієнтир для розмови, а не рахунок — рахунок
        виставляє бухгалтерія за договірними умовами клієнта.
      </p>
    </>
  )
}

function Out({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div>
      <span>{label}</span>
      <b>
        {value}
        {unit && <small> {unit}</small>}
      </b>
    </div>
  )
}
