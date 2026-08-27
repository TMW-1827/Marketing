import { useState } from 'react'
import { calcMargin, formats, PRICE_BASE_LABEL, type PriceBase } from '@/lib/catalog'
import { PRICE_ZONE_LABEL, type PriceZone } from '@/types/catalog'
import { PRICE_REVISION } from '@/content/brand'
import { int, money } from '@/lib/format'

/**
 * Скільки заробляє точка, якщо тримає рекомендовану ціну.
 *
 * Головний інструмент розмови про гроші: замість «у нас вигідно» менеджер
 * показує конкретну гривню з пляшки й конкретну суму з палети. Націнка й
 * маржа стоять поруч навмисно — їх постійно плутають, і клієнт теж.
 *
 * База закупівлі перемикається, бо точки бувають різні: платник ПДВ рахує
 * від ціни без податку, неплатник — від повної. Рахувати «за замовчуванням»
 * не можна: різниця в націнці помітна, і клієнт її одразу побачить.
 */
export function PriceCalculator() {
  const [formatKey, setFormatKey] = useState(formats[0].key)
  const [zone, setZone] = useState<PriceZone>('west')
  const [base, setBase] = useState<PriceBase>('gross')

  const format = formats.find((f) => f.key === formatKey) ?? formats[0]
  const result = calcMargin(format, zone, base)

  return (
    <>
      <div className="calc-row">
        <div style={{ flex: '2 1 220px' }}>
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
        <div style={{ flex: '2 1 220px' }}>
          <label className="field-label" htmlFor="price-zone">
            Цінова зона
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
        <div style={{ flex: '1 1 170px' }}>
          <label className="field-label" htmlFor="price-base">
            Ціна закупівлі
          </label>
          <select
            id="price-base"
            value={base}
            onChange={(e) => setBase(e.target.value as PriceBase)}
          >
            {(['gross', 'net'] as const).map((b) => (
              <option value={b} key={b}>
                {PRICE_BASE_LABEL[b]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="out">
        <Out
          label={`Закупівля ${PRICE_BASE_LABEL[base]}`}
          value={money(result.purchase)}
          unit="грн"
        />
        <Out label="Рекомендована ціна" value={money(result.rrp)} unit="грн" />
        <Out label="Заробіток з пляшки" value={money(result.profit)} unit="грн" />
        <Out label="Націнка" value={result.markupPct.toFixed(0)} unit="%" />
        <Out label="Маржа" value={result.marginPct.toFixed(0)} unit="%" />
        <Out label="З палети" value={int(result.profitPerPallet)} unit="грн" />
      </div>

      <div className="out-gap">
        {base === 'gross' ? (
          <>
            База — ціна <b>з ПДВ</b>: так рахує точка, яка не є платником
            податку, тобто більшість малих магазинів. Заробіток тут — це те, що
            справді лишається в касі.
          </>
        ) : (
          <>
            База — ціна <b>без ПДВ</b>: так рахує платник ПДВ, який відносить
            податок у кредит. Націнка виходить вищою, ніж від ціни з ПДВ, бо в
            неї входить іще й сам податок, а не тільки заробіток точки.
          </>
        )}
      </div>

      <p className="hint">
        Націнка — скільки додає точка до своєї закупівельної ціни. Маржа —
        частка заробітку в рекомендованій ціні продажу. Рекомендована ціна
        завжди з ПДВ: це ціна на полиці. Прайс, редакція: {PRICE_REVISION}.
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
