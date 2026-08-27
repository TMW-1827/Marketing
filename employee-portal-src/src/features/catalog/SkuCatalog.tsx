import { useMemo, useState } from 'react'
import { skus } from '@/lib/catalog'
import { SKU_PHOTOS } from '@/data/photos'
import { DriveImage } from '@/components/DriveImage'
import type { Carbonation, Packaging } from '@/types/catalog'
import { openSku, resetFilters, setFilter, useCatalogFilters } from './store'
import { CarbonationDot } from './CarbonationDot'

const VOLUMES = ['всі', '0,3 л', '0,5 л', '0,75 л', '1,5 л', '2,0 л', '7,0 л']
const CARBONATIONS: Array<Carbonation | 'всі'> = [
  'всі',
  'негазована',
  'слабогазована',
  'сильногазована',
]
const PACKAGINGS: Array<Packaging | 'всі'> = ['всі', 'ПЕТ', 'Скло']

export function SkuCatalog() {
  const filters = useCatalogFilters()

  const visible = useMemo(
    () =>
      skus.filter(
        (sku) =>
          (filters.volume === 'всі' || sku.volume === filters.volume) &&
          (filters.carbonation === 'всі' ||
            sku.carbonation === filters.carbonation) &&
          (filters.packaging === 'всі' || sku.packaging === filters.packaging),
      ),
    [filters],
  )

  const isFiltered =
    filters.volume !== 'всі' ||
    filters.carbonation !== 'всі' ||
    filters.packaging !== 'всі'

  return (
    <>
      <div className="filters">
        <FilterRow
          label="Об’єм"
          options={VOLUMES}
          value={filters.volume}
          onChange={(v) => setFilter('volume', v)}
        />
        <FilterRow
          label="Газованість"
          options={CARBONATIONS}
          value={filters.carbonation}
          onChange={(v) => setFilter('carbonation', v)}
        />
        <FilterRow
          label="Тара"
          options={PACKAGINGS}
          value={filters.packaging}
          onChange={(v) => setFilter('packaging', v)}
        />
        {isFiltered && (
          <button type="button" className="chip chip--reset" onClick={resetFilters}>
            Скинути фільтри
          </button>
        )}
      </div>

      <div className="sku-grid" id="sku-grid">
        {visible.map((sku) => (
          <button
            type="button"
            className="sku"
            key={sku.id}
            onClick={() => openSku(sku.id)}
          >
            <SkuPhoto id={sku.id} name={sku.name} />
            <span className="sku__top">
              <CarbonationDot
                carbonation={sku.carbonation}
                className="sku__dot"
              />
              <span>
                <span className="sku__name">
                  {sku.line === 'Особлива' && 'Особлива '}
                  {sku.volume} {sku.packaging}
                  {sku.line === 'SPORT' && ' SPORT'}
                </span>
                <span className="sku__gas">{sku.carbonation}</span>
              </span>
            </span>
            <span className="sku__ean">
              {sku.ean} · {sku.bottlesPerCase} шт/упак ·{' '}
              {sku.bottlesPerPallet} шт/палета
            </span>
          </button>
        ))}

        {visible.length === 0 && (
          <p className="empty">
            За такими фільтрами позицій немає. Спробуйте скинути фільтри.
          </p>
        )}
      </div>

      <p className="hint">
        Натисніть на картку, щоб відкрити повні дані: штрих-коди, палетизацію,
        габарити, вагу, УКТЗЕД, термін придатності.
      </p>
    </>
  )
}

/**
 * Фото позиції. Якщо його немає або воно не завантажилось, місце під нього
 * не резервується: картка просто лишається текстовою, як була раніше.
 */
function SkuPhoto({ id, name }: { id: number; name: string }) {
  const [failed, setFailed] = useState(false)
  const photoId = SKU_PHOTOS[id]
  if (!photoId || failed) return null

  return (
    <span className="sku__photo">
      <DriveImage
        id={photoId}
        width={260}
        alt={`«Трускавецька» ${name}`}
        onGiveUp={() => setFailed(true)}
      />
    </span>
  )
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="filter-row" role="group" aria-label={label}>
      <span className="filter-row__label">{label}</span>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={`chip${option === value ? ' chip--on' : ''}`}
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
