import { watch } from 'vue'
import { defineStore } from 'pinia'
import { useOnline } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useSyncQueueStore } from '@/stores/syncQueue'
import { saveScore as apiSaveScore } from '@/services/api'
import { useToast } from '@/composables/useToast'

export const useScoreSyncStore = defineStore('scoreSync', () => {
  const queue = useSyncQueueStore()
  const isOnline = useOnline()
  const { success, warning, error } = useToast()
  const { t } = useI18n()

  async function saveScore(payload: {
    game_id: string
    player_id: string
    hole: number
    strokes: number
  }): Promise<void> {
    if (!isOnline.value) {
      queue.enqueue(payload)
      return
    }
    await apiSaveScore(payload)
  }

  async function flushQueue(): Promise<void> {
    if (!isOnline.value || queue.queue.length === 0) return

    const items = [...queue.queue]
    let successCount = 0
    let failCount = 0

    for (const item of items) {
      try {
        await apiSaveScore({
          game_id: item.game_id,
          player_id: item.player_id,
          hole: item.hole,
          strokes: item.strokes,
        })
        queue.remove(item.id)
        successCount++
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      success(t('Sync.Synced', { n: successCount }), 3000)
    }
    if (failCount > 0) {
      error(t('Sync.SyncFailed', { n: failCount }), 6000)
    }
  }

  // One watcher for the whole app: network toasts + queue flush on reconnect.
  // Idempotent — guarded by a closure flag so re-invocations during tests / HMR
  // don't double-register.
  let watcherInstalled = false
  function installNetworkWatcher() {
    if (watcherInstalled) return
    watcherInstalled = true
    watch(isOnline, (online) => {
      if (online) {
        success(t('Network.BackOnline'), 3000)
        void flushQueue()
      } else {
        warning(t('Network.Offline'), 0)
      }
    })
  }

  return { saveScore, flushQueue, installNetworkWatcher, queue: queue.queue, isOnline }
})
