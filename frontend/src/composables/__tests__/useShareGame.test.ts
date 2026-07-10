import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useShareGame } from '../useShareGame'

describe('useShareGame', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://sc.urban-golf.ch' } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('builds the share URL from the origin and game id', () => {
    const { shareUrl } = useShareGame(ref('mock-game-alpha-2026'))
    expect(shareUrl.value).toBe('https://sc.urban-golf.ch/games/mock-game-alpha-2026')
  })

  it('copyLink writes the URL to the clipboard and toggles copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyLink, copied } = useShareGame(ref('game1234567890'))

    expect(copied.value).toBe(false)
    const ok = await copyLink()
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://sc.urban-golf.ch/games/game1234567890')
    expect(copied.value).toBe(true)
  })

  it('copyLink returns false when the clipboard write fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const { copyLink, copied } = useShareGame(ref('game1234567890'))
    expect(await copyLink()).toBe(false)
    expect(copied.value).toBe(false)
  })

  it('nativeShare uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    const { nativeShare, canNativeShare } = useShareGame(ref('game1234567890'))
    expect(canNativeShare.value).toBe(true)
    await nativeShare('Stadtpark-Runde')
    expect(share).toHaveBeenCalledWith({
      title: 'Stadtpark-Runde',
      url: 'https://sc.urban-golf.ch/games/game1234567890',
    })
  })

  it('nativeShare falls back to clipboard when Web Share API is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { nativeShare, canNativeShare } = useShareGame(ref('game1234567890'))
    expect(canNativeShare.value).toBe(false)
    await nativeShare('Stadtpark-Runde')
    expect(writeText).toHaveBeenCalledWith('https://sc.urban-golf.ch/games/game1234567890')
  })

  it('nativeShare swallows a user cancellation without throwing', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    vi.stubGlobal('navigator', { share })
    const { nativeShare } = useShareGame(ref('game1234567890'))
    await expect(nativeShare('Stadtpark-Runde')).resolves.toBeUndefined()
  })
})
