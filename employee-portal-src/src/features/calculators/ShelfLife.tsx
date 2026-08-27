import { useMemo, useState } from 'react'
import { checkShelfLife, formats } from '@/lib/catalog'
import { plural } from '@/lib/format'

const DAY_FORMS: [string, string, string] = ['день', 'дні', 'днів']

/**
 * Порогові частки залишкового терміну.
 *
 * Числа не наші — вони з договорів із мережами: приймання «не менш ніж
 * 2/3 терміну» стоїть у більшості з них, а нижче половини товар уже не
 * бере ніхто. Тому саме ці дві межі показані як світлофор.
 */
const FRESH_OK = 2 / 3
const FRESH_WARN = 0.5

/** Локальна дата у форматі, який приймає `<input type="date">`. */
function toInputDate(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/** «2026-08-27» → «27.08.2026» */
function toUkDate(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${d}.${m}.${date.getFullYear()}`
}

/**
 * Залишковий термін придатності партії.
 *
 * Найдорожча помилка приймання — узяти партію, яку мережа потім не візьме.
 * Калькулятор рахує від дати розливу й одразу каже, чи проходить партія за
 * правилом 2/3, чи піде тільки в канал без такої вимоги.
 *
 * Газація тут не деталь, а суть: у газованого ПЕТ термін 9 місяців проти
 * 12 у сусідньої негазованої пляшки того самого об'єму, і саме на ньому
 * найчастіше «згорає» залишок.
 */
export function ShelfLife() {
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])

  const [bottled, setBottled] = useState(() => {
    const d = new Date(today)
    d.setMonth(d.getMonth() - 3)
    return toInputDate(d)
  })
  const [formatKey, setFormatKey] = useState(formats[0].key)
  const [carbonation, setCarbonation] = useState('негазована')

  const format = formats.find((f) => f.key === formatKey) ?? formats[0]

  // Термін залежить від газації, а не від формату: беремо саме ту позицію,
  // яку приймають. Якщо обраної газації у форматі немає (скло 0,75 буває
  // не в усіх варіантах) — падаємо на першу наявну.
  const sku =
    format.items.find((s) => s.carbonation === carbonation) ?? format.items[0]

  const parsed = useMemo(() => {
    const [y, m, d] = bottled.split('-').map(Number)
    if (!y || !m || !d) return null
    const date = new Date(y, m - 1, d)
    return Number.isNaN(date.getTime()) ? null : date
  }, [bottled])

  const check = parsed
    ? checkShelfLife(parsed, sku.shelfLifeMonths, today)
    : null

  const tone = !check
    ? 'warn'
    : check.expired
      ? 'expired'
      : check.freshness >= FRESH_OK
        ? 'ok'
        : check.freshness >= FRESH_WARN
          ? 'warn'
          : 'bad'

  return (
    <>
      <div className="calc-row">
        <div style={{ flex: '1 1 170px' }}>
          <label className="field-label" htmlFor="life-date">
            Дата розливу
          </label>
          <input
            id="life-date"
            type="date"
            value={bottled}
            max={toInputDate(today)}
            onChange={(e) => setBottled(e.target.value)}
          />
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <label className="field-label" htmlFor="life-format">
            Формат
          </label>
          <select
            id="life-format"
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
        <div style={{ flex: '1 1 170px' }}>
          <label className="field-label" htmlFor="life-gas">
            Газація
          </label>
          <select
            id="life-gas"
            value={carbonation}
            onChange={(e) => setCarbonation(e.target.value)}
          >
            {format.carbonations.map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {check ? (
        <>
          <div className="out">
            <Out label="Термін" value={`${sku.shelfLifeMonths}`} unit="міс." />
            <Out label="Придатна до" value={toUkDate(check.useBy)} />
            <Out
              label="Лишилось"
              value={check.expired ? '0' : `${check.daysLeft}`}
              unit={plural(check.daysLeft, DAY_FORMS)}
            />
            <Out
              label="Залишковий термін"
              value={`${Math.round(check.freshness * 100)}`}
              unit="%"
            />
          </div>

          <div className="life-meter" aria-hidden="true">
            <div
              className={`life-meter__fill life-meter__fill--${tone}`}
              style={{ width: `${Math.round(check.freshness * 100)}%` }}
            />
            <span className="life-meter__mark" style={{ left: '50%' }} />
            <span
              className="life-meter__mark life-meter__mark--strong"
              style={{ left: `${Math.round(FRESH_OK * 100)}%` }}
            />
          </div>

          <div className="out-gap">
            <Verdict tone={tone} daysLeft={check.daysLeft} />
          </div>
        </>
      ) : (
        <p className="empty">Вкажіть дату розливу з етикетки.</p>
      )}

      <p className="hint">
        Термін рахується від дати розливу в місяцях — так само, як його
        наносять на пляшку. Позначки на шкалі: 1/2 і 2/3 терміну. Конкретна
        вимога до залишку записана в договорі з клієнтом — звіряйтесь із ним,
        а не з пам’яттю.
      </p>
    </>
  )
}

function Verdict({ tone, daysLeft }: { tone: string; daysLeft: number }) {
  if (tone === 'expired') {
    return (
      <>
        Термін вийшов {Math.abs(daysLeft)} {plural(daysLeft, DAY_FORMS)} тому.{' '}
        <b>Не приймати й не відвантажувати.</b> Партію відкласти окремо й
        оформити актом.
      </>
    )
  }
  if (tone === 'ok') {
    return (
      <>
        Понад <b>2/3</b> терміну — проходить приймання в мережі й у
        дистрибуцію без застережень.
      </>
    )
  }
  if (tone === 'warn') {
    return (
      <>
        Від <b>1/2</b> до <b>2/3</b> терміну — мережа з вимогою 2/3 таку
        партію не візьме. Канали без такої вимоги — так, але відвантажувати
        першою чергою.
      </>
    )
  }
  return (
    <>
      Менше <b>половини</b> терміну. Відвантажувати тільки за письмовим
      погодженням із клієнтом; на склад із такою датою партію не заводити.
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
