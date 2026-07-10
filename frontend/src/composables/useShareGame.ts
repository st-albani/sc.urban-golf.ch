import { ref, computed, type Ref } from 'vue'

/**
 * Teilen-Logik für ein Spiel: erzeugt den Share-Link auf die Spielansicht,
 * bietet natives Teilen (Web Share API) mit Clipboard-Copy als Fallback.
 *
 * Das Modell ist bewusst anonym — jeder mit dem Link kann das Spiel öffnen
 * und Scores eintragen. Zugriffskontrolle ist nicht Teil dieses Features.
 */
export function useShareGame(gameId: Ref<string>) {
  const shareUrl = computed(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/games/${gameId.value}`
  })

  const canNativeShare = computed(
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  )

  const copied = ref(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(shareUrl.value)
      copied.value = true
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => {
        copied.value = false
      }, 2000)
      return true
    } catch {
      return false
    }
  }

  /**
   * Öffnet das native Share-Sheet. Ohne Web Share API (z. B. Desktop) fällt
   * die Funktion auf Clipboard-Copy zurück. Ein Abbruch durch den Nutzer wird
   * bewusst verschluckt — kein Fehler-Toast.
   */
  async function nativeShare(title: string): Promise<void> {
    if (!canNativeShare.value) {
      await copyLink()
      return
    }
    try {
      await navigator.share({ title, url: shareUrl.value })
    } catch {
      /* Nutzer hat abgebrochen oder Teilen fehlgeschlagen — ignorieren. */
    }
  }

  return { shareUrl, canNativeShare, copied, copyLink, nativeShare }
}
