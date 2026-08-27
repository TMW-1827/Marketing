import { useMemo, useState } from 'react'
import {
  ORDER_UNIT_LABEL,
  skus,
  summarizeOrder,
  viewLine,
  type OrderLine,
  type OrderUnit,
} from '@/lib/catalog'
import { VEHICLES } from '@/data/vehicles'
import { PRICE_ZONE_LABEL, type PriceZone } from '@/types/catalog'
import { PRICE_REVISION } from '@/content/brand'
import { grouped, int, money } from '@/lib/format'
import { CarbonationDot } from '@/features/catalog/CarbonationDot'

/**
 * Збірка замовлення.
 *
 * Єдиний віджет, за яким продажі й склад дивляться на одну й ту саму
 * цифру. Менеджер набирає замовлення й одразу бачить суму; комірник за тим
 * самим переліком бачить пляшки, вагу й палетомісця. Розбіжність
 * «домовились на одне, поїхало інше» починається саме тут — коли кожен
 * рахує у своєму файлі.
 *
 * Три речі, через які віджет виглядає саме так:
 *
 *  1. Рядок — це **позиція**, а не формат. Негазована й сильногазована
 *     0,5 л мають різні штрих-коди, і склад збирає саме їх; за форматом
 *     не видно, що класти на палету.
 *  2. Кількість — у палетах **або в упаковках**. Точка замовляє
 *     упаковками, дистриб'ютор — палетами, і перераховувати в голові
 *     посеред розмови ніхто не буде.
 *  3. Машина возить **кількох клієнтів одразу**, тому підсумок є і по
 *     кожному, і загальний. Палетомісця рахуються по клієнтах: чужий
 *     товар на одну палету не домішують.
 */
export function OrderMix() {
  const [lines, setLines] = useState<OrderLine[]>([
    { skuId: 8, qty: 4, unit: 'pallet', client: 'Дистриб’ютор «Захід»' },
    { skuId: 1, qty: 2, unit: 'pallet', client: 'Дистриб’ютор «Захід»' },
    { skuId: 14, qty: 30, unit: 'case', client: 'Ресторан «Карпати»' },
  ])
  const [zone, setZone] = useState<PriceZone>('west')
  const [vehicleId, setVehicleId] = useState(VEHICLES[1].id)

  const summary = useMemo(() => summarizeOrder(lines, zone), [lines, zone])
  const vehicle = VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0]

  const { total, clients } = summary
  const overWeight = total.weightKg > vehicle.payloadKg
  const overPlaces = total.places > vehicle.places

  const setLine = (index: number, patch: Partial<OrderLine>) =>
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    )

  const addLine = () => {
    // Новий рядок — тому ж клієнту, що й попередній: у замовленні одного
    // клієнта позицій зазвичай кілька, і передруковувати ім'я щоразу зайве.
    const last = lines[lines.length - 1]
    setLines((prev) => [
      ...prev,
      { skuId: skus[0].id, qty: 1, unit: 'pallet', client: last?.client ?? '' },
    ])
  }

  return (
    <>
      <div className="mix">
        {lines.map((line, i) => {
          const sku = skus.find((s) => s.id === line.skuId) ?? skus[0]
          const view = viewLine(sku, line.qty, line.unit, zone)

          return (
            <div className="mix__row" key={i}>
              <CarbonationDot
                carbonation={sku.carbonation}
                className="mix__dot"
              />

              <select
                className="mix__sku"
                aria-label={`Позиція, рядок ${i + 1}`}
                value={line.skuId}
                onChange={(e) => setLine(i, { skuId: Number(e.target.value) })}
              >
                {skus.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <input
                className="mix__client"
                type="text"
                placeholder="Клієнт"
                aria-label={`Клієнт, рядок ${i + 1}`}
                value={line.client}
                onChange={(e) => setLine(i, { client: e.target.value })}
              />

              <input
                className="mix__qty"
                type="number"
                min={0}
                step={line.unit === 'pallet' ? 0.5 : 1}
                inputMode="decimal"
                aria-label={`Кількість, рядок ${i + 1}`}
                value={line.qty}
                onChange={(e) =>
                  setLine(i, { qty: Math.max(0, Number(e.target.value) || 0) })
                }
              />

              <select
                className="mix__unit"
                aria-label={`Одиниця, рядок ${i + 1}`}
                value={line.unit}
                onChange={(e) =>
                  setLine(i, { unit: e.target.value as OrderUnit })
                }
              >
                {(['pallet', 'case'] as const).map((u) => (
                  <option value={u} key={u}>
                    {ORDER_UNIT_LABEL[u]}
                  </option>
                ))}
              </select>

              <span className="mix__bottles">
                <b>{int(view.bottles)}</b> пляшок · {grouped(view.weightKg)} кг
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
        <button type="button" className="btn btn--ghost" onClick={addLine}>
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

      {clients.length === 0 ? (
        <p className="empty">Додайте хоча б одну позицію.</p>
      ) : (
        <>
          {clients.length > 1 && (
            <div className="tablewrap" style={{ marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Клієнт</th>
                    <th className="num">Позицій</th>
                    <th className="num">Пляшок</th>
                    <th className="num">Палет</th>
                    <th className="num">Місць</th>
                    <th className="num">Вага, кг</th>
                    <th className="num">Сума з ПДВ</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.client}>
                      <td>{client.client}</td>
                      <td className="num">{client.positions}</td>
                      <td className="num">{int(client.bottles)}</td>
                      <td className="num">{grouped(client.pallets, 2)}</td>
                      <td className="num">
                        <b>{client.places}</b>
                      </td>
                      <td className="num">{grouped(client.weightKg)}</td>
                      <td className="num">{money(client.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="out out--money">
            <Out label="Клієнтів" value={`${clients.length}`} />
            <Out label="Палет" value={grouped(total.pallets, 2)} />
            <Out label="Палетомісць" value={`${total.places}`} />
            <Out label="Упаковок" value={grouped(total.cases)} />
            <Out label="Пляшок" value={int(total.bottles)} />
            <Out label="Вага брутто" value={grouped(total.weightKg)} unit="кг" />
            <Out label="Сума без ПДВ" value={money(total.net)} unit="грн" />
            <Out label="Сума з ПДВ" value={money(total.gross)} unit="грн" />
          </div>

          <div className="out-gap">
            {overWeight || overPlaces ? (
              <>
                <b>Не влізе.</b> {vehicle.name}:{' '}
                {overWeight && (
                  <>
                    Перевищення за вагою:{' '}
                    <b>{grouped(total.weightKg - vehicle.payloadKg)}</b> кг.{' '}
                  </>
                )}
                {overPlaces && (
                  <>
                    Не вистачає <b>{total.places - vehicle.places}</b>{' '}
                    палетомісць.{' '}
                  </>
                )}
                Знімайте важкі позиції або діліть на два рейси.
              </>
            ) : (
              <>
                <b>Влізе.</b> {vehicle.name}: зайнято <b>{total.places}</b> із{' '}
                {vehicle.places} палетомісць і <b>{grouped(total.weightKg)}</b>{' '}
                кг із {grouped(vehicle.payloadKg)} кг. Запас за вагою —{' '}
                {grouped(vehicle.payloadKg - total.weightKg)} кг.
                {total.places > total.pallets + 0.01 && (
                  <>
                    {' '}
                    Порожнього ходу —{' '}
                    <b>{grouped(total.places - total.pallets, 2)}</b>{' '}
                    палетомісця: стільки дають неповні палети.
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      <p className="hint">
        Палетомісце рахується цілим і <b>окремо на кожного клієнта</b>: позиції
        одного клієнта складають на спільну мікс-палету, чужий товар до них не
        домішують. Суми — за прайсом дистриб’ютора, редакція: {PRICE_REVISION};
        ціна однакова для всіх дистриб’юторів. Це орієнтир для розмови, а не
        рахунок — рахунок виставляє бухгалтерія за договірними умовами клієнта.
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
