import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'

const toDataURL = vi.fn()
vi.mock('qrcode', () => ({ default: { toDataURL: (...a: unknown[]) => toDataURL(...a) } }))

import { useQrCode } from '../useQrCode'

describe('useQrCode', () => {
  it('generates a data URL from the text', async () => {
    toDataURL.mockResolvedValue('data:image/png;base64,ABC')
    const text = ref('https://sc.urban-golf.ch/games/game1234567890')
    const { dataUrl } = useQrCode(text)
    await nextTick()
    await Promise.resolve()
    expect(toDataURL).toHaveBeenCalledWith(text.value, expect.objectContaining({ margin: 1 }))
    expect(dataUrl.value).toBe('data:image/png;base64,ABC')
  })

  it('regenerates when the text changes', async () => {
    toDataURL.mockResolvedValue('data:image/png;base64,ONE')
    const text = ref('https://sc.urban-golf.ch/games/aaaaaaaaaa')
    const { dataUrl } = useQrCode(text)
    await Promise.resolve()
    toDataURL.mockResolvedValue('data:image/png;base64,TWO')
    text.value = 'https://sc.urban-golf.ch/games/bbbbbbbbbb'
    await nextTick()
    await Promise.resolve()
    expect(dataUrl.value).toBe('data:image/png;base64,TWO')
  })

  it('sets failed and clears the url when generation throws', async () => {
    toDataURL.mockRejectedValue(new Error('boom'))
    const { dataUrl, failed } = useQrCode(ref('x'))
    await nextTick()
    await Promise.resolve()
    expect(dataUrl.value).toBe('')
    expect(failed.value).toBe(true)
  })

  it('produces no url for empty text', async () => {
    const { dataUrl } = useQrCode(ref(''))
    await nextTick()
    expect(dataUrl.value).toBe('')
  })
})
