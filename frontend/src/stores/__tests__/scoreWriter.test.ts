import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, watch, effectScope, nextTick, type EffectScope } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const mockIsOnline = ref(true)
// Der Store persistiert über useLocalStorage — hier auf den echten
// localStorage abgebildet, damit „überlebt einen Reload" testbar bleibt.
vi.mock('@vueuse/core', () => ({
  useOnline: () => mockIsOnline,
  useLocalStorage: (key: string, defaultValue: unknown) => {
    const stored = localStorage.getItem(key)
    const state = ref(stored ? JSON.parse(stored) : defaultValue)
    watch(state, (v) => localStorage.setItem(key, JSON.stringify(v)), { flush: 'sync' })
    return state
  },
}))

vi.mock('@/services/api', () => ({
  saveScore: vi.fn(),
}))

const mockSuccess = vi.fn()
const mockWarning = vi.fn()
const mockError = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: mockSuccess,
    warning: mockWarning,
    error: mockError,
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 9)),
})

import { useScoreWriterStore } from '../scoreWriter'
import { saveScore as apiSaveScore } from '@/services/api'

const mockApiSave = vi.mocked(apiSaveScore)

const GAME = 'g1234567890123'
const PLAYER = 'p1234567890123'

/** Liest die Warteschlange so, wie ein Reload sie vorfinden würde. */
function persisted(): Array<{ game_id: string; player_id: string; hole: number; strokes: number }> {
  return JSON.parse(localStorage.getItem('ug-sync-queue') ?? '[]')
}

function saved(hole: number, strokes: number) {
  return { id: 1, game_id: GAME, player_id: PLAYER, hole, strokes }
}

describe('useScoreWriterStore', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    setActivePinia(createPinia())
    mockIsOnline.value = true
    mockApiSave.mockReset()
    mockSuccess.mockClear()
    mockWarning.mockClear()
    mockError.mockClear()
    localStorage.clear()
  })

  afterEach(() => {
    scope.stop()
  })

  function writer() {
    return scope.run(() => useScoreWriterStore())!
  }

  describe('write', () => {
    it('sends the score and leaves nothing pending when online', async () => {
      mockApiSave.mockResolvedValue(saved(1, 3))
      const store = writer()

      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })

      expect(mockApiSave).toHaveBeenCalledWith({
        game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3,
      })
      expect(store.pendingCount).toBe(0)
      expect(persisted()).toHaveLength(0)
    })

    it('holds the score when offline', async () => {
      mockIsOnline.value = false
      const store = writer()

      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })

      expect(mockApiSave).not.toHaveBeenCalled()
      expect(store.pendingCount).toBe(1)
      expect(persisted()[0]).toMatchObject({ game_id: GAME, hole: 1, strokes: 3 })
    })

    // Kernregression: `navigator.onLine` meldet auf dem Platz auch dann online,
    // wenn der Request stirbt (Captive Portal, schwaches Netz, 429). Früher war
    // der Score damit weder gespeichert noch vorgemerkt — das Loch fehlte danach.
    it('holds the score when the request fails while online', async () => {
      mockApiSave.mockRejectedValue(new Error('Network error'))
      const store = writer()

      await expect(
        store.write({ game_id: GAME, player_id: PLAYER, hole: 7, strokes: 5 })
      ).resolves.toBeUndefined()

      expect(mockApiSave).toHaveBeenCalled()
      expect(store.pendingCount).toBe(1)
      expect(persisted()[0]).toMatchObject({ hole: 7, strokes: 5 })
    })

    it('collapses repeated writes for the same game+player+hole', async () => {
      mockIsOnline.value = false
      const store = writer()

      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })
      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 5 })

      expect(store.pendingCount).toBe(1)
      expect(persisted()[0].strokes).toBe(5)
    })

    it('keeps separate entries per hole and per player', async () => {
      mockIsOnline.value = false
      const store = writer()

      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })
      await store.write({ game_id: GAME, player_id: PLAYER, hole: 2, strokes: 4 })
      await store.write({ game_id: GAME, player_id: 'pB234567890123', hole: 1, strokes: 6 })

      expect(store.pendingCount).toBe(3)
    })

    it('does not toast on the per-tap path', async () => {
      mockApiSave.mockResolvedValue(saved(1, 3))
      const store = writer()

      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })

      expect(mockSuccess).not.toHaveBeenCalled()
    })

    // Ein Browser-Refresh mitten in der Runde darf nichts verlieren.
    it('recovers pending scores written before a reload', async () => {
      mockIsOnline.value = false
      await writer().write({ game_id: GAME, player_id: PLAYER, hole: 3, strokes: 2 })

      // Reload: frische Pinia-Instanz, gleicher localStorage.
      setActivePinia(createPinia())
      mockIsOnline.value = true
      mockApiSave.mockResolvedValue(saved(3, 2))
      const reloaded = writer()

      expect(reloaded.pendingCount).toBe(1)

      await reloaded.flush()

      expect(mockApiSave).toHaveBeenCalledWith({
        game_id: GAME, player_id: PLAYER, hole: 3, strokes: 2,
      })
      expect(reloaded.pendingCount).toBe(0)
    })
  })

  describe('flush', () => {
    it('delivers everything pending and reports the count', async () => {
      mockIsOnline.value = false
      const store = writer()
      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })
      await store.write({ game_id: GAME, player_id: PLAYER, hole: 2, strokes: 4 })
      expect(store.pendingCount).toBe(2)

      mockIsOnline.value = true
      mockApiSave.mockResolvedValue(saved(1, 3))

      await store.flush()

      expect(mockApiSave).toHaveBeenCalledTimes(2)
      expect(store.pendingCount).toBe(0)
      expect(mockSuccess).toHaveBeenCalledWith('Sync.Synced', 3000)
    })

    it('does nothing when offline', async () => {
      mockIsOnline.value = false
      const store = writer()

      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })
      await store.flush()

      expect(mockApiSave).not.toHaveBeenCalled()
    })

    it('does nothing when nothing is pending', async () => {
      const store = writer()
      await store.flush()

      expect(mockApiSave).not.toHaveBeenCalled()
    })

    it('reports partial failures and keeps the undelivered score', async () => {
      mockIsOnline.value = false
      const store = writer()
      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })
      await store.write({ game_id: GAME, player_id: PLAYER, hole: 2, strokes: 4 })

      mockIsOnline.value = true
      mockApiSave
        .mockResolvedValueOnce(saved(1, 3))
        .mockRejectedValueOnce(new Error('Network error'))

      await store.flush()

      expect(store.pendingCount).toBe(1)
      expect(persisted()[0].hole).toBe(2)
      expect(mockSuccess).toHaveBeenCalledWith('Sync.Synced', 3000)
      expect(mockError).toHaveBeenCalledWith('Sync.SyncFailed', 6000)
    })
  })

  describe('installNetworkWatcher', () => {
    it('shows warning toast when going offline', async () => {
      scope.run(() => useScoreWriterStore().installNetworkWatcher())

      mockIsOnline.value = false
      await nextTick()

      expect(mockWarning).toHaveBeenCalledWith('Network.Offline', 0)
    })

    it('shows success toast and flushes when coming back online', async () => {
      mockIsOnline.value = false
      const store = writer()
      scope.run(() => store.installNetworkWatcher())
      await store.write({ game_id: GAME, player_id: PLAYER, hole: 1, strokes: 3 })
      mockApiSave.mockResolvedValue(saved(1, 3))

      mockIsOnline.value = true
      await nextTick()
      await new Promise(r => setTimeout(r, 50))

      expect(mockSuccess).toHaveBeenCalledWith('Network.BackOnline', 3000)
      expect(mockApiSave).toHaveBeenCalled()
      expect(store.pendingCount).toBe(0)
    })

    // Der Watcher feuert nur bei einem Übergang. Wer offline erfasst und die
    // PWA schliesst, startet sie später online neu — ohne Übergang bliebe der
    // Rest sonst dauerhaft liegen.
    it('flushes scores left over from a previous session on install', async () => {
      mockIsOnline.value = false
      await writer().write({ game_id: GAME, player_id: PLAYER, hole: 4, strokes: 2 })

      setActivePinia(createPinia())
      mockIsOnline.value = true
      mockApiSave.mockResolvedValue(saved(4, 2))

      const reloaded = writer()
      scope.run(() => reloaded.installNetworkWatcher())
      await new Promise(r => setTimeout(r, 50))

      expect(mockApiSave).toHaveBeenCalledTimes(1)
      expect(reloaded.pendingCount).toBe(0)
    })

    it('is idempotent — second call does not register a second watcher', async () => {
      scope.run(() => {
        const store = useScoreWriterStore()
        store.installNetworkWatcher()
        store.installNetworkWatcher()
      })

      mockIsOnline.value = false
      await nextTick()

      // One watcher → exactly one warning toast, not two
      expect(mockWarning).toHaveBeenCalledTimes(1)
    })
  })
})
