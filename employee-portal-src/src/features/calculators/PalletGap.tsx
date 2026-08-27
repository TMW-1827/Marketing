import type { calcPallet, PalletUnit } from '@/lib/catalog'
import { BOTTLE_FORMS, CASE_FORMS, grouped, int, plural } from '@/lib/format'

const PALLET_FULL_FORMS: [string, string, string] = [
  'повна палета',
  'повні палети',
  'повних палет',
]

const CASE_FULL_FORMS: [string, string, string] = [
  'повна упаковка',
  'повні упаковки',
  'повних упаковок',
]

/**
 * Що лишилось «нерівним» у розрахунку.
 *
 * Три різні залишки, і кожен коштує грошей по-своєму:
 *
 *  – **неповна палета** займає в кузові ціле палетомісце;
 *  – **неповна упаковка** не відвантажується взагалі — її або добирають,
 *    або втрачають із замовлення;
 *  – **заданий об'єм**, який не ділиться на цілі пляшки, доводиться
 *    округлювати вгору, і клієнт отримує трохи більше, ніж просив.
 *
 * Показані вони разом і тим самим текстом у калькуляторі палети й у
 * калькуляторі води на захід: розрахунок один, і читатись він має однаково.
 */
export function PalletGap({
  result,
  unit,
  formatLabel,
  litres,
}: {
  result: ReturnType<typeof calcPallet>
  unit: PalletUnit
  formatLabel: string
  /** Літрів у пляшці формату — для пояснення округлення */
  litres: number
}) {
  const {
    fullPallets,
    remainderCases,
    casesToFullPallet,
    casesPerPallet,
    fullCases,
    remainderBottles,
    bottlesToFullCase,
    bottlesPerCase,
    litresRounded,
    requestedLitres,
  } = result

  return (
    <div className="out-gap">
      {/* Палета */}
      <div className="out-gap__line">
        {remainderCases === 0 ? (
          <>
            Рівно <b>{fullPallets}</b> {plural(fullPallets, PALLET_FULL_FORMS)} —
            залишків немає.
          </>
        ) : (
          <>
            {fullPallets > 0 && (
              <>
                <b>{fullPallets}</b> {plural(fullPallets, PALLET_FULL_FORMS)} +{' '}
              </>
            )}
            {/* З великої, коли повних палет немає й фраза починає речення */}
            {fullPallets > 0 ? 'неповна' : 'Неповна'} палета:{' '}
            <b>{remainderCases}</b>{' '}
            {plural(remainderCases, CASE_FORMS)} з {casesPerPallet}. Щоб закрити
            палету, не вистачає <b>{casesToFullPallet}</b>{' '}
            {plural(casesToFullPallet, CASE_FORMS)} (
            {int(casesToFullPallet * bottlesPerCase)}{' '}
            {plural(casesToFullPallet * bottlesPerCase, BOTTLE_FORMS)}).
          </>
        )}
      </div>

      {/* Упаковка */}
      <div className="out-gap__line">
        {remainderBottles === 0 ? (
          <>
            Рівно <b>{int(fullCases)}</b> {plural(fullCases, CASE_FULL_FORMS)} —
            розпаковувати нічого не треба.
          </>
        ) : (
          <>
            Неповна упаковка: <b>{remainderBottles}</b>{' '}
            {plural(remainderBottles, BOTTLE_FORMS)} з {bottlesPerCase}. Розпаковані
            упаковки не відвантажують — або доберіть{' '}
            <b>{bottlesToFullCase}</b> {plural(bottlesToFullCase, BOTTLE_FORMS)} до
            повної, або зніміть залишок із замовлення.
          </>
        )}
      </div>

      {/* Літри, які не поділились на цілі пляшки */}
      {unit === 'litre' && (
        <div className="out-gap__line">
          {litresRounded ? (
            <>
              {grouped(requestedLitres)} л не діляться на пляшки по {grouped(litres, 2)}{' '}
              л формату «{formatLabel}»: пів пляшки не буває, тому рахуємо{' '}
              <b>{int(result.bottles)}</b> {plural(result.bottles, BOTTLE_FORMS)} —{' '}
              <b>{grouped(result.litres)}</b> л, на {grouped(result.litres - requestedLitres)} л
              більше за заданий об’єм.
            </>
          ) : (
            <>
              {grouped(requestedLitres)} л діляться на пляшки формату «{formatLabel}»
              рівно — округлювати нічого не довелось.
            </>
          )}
        </div>
      )}
    </div>
  )
}
