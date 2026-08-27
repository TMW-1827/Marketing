import { useMemo, useState } from 'react'
import { calcPallet, formats, type PalletUnit } from '@/lib/catalog'
import { BOTTLE_FORMS, CASE_FORMS, grouped, int, plural } from '@/lib/format'

const UNITS: Array<{ value: PalletUnit; label: string }> = [
  { value: 'bottle', label: 'пляшок' },
  { value: 'case', label: 'упаковок' },
  { value: 'pallet', label: 'палет' },
  { value: 'litre', label: 'літрів' },
]

const PALLET_FULL_FORMS: [string, string, string] = [
  'повна палета',
  'повні палети',
  'повних палет',
]

/** Рахує в обидва боки: пляшки ↔ упаковки ↔ палети. */
export function PalletCalculator() {
  const [formatKey, setFormatKey] = useState(formats[0].key)
  const [quantity, setQuantity] = useState('1200')
  const [unit, setUnit] = useState<PalletUnit>('bottle')

  const format = formats.find((f) => f.key === formatKey) ?? formats[0]
  const result = useMemo(
    () => calcPallet(format, Math.max(1, parseFloat(quantity) || 1), unit),
    [format, quantity, unit],
  )

  return (
    <>
      <div className="calc-row">
        <div style={{ flex: '2 1 230px' }}>
          <label className="field-label" htmlFor="pallet-format">
            Формат
          </label>
          <select
            id="pallet-format"
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
          <label className="field-label" htmlFor="pallet-qty">
            Кількість
          </label>
          <input
            id="pallet-qty"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <label className="field-label" htmlFor="pallet-unit">
            Одиниця
          </label>
          <select
            id="pallet-unit"
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
      </div>

      <div className="out">
        <Out label="Пляшок" value={int(result.bottles)} />
        <Out label="Упаковок" value={grouped(result.cases)} />
        <Out label="Шарів" value={int(result.layers)} />
        {/* Палети — з двома знаками: частка палети є ключовою цифрою
            в замовленні, і при одному знаку дрібні партії давали «0» */}
        <Out label="Палет" value={grouped(result.pallets, 2)} />
        <Out label="Вага брутто" value={grouped(result.weightKg)} unit="кг" />
        <Out label="Об’єм води" value={grouped(result.litres)} unit="л" />
      </div>

      <div className="out-gap">
        <PalletGap result={result} bottlesPerCase={format.source.bottlesPerCase} />
      </div>

      <p className="hint">
        Вага рахується від ваги брутто повної палети з піддоном; неповна палета —
        пропорційно до кількості упаковок. Шари заокруглені вгору: неповний шар
        усе одно займає на палеті цілий.
        {unit === 'litre' &&
          ' Пляшки рахуються цілими, тому фактичний об’єм може трохи перевищити заданий.'}
      </p>
    </>
  )
}

function PalletGap({
  result,
  bottlesPerCase,
}: {
  result: ReturnType<typeof calcPallet>
  bottlesPerCase: number
}) {
  const { fullPallets, remainderCases, casesToFullPallet, casesPerPallet } = result

  if (remainderCases === 0) {
    return (
      <>
        Рівно <b>{fullPallets}</b>{' '}
        {plural(fullPallets, PALLET_FULL_FORMS)} — залишків немає.
      </>
    )
  }

  const missingBottles = casesToFullPallet * bottlesPerCase
  return (
    <>
      {fullPallets > 0 && (
        <>
          <b>{fullPallets}</b> {plural(fullPallets, PALLET_FULL_FORMS)} +{' '}
        </>
      )}
      неповна палета: <b>{remainderCases}</b> {plural(remainderCases, CASE_FORMS)}{' '}
      з {casesPerPallet}. Щоб закрити палету, не вистачає{' '}
      <b>{casesToFullPallet}</b> {plural(casesToFullPallet, CASE_FORMS)} (
      {int(missingBottles)} {plural(missingBottles, BOTTLE_FORMS)}).
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
