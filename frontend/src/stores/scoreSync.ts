import { watch } from 'vue'
import { defineStore } from 'pinia'
import { useOnline } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useSyncQueueStore } from '@/stores/syncQueue'
import { saveScore as apiSaveScore } from '@/services/api'
import { useToast } from '@/composables/useToast'

/** Wiederholversuch, solange Scores in der Queue liegen (Flush fehlgeschlagen). */
const RETRY_INTERVAL_MS = 30_000

export const useScoreSyncStore = defineStore('scoreSync', () => {
  const queue = useSyncQueueStore()
  const isOnline = useOnline()
  const { success, warning, error } = useToast()
  const { t } = useI18n()

  /**
   * Jeder Score geht IMMER zuerst in die Queue — auch online.
   *
   * Vorher entschied `navigator.onLine`, ob überhaupt gequeued wird. Auf dem
   * Platz ist das unzuverlässig (WLAN ohne Internet, Captive Portal, schwaches
   * Mobilnetz, 429 vom Rate-Limit): der Browser meldet „online", der Request
   * stirbt trotzdem — und der Score war weder gespeichert noch gequeued. Das
   * Loch fehlte anschliessend komplett, weil die holes-Liste aus den
   * Server-Scores rekonstruiert wird.
   *
   * Wirft nie. Ein nicht zugestellter Score bleibt in der Queue und wird vom
   * Retry-Loop, beim nächsten Online-Übergang oder bei Rückkehr aus dem
   * Hintergrund erneut versucht.
   */
  async function saveScore(payload: {
    game_id: string
    player_id: string
    hole: number
    strokes: number
  }): Promise<void> {
    queue.enqueue(payload)
    if (!isOnline.value) return
    // Still: der Einzel-Tap darf nicht bei jedem Strich eine Toast auslösen.
    await flushQueue({ quiet: true })
  }

  // Flushes werden serialisiert. Ohne das könnte ein Queue-Flush parallel zum
  // Direkt-Save desselben Feldes laufen und ein alter Wert den neueren
  // überschreiben (Out-of-order-Write).
  let chain: Promise<void> = Promise.resolve()

  function flushQueue(opts: { quiet?: boolean } = {}): Promise<void> {
    const run = () => runFlush(opts.quiet === true)
    chain = chain.then(run, run)
    return chain
  }

  async function runFlush(quiet: boolean): Promise<void> {
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
        // Bleibt in der Queue — der nächste Versuch übernimmt.
        failCount++
      }
    }

    // Ausstehende Scores meldet im stillen Pfad der Sync-Indikator über die
    // Queue-Länge; Netzfehler toastet bereits der Axios-Interceptor.
    if (quiet) return
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

    // Beim Start einmal flushen: Der Watcher feuert nur bei einem ÜBERGANG. Wer
    // offline erfasst und die PWA schliesst, startet sie später online neu —
    // ohne Übergang bliebe die Queue sonst dauerhaft im localStorage liegen.
    void flushQueue()

    // Danach in Ruhe weiterversuchen. Deckt die Fälle ab, in denen
    // `navigator.onLine` durchgehend true bleibt, die Zustellung aber scheitert
    // (Captive Portal, 5xx-Fenster, Rate-Limit).
    setInterval(() => {
      if (queue.queue.length > 0) void flushQueue()
    }, RETRY_INTERVAL_MS)

    // Rückkehr aus dem Hintergrund ist der häufigste Moment, in dem wieder
    // echtes Netz da ist, ohne dass `online` je gefeuert hätte.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && queue.queue.length > 0) {
          void flushQueue()
        }
      })
    }
  }

  return { saveScore, flushQueue, installNetworkWatcher, queue: queue.queue, isOnline }
})
