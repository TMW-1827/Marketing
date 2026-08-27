import { useState } from 'react'
import { formats } from '@/lib/catalog'
import { VEHICLES } from '@/data/vehicles'
import { grouped, int, plural } from '@/lib/format'

const PALLET_FORMS: [string, string, string] = ['палета', 'палети', 'палет']

/**
 * Скільки палет одного формату входить в авто.
 *
 * Головне, що показує калькулятор: вода майже завжди впирається у **вагу**,
 * а не в місця. Тент на 33 палетомісця не візьме 33 палети води — за
 * 20 тоннами він закінчиться на двадцять сьомій, і половина кузова поїде
 * порожньою. Саме тому обидві межі показані поруч, а не одна «відповідь».
 */
export function LoadCalculator() {
  const [vehicleId, setVehicleId] = useState(VEHICLES[0].id)
  const [formatKey, setFormatKey] = useState(formats[0].key)

  const vehicle = VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0]
  const format = formats.find((f) => f.key === formatKey) ?? formats[0]

  const palletKg = format.source.weightPalletKg
  const byWeight = Math.floor(vehicle.payloadKg / palletKg)
  const byPlaces = vehicle.places
  const fits = Math.min(byWeight, byPlaces)
  const limit = byWeight <= byPlaces ? 'weight' : 'places'

  const loadKg = fits * palletKg
  const bottles = fits * format.source.bottlesPerPallet
  const litres = bottles * format.litres

  return (
    <>
      <div className="calc-row">
        <div style={{ flex: '1 1 220px' }}>
          <label className="field-label" htmlFor="load-vehicle">
            Транспорт
          </label>
          <select
            id="load-vehicle"
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
        <div style={{ flex: '1 1 220px' }}>
          <label className="field-label" htmlFor="load-format">
            Формат
          </label>
          <select
            id="load-format"
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
      </div>

      <div className="out">
        <Out label="Входить палет" value={`${fits}`} />
        <Out
          label="За вагою"
          value={`${byWeight}`}
          unit={plural(byWeight, PALLET_FORMS)}
        />
        <Out
          label="За місцями"
          value={`${byPlaces}`}
          unit={plural(byPlaces, PALLET_FORMS)}
        />
        <Out label="Вага вантажу" value={grouped(loadKg)} unit="кг" />
        <Out label="Пляшок" value={int(bottles)} />
        <Out label="Об’єм води" value={grouped(litres)} unit="л" />
      </div>

      <div className="out-gap">
        {limit === 'weight' ? (
          <>
            Обмежує <b>вага</b>: {fits} {plural(fits, PALLET_FORMS)} по{' '}
            {grouped(palletKg)} кг дають {grouped(loadKg)} кг із дозволених{' '}
            {grouped(vehicle.payloadKg)} кг. У кузові при цьому лишається{' '}
            <b>{byPlaces - fits}</b> вільних палетомісць — їх можна віддати під
            легший формат.
          </>
        ) : (
          <>
            Обмежують <b>місця</b>: {fits} {plural(fits, PALLET_FORMS)} по{' '}
            {grouped(palletKg)} кг — це {grouped(loadKg)} кг, тобто запас за
            вагою ще <b>{grouped(vehicle.payloadKg - loadKg)}</b> кг. Формат
            легкий: кузов заповнюється раніше, ніж вичерпується тоннаж.
          </>
        )}
      </div>

      <p className="hint">
        {vehicle.use}. Числа типові для класу авто, а не паспорт конкретної
        машини: перед завантаженням звіряйтесь із документами на те авто, що
        стоїть під навантаженням. Змішане завантаження з кількох форматів
        рахує «Збірка замовлення» в розділі «Візит і замовлення».
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
