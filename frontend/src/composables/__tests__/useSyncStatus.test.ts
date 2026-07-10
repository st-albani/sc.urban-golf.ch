import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSyncStatus } from '../useSyncStatus'

describe('useSyncStatus', () => {
  it('is idle and hidden when online with an empty queue', () => {
    const { tone, visible } = useSyncStatus(ref(true), ref(0))
    expect(tone.value).toBe('idle')
    expect(visible.value).toBe(false)
  })

  it('shows syncing when online with pending items', () => {
    const { tone, visible } = useSyncStatus(ref(true), ref(3))
    expect(tone.value).toBe('syncing')
    expect(visible.value).toBe(true)
  })

  it('shows offline (no count) when offline with an empty queue', () => {
    const { tone, visible } = useSyncStatus(ref(false), ref(0))
    expect(tone.value).toBe('offline')
    expect(visible.value).toBe(true)
  })

  it('shows offline-pending when offline with queued items', () => {
    const { tone, visible } = useSyncStatus(ref(false), ref(2))
    expect(tone.value).toBe('offline-pending')
    expect(visible.value).toBe(true)
  })

  it('reacts to network and queue changes', () => {
    const online = ref(false)
    const pending = ref(2)
    const { tone, visible } = useSyncStatus(online, pending)
    expect(tone.value).toBe('offline-pending')

    // Reconnect → items flush in the background
    online.value = true
    expect(tone.value).toBe('syncing')
    expect(visible.value).toBe(true)

    // Flush completes
    pending.value = 0
    expect(tone.value).toBe('idle')
    expect(visible.value).toBe(false)
  })
})
