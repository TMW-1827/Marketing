import { formats, skus } from '@/lib/catalog'
import { dec, money } from '@/lib/format'
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

/** Прайс по двох зонах. */
export function PriceTable() {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>Формат</th>
            <th colSpan={3} style={{ textAlign: 'center' }}>
              Захід, Київ
            </th>
            <th colSpan={3} style={{ textAlign: 'center' }}>
              Центр, Схід, Південь
            </th>
          </tr>
          <tr>
            <th className="num">без ПДВ</th>
            <th className="num">з ПДВ</th>
            <th className="num">РРЦ</th>
            <th className="num">без ПДВ</th>
            <th className="num">з ПДВ</th>
            <th className="num">РРЦ</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((f) => (
            <tr key={f.key}>
              <td>{f.label}</td>
              <td className="num">{money(f.source.price.west.net)}</td>
              <td className="num">{money(f.source.price.west.gross)}</td>
              <td className="num">
                <b>{money(f.source.price.west.rrp)}</b>
              </td>
              <td className="num">{money(f.source.price.east.net)}</td>
              <td className="num">{money(f.source.price.east.gross)}</td>
              <td className="num">
                <b>{money(f.source.price.east.rrp)}</b>
              </td>
            </tr>
          ))}
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
