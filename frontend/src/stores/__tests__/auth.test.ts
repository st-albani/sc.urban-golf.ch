import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  requestOtp: vi.fn().mockResolvedValue(undefined),
  verifyOtp: vi.fn(),
  fetchMe: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  fetchPasskeyRegisterOptions: vi.fn(),
  verifyPasskeyRegistration: vi.fn().mockResolvedValue(undefined),
  fetchPasskeyLoginOptions: vi.fn(),
  verifyPasskeyLogin: vi.fn(),
}))

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => true,
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}))

import { useAuthStore } from '../auth'
import {
  requestOtp, verifyOtp, fetchMe, logout,
  fetchPasskeyRegisterOptions, verifyPasskeyRegistration, fetchPasskeyLoginOptions, verifyPasskeyLogin,
} from '@/services/api'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'

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
    vi.mocked(fetchMe).mockResolvedValue({ id: 'a1', email: 'a@b.com', displayName: 'Anna', avatar: null, playerId: null })
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
    vi.mocked(verifyOtp).mockResolvedValue({ id: 'a1', email: 'a@b.com', displayName: null, avatar: null, playerId: null })
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
    vi.mocked(verifyOtp).mockResolvedValue({ id: 'a1', email: 'a@b.com', displayName: null, avatar: null, playerId: null })
    const s = useAuthStore()
    await s.verifyOtp('a@b.com', '123456')
    await s.logout()
    expect(s.isLoggedIn).toBe(false)
    expect(logout).toHaveBeenCalled()
  })

  it('registerPasskey runs the ceremony with the server options and verifies with the same challenge', async () => {
    const options = { challenge: 'c1' } as PublicKeyCredentialCreationOptionsJSON
    const response = { id: 'cred-1' } as RegistrationResponseJSON
    vi.mocked(fetchPasskeyRegisterOptions).mockResolvedValue({ challengeId: 'ch-1', options })
    vi.mocked(startRegistration).mockResolvedValue(response)
    const s = useAuthStore()
    await s.registerPasskey()
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: options })
    expect(verifyPasskeyRegistration).toHaveBeenCalledWith('ch-1', response)
  })

  it('loginWithPasskey logs in with the returned account', async () => {
    const options = { challenge: 'c2' } as PublicKeyCredentialRequestOptionsJSON
    const response = { id: 'cred-1' } as AuthenticationResponseJSON
    vi.mocked(fetchPasskeyLoginOptions).mockResolvedValue({ challengeId: 'ch-2', options })
    vi.mocked(startAuthentication).mockResolvedValue(response)
    vi.mocked(verifyPasskeyLogin).mockResolvedValue({ id: 'a1', email: 'a@b.com', displayName: 'Anna', avatar: null, playerId: 'p1' })
    const s = useAuthStore()
    await s.loginWithPasskey()
    expect(verifyPasskeyLogin).toHaveBeenCalledWith('ch-2', response)
    expect(s.isLoggedIn).toBe(true)
    expect(s.account?.email).toBe('a@b.com')
  })

  it('loginWithPasskey stays logged out when the user cancels', async () => {
    vi.mocked(fetchPasskeyLoginOptions).mockResolvedValue({ challengeId: 'ch-3', options: { challenge: 'c3' } as PublicKeyCredentialRequestOptionsJSON })
    vi.mocked(startAuthentication).mockRejectedValue(new Error('NotAllowedError'))
    const s = useAuthStore()
    await expect(s.loginWithPasskey()).rejects.toThrow()
    expect(verifyPasskeyLogin).not.toHaveBeenCalled()
    expect(s.isLoggedIn).toBe(false)
  })
})
