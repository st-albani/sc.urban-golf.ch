import { computed, type Ref } from 'vue'

export type SyncTone = 'idle' | 'offline' | 'offline-pending' | 'syncing'

/**
 * Leitet aus Netzwerkstatus und Länge der Offline-Sync-Queue den anzuzeigenden
 * Zustand des globalen Sync-Indikators ab. Reine Logik — die Zuordnung zu Text
 * und Icon (inkl. i18n) passiert in der Komponente.
 */
export function useSyncStatus(isOnline: Ref<boolean>, pendingCount: Ref<number>) {
  const tone = computed<SyncTone>(() => {
    if (!isOnline.value) return pendingCount.value > 0 ? 'offline-pending' : 'offline'
    return pendingCount.value > 0 ? 'syncing' : 'idle'
  })

  // Im Ruhezustand (online, nichts ausstehend) bleibt der Indikator verborgen.
  const visible = computed(() => tone.value !== 'idle')

  return { tone, visible }
}
