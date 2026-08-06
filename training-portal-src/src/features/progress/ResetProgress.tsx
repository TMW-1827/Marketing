import { useState } from 'react'
import { useProgress } from './ProgressProvider'

export function ResetProgress() {
  const { reset } = useProgress()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => setConfirming(true)}
      >
        Скинути прогрес
      </button>
    )
  }

  return (
    <div className="button-row">
      <button
        type="button"
        className="btn"
        onClick={() => {
          void reset()
          setConfirming(false)
        }}
      >
        Так, скинути
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => setConfirming(false)}
      >
        Скасувати
      </button>
    </div>
  )
}
