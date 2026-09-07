import { computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage, useOnline } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { saveScore as apiSaveScore } from '@/services/api'
import { useToast } from '@/composables/useToast'

export interface ScoreDraft {
  game_id: string
  player_id: string
  hole: number
  strokes: number
}

interface PendingScore extends ScoreDraft {
  id: string
  queuedAt: number
}

/** Wiederholversuch, solange Scores ausstehen (Zustellung fehlgeschlagen). */
const RETRY_INTERVAL_MS = 30_000

/**
 * Der einzige Schreibpfad für Scores. Queue, Persistenz, Netzstatus,
 * Reconnect-Watcher und der API-Call liegen hinter dieser Fassade — Aufrufer
 * kennen nur `write()` und `flush()`.
 */
export const useScoreWriterStore = defineStore('scoreWriter', () => {
  // flush: 'sync' schreibt sofort in den localStorage statt erst im nächsten
  // Microtask. Entscheidend beim Backgrounding: wer den letzten Score tippt und
  // direkt das Handy sperrt, dessen Eintrag muss die eingefrorene PWA überleben.
  const pending = useLocalStorage<PendingScore[]>('ug-sync-queue', [], { flush: 'sync' })
  const isOnline = useOnline()
  const { success, warning, error } = useToast()
  const { t } = useI18n()

  /**
   * Jeder Score wird IMMER zuerst vorgemerkt — auch online.
   *
   * Vorher entschied `navigator.onLine`, ob überhaupt vorgemerkt wird. Auf dem
   * Platz ist das unzuverlässig (WLAN ohne Internet, Captive Portal, schwaches
   * Mobilnetz, 429 vom Rate-Limit): der Browser meldet „online", der Request
   * stirbt trotzdem — und der Score war weder gespeichert noch vorgemerkt. Das
   * Loch fehlte anschliessend komplett, weil die holes-Liste aus den
   * Server-Scores rekonstruiert wird.
   *
   * Wirft nie. Ein nicht zugestellter Score bleibt vorgemerkt und wird vom
   * Retry-Loop, beim nächsten Online-Übergang oder bei Rückkehr aus dem
   * Hintergrund erneut versucht. Das aufgelöste Promise heisst „sicher
   * erfasst", nicht „beim Server angekommen".
   */
  async function write(score: ScoreDraft): Promise<void> {
    remember(score)
    if (!isOnline.value) return
    // Still: der Einzel-Tap darf nicht bei jedem Strich eine Toast auslösen.
    await flush({ quiet: true })
  }

  function remember(score: ScoreDraft) {
    // Deduplizierung: gleicher game+player+hole → neuesten Wert überschreiben
    const idx = pending.value.findIndex(
      i => i.game_id === score.game_id &&
           i.player_id === score.player_id &&
           i.hole === score.hole
    )
    const entry: PendingScore = {
      ...score,
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
    }
    // Neue Array-Referenz statt In-Place-Mutation — so greift der Persistenz-
    // Watcher zuverlässig, auch beim Ersetzen eines bestehenden Eintrags.
    const next = [...pending.value]
    if (idx >= 0) {
      next[idx] = entry
    } else {
      next.push(entry)
    }
    pending.value = next
  }

  // Flushes werden serialisiert. Ohne das könnte ein Flush parallel zu einem
  // zweiten laufen und ein alter Wert den neueren überschreiben
  // (Out-of-order-Write).
  let chain: Promise<void> = Promise.resolve()

  function flush(opts: { quiet?: boolean } = {}): Promise<void> {
    const run = () => runFlush(opts.quiet === true)
    chain = chain.then(run, run)
    return chain
  }

  async function runFlush(quiet: boolean): Promise<void> {
    if (!isOnline.value || pending.value.length === 0) return

    const items = [...pending.value]
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
        pending.value = pending.value.filter(i => i.id !== item.id)
        successCount++
      } catch {
        // Bleibt vorgemerkt — der nächste Versuch übernimmt.
        failCount++
      }
    }

    // Ausstehende Scores meldet im stillen Pfad der Sync-Indikator über
    // `pendingCount`; Netzfehler toastet bereits der Axios-Interceptor.
    if (quiet) return
    if (successCount > 0) {
      success(t('Sync.Synced', { n: successCount }), 3000)
    }
    if (failCount > 0) {
      error(t('Sync.SyncFailed', { n: failCount }), 6000)
    }
  }

  // One watcher for the whole app: network toasts + flush on reconnect.
  // Idempotent — guarded by a closure flag so re-invocations during tests / HMR
  // don't double-register.
  let watcherInstalled = false
  function installNetworkWatcher() {
    if (watcherInstalled) return
    watcherInstalled = true
    watch(isOnline, (online) => {
      if (online) {
        success(t('Network.BackOnline'), 3000)
        void flush()
      } else {
        warning(t('Network.Offline'), 0)
      }
    })

    // Beim Start einmal flushen: Der Watcher feuert nur bei einem ÜBERGANG. Wer
    // offline erfasst und die PWA schliesst, startet sie später online neu —
    // ohne Übergang bliebe der Rest sonst dauerhaft im localStorage liegen.
    void flush()

    // Danach in Ruhe weiterversuchen. Deckt die Fälle ab, in denen
    // `navigator.onLine` durchgehend true bleibt, die Zustellung aber scheitert
    // (Captive Portal, 5xx-Fenster, Rate-Limit).
    setInterval(() => {
      if (pending.value.length > 0) void flush()
    }, RETRY_INTERVAL_MS)

    // Rückkehr aus dem Hintergrund ist der häufigste Moment, in dem wieder
    // echtes Netz da ist, ohne dass `online` je gefeuert hätte.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && pending.value.length > 0) {
          void flush()
        }
      })
    }
  }

  return {
    write,
    flush,
    installNetworkWatcher,
    /** Nur für den Status-Indikator — nicht zum Mitlesen der Einträge. */
    pendingCount: computed(() => pending.value.length),
    isOnline: computed(() => isOnline.value),
  }
})
