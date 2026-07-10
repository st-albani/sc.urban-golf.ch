import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, effectScope, nextTick, type EffectScope } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const mockIsOnline = ref(true)
vi.mock('@vueuse/core', () => ({
  useOnline: () => mockIsOnline,
  useLocalStorage: (_key: string, defaultValue: unknown) => ref(defaultValue),
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

import { useScoreSyncStore } from '../scoreSync'
import { useSyncQueueStore } from '@/stores/syncQueue'
import { saveScore as apiSaveScore } from '@/services/api'

const mockApiSave = vi.mocked(apiSaveScore)

describe('useScoreSyncStore', () => {
  let scope: EffectScope
  let queueStore: ReturnType<typeof useSyncQueueStore>

  beforeEach(() => {
    scope = effectScope()
    setActivePinia(createPinia())
    queueStore = useSyncQueueStore()
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

  describe('saveScore', () => {
    it('calls API directly when online', async () => {
      mockApiSave.mockResolvedValue({ id: 1, game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })
      const store = scope.run(() => useScoreSyncStore())!

      await store.saveScore({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })

      expect(mockApiSave).toHaveBeenCalledWith({
        game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3,
      })
      expect(queueStore.queue).toHaveLength(0)
    })

    it('queues score when offline', async () => {
      mockIsOnline.value = false
      const store = scope.run(() => useScoreSyncStore())!

      await store.saveScore({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })

      expect(mockApiSave).not.toHaveBeenCalled()
      expect(queueStore.queue).toHaveLength(1)
      expect(queueStore.queue[0]).toMatchObject({ game_id: 'g1234567890123', hole: 1, strokes: 3 })
    })
  })

  describe('flushQueue', () => {
    it('sends all queued scores and removes them', async () => {
      const store = scope.run(() => useScoreSyncStore())!

      queueStore.enqueue({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })
      queueStore.enqueue({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 2, strokes: 4 })
      expect(queueStore.queue).toHaveLength(2)

      mockApiSave.mockResolvedValue({ id: 1, game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })

      await store.flushQueue()

      expect(mockApiSave).toHaveBeenCalledTimes(2)
      expect(queueStore.queue).toHaveLength(0)
      expect(mockSuccess).toHaveBeenCalledWith('Sync.Synced', 3000)
    })

    it('does nothing when offline', async () => {
      mockIsOnline.value = false
      const store = scope.run(() => useScoreSyncStore())!

      await store.saveScore({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })
      await store.flushQueue()

      expect(mockApiSave).not.toHaveBeenCalled()
    })

    it('does nothing when queue is empty', async () => {
      const store = scope.run(() => useScoreSyncStore())!
      await store.flushQueue()

      expect(mockApiSave).not.toHaveBeenCalled()
    })

    it('handles partial failures', async () => {
      const store = scope.run(() => useScoreSyncStore())!

      queueStore.enqueue({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })
      queueStore.enqueue({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 2, strokes: 4 })

      mockApiSave
        .mockResolvedValueOnce({ id: 1, game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })
        .mockRejectedValueOnce(new Error('Network error'))

      await store.flushQueue()

      expect(queueStore.queue).toHaveLength(1)
      expect(queueStore.queue[0].hole).toBe(2)
      expect(mockSuccess).toHaveBeenCalledWith('Sync.Synced', 3000)
      expect(mockError).toHaveBeenCalledWith('Sync.SyncFailed', 6000)
    })
  })

  describe('installNetworkWatcher', () => {
    it('shows warning toast when going offline', async () => {
      scope.run(() => {
        const store = useScoreSyncStore()
        store.installNetworkWatcher()
      })

      mockIsOnline.value = false
      await nextTick()

      expect(mockWarning).toHaveBeenCalledWith('Network.Offline', 0)
    })

    it('shows success toast and flushes queue when coming back online', async () => {
      mockIsOnline.value = false
      scope.run(() => {
        const store = useScoreSyncStore()
        store.installNetworkWatcher()
      })

      queueStore.enqueue({ game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })
      mockApiSave.mockResolvedValue({ id: 1, game_id: 'g1234567890123', player_id: 'p1234567890123', hole: 1, strokes: 3 })

      mockIsOnline.value = true
      await nextTick()
      await new Promise(r => setTimeout(r, 50))

      expect(mockSuccess).toHaveBeenCalledWith('Network.BackOnline', 3000)
      expect(mockApiSave).toHaveBeenCalled()
      expect(queueStore.queue).toHaveLength(0)
    })

    it('is idempotent — second call does not register a second watcher', async () => {
      scope.run(() => {
        const store = useScoreSyncStore()
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
