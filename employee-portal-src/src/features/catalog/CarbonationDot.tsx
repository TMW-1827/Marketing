import { CARBONATION_FILL, CARBONATION_STROKE, type Carbonation } from '@/types/catalog'

/**
 * Мітка газації — кружечок кольору газації.
 *
 * Один компонент на весь портал: полиця, каталог позицій і таблиця форматів
 * малюють ту саму мітку тими самими кольорами. Якщо кольори колись зміняться,
 * вони зміняться скрізь одночасно — інакше білий кружечок у каталозі й білий
 * кружечок на полиці рано чи пізно почали б означати різне.
 *
 * Розмір задається змінною `--dot` у місці використання: під пляшкою на
 * полиці місця мало, у картці позиції — багато.
 */
export function CarbonationDot({
  carbonation,
  className,
}: {
  carbonation: Carbonation
  className?: string
}) {
  return (
    <span
      className={className ? `gasdot ${className}` : 'gasdot'}
      style={{
        background: CARBONATION_FILL[carbonation],
        borderColor: CARBONATION_STROKE[carbonation],
      }}
      aria-hidden="true"
    />
  )
}

/**
 * Набір газацій формату.
 *
 * Кружечки замість числа: число каже, скільки газацій у форматі, кружечки —
 * ще й які саме, і читаються вони з одного погляду. Для тих, хто не бачить
 * кольору, той самий перелік лишається словами в `aria-label` і у підказці
 * при наведенні.
 */
export function CarbonationDots({
  carbonations,
  className,
}: {
  carbonations: Carbonation[]
  className?: string
}) {
  const words = carbonations.join(' · ')

  return (
    <span
      className={className ? `gasdots ${className}` : 'gasdots'}
      role="img"
      aria-label={`Газації: ${words}`}
      title={words}
    >
      {carbonations.map((carbonation) => (
        <CarbonationDot carbonation={carbonation} key={carbonation} />
      ))}
    </span>
  )
}
