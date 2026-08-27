import { useMemo, useState } from 'react'
import { calcPallet, costOf, formats, type PalletUnit } from '@/lib/catalog'
import { PRICE_ZONE_LABEL, type PriceZone } from '@/types/catalog'
import { PRICE_REVISION } from '@/content/brand'
import { grouped, int, money } from '@/lib/format'
import { PalletGap } from './PalletGap'

const UNITS: Array<{ value: PalletUnit; label: string }> = [
  { value: 'bottle', label: 'пляшок' },
  { value: 'case', label: 'упаковок' },
  { value: 'pallet', label: 'палет' },
  { value: 'litre', label: 'літрів' },
]

/**
 * Скільки води на захід і скільки вона нам коштує.
 *
 * Той самий розрахунок, що й у калькуляторі палети, плюс головне число
 * спонсорської розмови — **вартість**. Спонсорство — це не «дамо води»,
 * а конкретна сума в гривнях, і назвати її треба до того, як щось обіцяно:
 * узгоджує спонсорський бюджет не менеджер, а комерційний відділ, і
 * узгоджує він саме суму.
 *
 * Ціна залежить від зони доставки, тому зона тут окремим полем: та сама
 * палета для заходу в Дніпрі коштує більше, ніж для заходу у Львові.
 */
export function EventWater() {
  const [formatKey, setFormatKey] = useState('g05')
  const [quantity, setQuantity] = useState('600')
  const [unit, setUnit] = useState<PalletUnit>('bottle')
  const [zone, setZone] = useState<PriceZone>('west')

  const format = formats.find((f) => f.key === formatKey) ?? formats[0]
  const result = useMemo(
    () => calcPallet(format, Math.max(1, parseFloat(quantity) || 1), unit),
    [format, quantity, unit],
  )
  const cost = costOf(format, result.bottles, zone)

  return (
    <>
      <div className="calc-row">
        <div style={{ flex: '2 1 220px' }}>
          <label className="field-label" htmlFor="event-format">
            Формат
          </label>
          <select
            id="event-format"
            value={formatKey}
            onChange={(e) => setFormatKey(e.target.value)}
          >
            {formats.map((f) => (
              <option value={f.key} key={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 1 130px' }}>
          <label className="field-label" htmlFor="event-qty">
            Кількість
          </label>
          <input
            id="event-qty"
            type="number"
            min={1}
            step={1}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <label className="field-label" htmlFor="event-unit">
            Одиниця
          </label>
          <select
            id="event-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as PalletUnit)}
          >
            {UNITS.map((u) => (
              <option value={u.value} key={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 210px' }}>
          <label className="field-label" htmlFor="event-zone">
            Цінова зона
          </label>
          <select
            id="event-zone"
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
      </div>

      <div className="out out--money">
        <Out label="Пляшок" value={int(result.bottles)} />
        <Out label="Упаковок" value={grouped(result.cases)} />
        <Out label="Палет" value={grouped(result.pallets, 2)} />
        <Out label="Об’єм води" value={grouped(result.litres)} unit="л" />
        <Out label="Вага брутто" value={grouped(result.weightKg)} unit="кг" />
        <Out label="Витрати без ПДВ" value={money(cost.net)} unit="грн" />
        <Out label="Витрати з ПДВ" value={money(cost.gross)} unit="грн" />
      </div>

      <PalletGap
        result={result}
        unit={unit}
        formatLabel={format.label}
        litres={format.litres}
      />

      <p className="hint">
        Витрати рахуються за прайсом дистриб’ютора обраної зони, редакція:{' '}
        {PRICE_REVISION}. Це вартість самої води — доставка, брендування,
        обладнання й робота персоналу в неї не входять і рахуються окремо.
        Цифра потрібна, щоб назвати комерційному відділу суму, а не «трохи
        води на захід».
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
