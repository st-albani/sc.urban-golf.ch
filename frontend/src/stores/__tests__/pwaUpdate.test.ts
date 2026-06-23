import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { usePWAUpdateStore } from '../pwaUpdate'

describe('usePWAUpdateStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with updateAvailable=false', () => {
    const store = usePWAUpdateStore()
    expect(store.updateAvailable).toBe(false)
  })

  it('registerUpdate() flips updateAvailable and stores the fn', () => {
    const store = usePWAUpdateStore()
    const mockUpdateFn = vi.fn()

    store.registerUpdate(mockUpdateFn)

    expect(store.updateAvailable).toBe(true)
  })

  it('registerUpdate() keeps dialog open — no auto-hide (user must decide)', () => {
    const store = usePWAUpdateStore()
    store.registerUpdate(vi.fn())

    expect(store.updateAvailable).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(store.updateAvailable).toBe(true)
  })

  it('applyUpdate() hides dialog and calls updateFn(true)', async () => {
    const mockUpdateFn = vi.fn().mockResolvedValue(undefined)
    const store = usePWAUpdateStore()

    store.registerUpdate(mockUpdateFn)
    await store.applyUpdate()

    expect(store.updateAvailable).toBe(false)
    expect(mockUpdateFn).toHaveBeenCalledWith(true)
  })

  it('dismissUpdate() hides dialog without calling updateFn', () => {
    const mockUpdateFn = vi.fn()
    const store = usePWAUpdateStore()

    store.registerUpdate(mockUpdateFn)
    store.dismissUpdate()

    expect(store.updateAvailable).toBe(false)
    expect(mockUpdateFn).not.toHaveBeenCalled()
  })

  it('shares state across multiple useStore() calls (Pinia singleton)', () => {
    const a = usePWAUpdateStore()
    a.registerUpdate(vi.fn())

    const b = usePWAUpdateStore()
    expect(b.updateAvailable).toBe(true)
  })

  it('different pinia instances do not leak state (test isolation)', () => {
    const a = usePWAUpdateStore()
    a.registerUpdate(vi.fn())
    expect(a.updateAvailable).toBe(true)

    setActivePinia(createPinia())
    const b = usePWAUpdateStore()
    expect(b.updateAvailable).toBe(false)
  })
})
