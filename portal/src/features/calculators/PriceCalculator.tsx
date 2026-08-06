import { useState } from 'react'
import { calcMargin, formats } from '@/lib/catalog'
import { PRICE_ZONE_LABEL, type PriceZone } from '@/types/catalog'
import { int, money } from '@/lib/format'

/** Скільки заробляє точка, якщо тримає рекомендовану ціну. */
export function PriceCalculator() {
  const [formatKey, setFormatKey] = useState(formats[0].key)
  const [zone, setZone] = useState<PriceZone>('west')

  const format = formats.find((f) => f.key === formatKey) ?? formats[0]
  const result = calcMargin(format, zone)

  return (
    <>
      <div className="calc-row">
        <div style={{ flex: '1 1 230px' }}>
          <label className="field-label" htmlFor="price-format">
            Формат
          </label>
          <select
            id="price-format"
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
        <div style={{ flex: '0 1 230px' }}>
          <label className="field-label" htmlFor="price-zone">
            Зона
          </label>
          <select
            id="price-zone"
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

      <div className="out">
        <Out label="Закупівля з ПДВ" value={money(result.purchase)} unit="грн" />
        <Out label="Рекомендована ціна" value={money(result.rrp)} unit="грн" />
        <Out label="Заробіток з пляшки" value={money(result.profit)} unit="грн" />
        <Out label="Націнка" value={result.markupPct.toFixed(0)} unit="%" />
        <Out label="Маржа" value={result.marginPct.toFixed(0)} unit="%" />
        <Out label="З палети" value={int(result.profitPerPallet)} unit="грн" />
      </div>

      <p className="hint">
        Націнка — скільки додає точка до своєї закупівельної ціни з ПДВ. Маржа —
        частка заробітку в рекомендованій ціні продажу.
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
