import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Повідомлення про оновлення застосунку.
 *
 * registerType: 'prompt' — оновлення не підміняє сторінку посеред тесту.
 * Працівник сам вирішує, коли перезавантажити.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // Повідомлення про готовність до офлайну — суто інформативне,
  // тому зникає саме й не перекриває матеріали.
  useEffect(() => {
    if (!offlineReady || needRefresh) return
    const timer = window.setTimeout(() => setOfflineReady(false), 4000)
    return () => window.clearTimeout(timer)
  }, [offlineReady, needRefresh, setOfflineReady])

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="toast" role="status">
      <span>
        {needRefresh
          ? 'Є нова версія порталу.'
          : 'Портал готовий до роботи офлайн.'}
      </span>
      {needRefresh && (
        <button
          type="button"
          className="btn"
          onClick={() => void updateServiceWorker(true)}
        >
          Оновити
        </button>
      )}
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          setOfflineReady(false)
          setNeedRefresh(false)
        }}
      >
        Закрити
      </button>
    </div>
  )
}
