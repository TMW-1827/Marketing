import { formats, skus } from '@/lib/catalog'
import { dec } from '@/lib/format'
import { openSku } from '@/features/catalog/store'

/** Палетизація по форматах. Усередині формату однакова для всіх газацій. */
export function PalletTable() {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Формат</th>
            <th className="num">шт/упак</th>
            <th className="num">упак/шар</th>
            <th className="num">шарів</th>
            <th className="num">шт/палета</th>
            <th className="num">Палета, кг</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((f) => (
            <tr key={f.key}>
              <td>{f.label}</td>
              <td className="num">{f.source.bottlesPerCase}</td>
              <td className="num">{f.source.casesPerLayer}</td>
              <td className="num">{f.source.layersPerPallet}</td>
              <td className="num">
                <b>{f.source.bottlesPerPallet}</b>
              </td>
              <td className="num">{dec(f.source.weightPalletKg, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Габарити й терміни придатності по форматах.
 * Полиця, холодильник і кузов рахуються саме за цими числами.
 */
export function FormatTable() {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Формат</th>
            <th className="num">Ш×В, см</th>
            <th className="num">Вага, кг</th>
            <th className="num">Газації</th>
            <th className="num">Термін, міс.</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((f) => {
            const months = [...new Set(f.items.map((s) => s.shelfLifeMonths))]
              .sort((a, b) => a - b)
              .join(' / ')
            return (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td className="num">
                  {dec(f.source.bottleWidthCm, 1)} ×{' '}
                  {dec(f.source.bottleHeightCm, 1)}
                </td>
                <td className="num">{dec(f.source.weightBottleKg, 3)}</td>
                <td className="num">{f.carbonations.length}</td>
                <td className="num">{months}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Усі штрих-коди. Рядок відкриває картку товару. */
export function EanTable() {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Товар</th>
            <th className="num">Штрих-код одиниці</th>
            <th className="num">Штрих-код упаковки</th>
            <th className="num">УКТЗЕД</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((sku) => (
            <tr
              key={sku.id}
              className="row-clickable"
              onClick={() => openSku(sku.id)}
            >
              <td>{sku.name}</td>
              <td className="num">{sku.ean}</td>
              <td className="num">{sku.eanCase}</td>
              <td className="num">{sku.uktzed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
