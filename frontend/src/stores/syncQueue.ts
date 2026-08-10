import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export interface QueuedScore {
  id: string
  game_id: string
  player_id: string
  hole: number
  strokes: number
  queuedAt: number
}

export const useSyncQueueStore = defineStore('syncQueue', () => {
  // flush: 'sync' schreibt sofort in den localStorage statt erst im nächsten
  // Microtask. Entscheidend beim Backgrounding: wer den letzten Score tippt und
  // direkt das Handy sperrt, dessen Eintrag muss die eingefrorene PWA überleben.
  const queue = useLocalStorage<QueuedScore[]>('ug-sync-queue', [], { flush: 'sync' })

  function enqueue(score: Omit<QueuedScore, 'id' | 'queuedAt'>) {
    // Deduplizierung: gleicher game+player+hole → neuesten Wert überschreiben
    const idx = queue.value.findIndex(
      i => i.game_id === score.game_id &&
           i.player_id === score.player_id &&
           i.hole === score.hole
    )
    const entry: QueuedScore = {
      ...score,
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
    }
    // Neue Array-Referenz statt In-Place-Mutation — so greift der Persistenz-
    // Watcher zuverlässig, auch beim Ersetzen eines bestehenden Eintrags.
    const next = [...queue.value]
    if (idx >= 0) {
      next[idx] = entry
    } else {
      next.push(entry)
    }
    queue.value = next
  }

  function remove(id: string) {
    queue.value = queue.value.filter(i => i.id !== id)
  }

  function clear() {
    queue.value = []
  }

  return { queue, enqueue, remove, clear }
})
