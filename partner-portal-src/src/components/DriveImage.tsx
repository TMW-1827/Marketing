import { useEffect, useState } from 'react'
import { driveImageCandidates } from '@/lib/drive'

/**
 * Зображення з Google Drive із запасною адресою.
 *
 * Якщо жодна з адрес не відповіла — компонент не малює нічого й повідомляє
 * про це через `onGiveUp`. Так картка з фото не перетворюється на порожню
 * рамку ні в офлайні, ні коли файл закрили від сторонніх.
 */
export function DriveImage({
  id,
  width,
  alt,
  onGiveUp,
}: {
  id: string
  width: number
  alt: string
  onGiveUp?: () => void
}) {
  const sources = driveImageCandidates(id, width)
  const [attempt, setAttempt] = useState(0)

  // Нове фото — нова спроба з першої адреси.
  useEffect(() => setAttempt(0), [id])

  if (attempt >= sources.length) return null

  return (
    <img
      src={sources[attempt]}
      alt={alt}
      loading="lazy"
      onError={() => {
        const next = attempt + 1
        setAttempt(next)
        if (next >= sources.length) onGiveUp?.()
      }}
    />
  )
}
