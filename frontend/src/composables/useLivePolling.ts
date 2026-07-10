import { onMounted, onBeforeUnmount } from 'vue'

/**
 * Ruft `poll` in einem Intervall auf, solange die Seite sichtbar ist.
 * Pausiert bei verstecktem Tab / Hintergrund-App (Page Visibility) und nimmt
 * bei Sichtbarkeit wieder auf. Fehlgeschlagene Poll-Versuche werden still
 * verschluckt — kein Fehler-Spam bei schlechter Verbindung.
 */
export function useLivePolling(poll: () => Promise<void>, intervalMs = 5000) {
  let timer: ReturnType<typeof setInterval> | undefined

  function isVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible'
  }

  async function runOnce() {
    if (!isVisible()) return
    try {
      await poll()
    } catch {
      /* still: keine Toast-Flut bei fehlgeschlagenen Updates */
    }
  }

  function startTimer() {
    if (timer) return
    timer = setInterval(() => void runOnce(), intervalMs)
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function onVisibilityChange() {
    if (isVisible()) {
      void runOnce()
      startTimer()
    } else {
      stopTimer()
    }
  }

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    if (isVisible()) startTimer()
  })

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    stopTimer()
  })

  return { runOnce }
}
