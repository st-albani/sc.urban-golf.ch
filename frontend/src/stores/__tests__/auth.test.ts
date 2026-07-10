import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  requestOtp: vi.fn().mockResolvedValue(undefined),
  verifyOtp: vi.fn(),
  fetchMe: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}))

import { useAuthStore } from '../auth'
import { requestOtp, verifyOtp, fetchMe, logout } from '@/services/api'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts logged out', () => {
    const s = useAuthStore()
    expect(s.isLoggedIn).toBe(false)
    expect(s.loaded).toBe(false)
  })

  it('loadMe restores an existing session', async () => {
    vi.mocked(fetchMe).mockResolvedValue({ id: 'a1', email: 'a@b.com', displayName: 'Anna', avatar: null })
    const s = useAuthStore()
    await s.loadMe()
    expect(s.isLoggedIn).toBe(true)
    expect(s.account?.email).toBe('a@b.com')
    expect(s.displayName).toBe('Anna')
    expect(s.loaded).toBe(true)
  })

  it('loadMe leaves logged out when there is no session', async () => {
    vi.mocked(fetchMe).mockResolvedValue(null)
    const s = useAuthStore()
    await s.loadMe()
    expect(s.isLoggedIn).toBe(false)
    expect(s.loaded).toBe(true)
  })

  it('requestOtp delegates to the API', async () => {
    const s = useAuthStore()
    await s.requestOtp('a@b.com')
    expect(requestOtp).toHaveBeenCalledWith('a@b.com')
  })

  it('verifyOtp logs in with the returned account', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ id: 'a1', email: 'a@b.com', displayName: null, avatar: null })
    const s = useAuthStore()
    await s.verifyOtp('a@b.com', '123456')
    expect(s.isLoggedIn).toBe(true)
    expect(verifyOtp).toHaveBeenCalledWith('a@b.com', '123456')
  })

  it('verifyOtp propagates an invalid-code error and stays logged out', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new Error('invalid'))
    const s = useAuthStore()
    await expect(s.verifyOtp('a@b.com', '000000')).rejects.toThrow()
    expect(s.isLoggedIn).toBe(false)
  })

  it('logout clears the account even if the API call is the last step', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ id: 'a1', email: 'a@b.com', displayName: null, avatar: null })
    const s = useAuthStore()
    await s.verifyOtp('a@b.com', '123456')
    await s.logout()
    expect(s.isLoggedIn).toBe(false)
    expect(logout).toHaveBeenCalled()
  })
})
