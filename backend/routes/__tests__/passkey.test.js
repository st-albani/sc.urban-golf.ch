import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'

import { pgMock } from '../../test/helpers/pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

vi.mock('../../utils/mailer.js', () => ({
  sendMail: vi.fn().mockResolvedValue({}),
  isMailConfigured: () => true,
}))

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

import { getClient } from '../../db/pg.js'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import authRoutes from '../auth.js'
import { SESSION_COOKIE } from '../../utils/auth.js'
import { handleError } from '../../utils/errorHandler.js'

const CHALLENGE_ID = '6f1c1e0a-3b2d-4c5e-9f00-112233445566'
const credentialResponse = (id = 'cred-1') => ({
  id,
  rawId: id,
  type: 'public-key',
  response: { clientDataJSON: 'x', authenticatorData: 'y', signature: 'z' },
  clientExtensionResults: {},
})

// Router-artiger Mock-Client: pro SQL-Substring eine Antwort.
function createMockClient(handlers = []) {
  const client = {
    query: vi.fn(async (sql, params) => {
      for (const [needle, resp] of handlers) {
        if (sql.includes(needle)) return typeof resp === 'function' ? resp(params) : resp
      }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  }
  getClient.mockResolvedValue(client)
  return client
}

const session = ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna', player_id: 'p-anna-0001' }] }]

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  await app.register(fastifyCookie)
  app.register(authRoutes, { prefix: '/' })
  await app.ready()
  return app
}

describe('Passkey routes', () => {
  let app

  beforeEach(async () => {
    process.env.WEBAUTHN_RP_ID = 'urban-golf.test'
    process.env.WEBAUTHN_ORIGINS = 'https://urban-golf.test, https://www.urban-golf.test'
    app = await buildApp()
    getClient.mockReset()
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.WEBAUTHN_RP_ID
    delete process.env.WEBAUTHN_ORIGINS
    return app.close()
  })

  describe('POST /passkey/register-options', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'POST', url: '/passkey/register-options' })
      expect(res.statusCode).toBe(401)
    })

    it('returns options for the configured RP and stores a short-lived challenge', async () => {
      const client = createMockClient([
        session,
        ['SELECT credential_id, transports', { rows: [{ credential_id: 'old-cred', transports: ['internal'] }] }],
        ['INSERT INTO webauthn_challenges', { rows: [{ id: CHALLENGE_ID }] }],
      ])
      generateRegistrationOptions.mockResolvedValue({ challenge: 'reg-challenge', rp: { id: 'urban-golf.test' } })

      const before = Date.now()
      const res = await app.inject({
        method: 'POST',
        url: '/passkey/register-options',
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ challengeId: CHALLENGE_ID, options: { challenge: 'reg-challenge', rp: { id: 'urban-golf.test' } } })

      expect(generateRegistrationOptions).toHaveBeenCalledWith(expect.objectContaining({
        rpID: 'urban-golf.test',
        userName: 'a@b.com',
        excludeCredentials: [{ id: 'old-cred', transports: ['internal'] }],
      }))

      const insert = client.query.mock.calls.find((c) => c[0].includes('INSERT INTO webauthn_challenges'))
      const [type, challenge, accountId, expiresAt] = insert[1]
      expect([type, challenge, accountId]).toEqual(['registration', 'reg-challenge', 'acc1'])
      expect(expiresAt.getTime() - before).toBeLessThanOrEqual(5 * 60 * 1000 + 1000)
      // Abgelaufene Challenges werden dabei weggeräumt.
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM webauthn_challenges WHERE expires_at <= now()'), undefined)
    })
  })

  describe('POST /passkey/register-verify', () => {
    it('verifies against the configured origin/RP-ID and stores the credential with its sign count', async () => {
      const client = createMockClient([
        session,
        ['DELETE FROM webauthn_challenges\n', { rows: [{ challenge: 'reg-challenge' }] }],
      ])
      verifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 7, transports: ['internal', 'hybrid'] },
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: '/passkey/register-verify',
        payload: { challengeId: CHALLENGE_ID, response: credentialResponse() },
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM webauthn_challenges\n'),
        [CHALLENGE_ID, 'registration', 'acc1'],
      )
      expect(verifyRegistrationResponse).toHaveBeenCalledWith(expect.objectContaining({
        expectedChallenge: 'reg-challenge',
        expectedOrigin: ['https://urban-golf.test', 'https://www.urban-golf.test'],
        expectedRPID: 'urban-golf.test',
      }))
      const insert = client.query.mock.calls.find((c) => c[0].includes('INSERT INTO webauthn_credentials'))
      expect(insert[1]).toEqual(['acc1', 'cred-1', Buffer.from([1, 2, 3]), 7, ['internal', 'hybrid']])
    })

    it('rejects an unknown or expired challenge without verifying', async () => {
      createMockClient([session])
      const res = await app.inject({
        method: 'POST',
        url: '/passkey/register-verify',
        payload: { challengeId: CHALLENGE_ID, response: credentialResponse() },
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_challenge')
      expect(verifyRegistrationResponse).not.toHaveBeenCalled()
    })

    it('rejects a response that fails verification and stores nothing', async () => {
      const client = createMockClient([
        session,
        ['DELETE FROM webauthn_challenges\n', { rows: [{ challenge: 'reg-challenge' }] }],
      ])
      verifyRegistrationResponse.mockRejectedValue(new Error('Unexpected registration response origin'))
      const res = await app.inject({
        method: 'POST',
        url: '/passkey/register-verify',
        payload: { challengeId: CHALLENGE_ID, response: credentialResponse() },
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_passkey')
      expect(client.query.mock.calls.find((c) => c[0].includes('INSERT INTO webauthn_credentials'))).toBeUndefined()
    })

    it('rejects a malformed body via schema', async () => {
      createMockClient([session])
      const res = await app.inject({
        method: 'POST',
        url: '/passkey/register-verify',
        payload: { challengeId: 'nope', response: { id: 'x' } },
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /passkey/login-options', () => {
    it('returns usernameless options and stores an authentication challenge', async () => {
      const client = createMockClient([
        ['INSERT INTO webauthn_challenges', { rows: [{ id: CHALLENGE_ID }] }],
      ])
      generateAuthenticationOptions.mockResolvedValue({ challenge: 'auth-challenge', rpId: 'urban-golf.test' })

      const res = await app.inject({ method: 'POST', url: '/passkey/login-options' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ challengeId: CHALLENGE_ID, options: { challenge: 'auth-challenge', rpId: 'urban-golf.test' } })
      expect(generateAuthenticationOptions).toHaveBeenCalledWith(expect.objectContaining({ rpID: 'urban-golf.test' }))
      expect(generateAuthenticationOptions.mock.calls[0][0].allowCredentials).toBeUndefined()

      const insert = client.query.mock.calls.find((c) => c[0].includes('INSERT INTO webauthn_challenges'))
      expect(insert[1].slice(0, 3)).toEqual(['authentication', 'auth-challenge', null])
    })
  })

  describe('POST /passkey/login-verify', () => {
    const storedCredential = {
      id: 'row-1',
      account_id: 'acc1',
      credential_id: 'cred-1',
      public_key: Buffer.from([1, 2, 3]),
      sign_count: '7',
      transports: ['internal'],
    }

    it('verifies the assertion, advances the sign count and starts a session', async () => {
      const client = createMockClient([
        ['DELETE FROM webauthn_challenges\n', { rows: [{ challenge: 'auth-challenge' }] }],
        ['FROM webauthn_credentials WHERE credential_id', { rows: [storedCredential] }],
        ['FROM accounts WHERE id', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna', avatar: null, player_id: 'p-anna-0001' }] }],
      ])
      verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { credentialID: 'cred-1', newCounter: 8 },
      })

      const res = await app.inject({
        method: 'POST',
        url: '/passkey/login-verify',
        payload: { challengeId: CHALLENGE_ID, response: credentialResponse() },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().account).toEqual({ id: 'acc1', email: 'a@b.com', displayName: 'Anna', avatar: null, playerId: 'p-anna-0001' })
      expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeTruthy()

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM webauthn_challenges\n'),
        [CHALLENGE_ID, 'authentication', null],
      )
      expect(verifyAuthenticationResponse).toHaveBeenCalledWith(expect.objectContaining({
        expectedChallenge: 'auth-challenge',
        expectedOrigin: ['https://urban-golf.test', 'https://www.urban-golf.test'],
        expectedRPID: 'urban-golf.test',
        credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 7, transports: ['internal'] },
      }))
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET sign_count = $2'), ['row-1', 8])
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sessions'), expect.arrayContaining(['acc1']))
    })

    it('rejects an unknown passkey without a session', async () => {
      createMockClient([
        ['DELETE FROM webauthn_challenges\n', { rows: [{ challenge: 'auth-challenge' }] }],
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/passkey/login-verify',
        payload: { challengeId: CHALLENGE_ID, response: credentialResponse('unknown') },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_passkey')
      expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined()
      expect(verifyAuthenticationResponse).not.toHaveBeenCalled()
    })

    it('rejects a failed verification (e.g. sign-count regression) without a session', async () => {
      const client = createMockClient([
        ['DELETE FROM webauthn_challenges\n', { rows: [{ challenge: 'auth-challenge' }] }],
        ['FROM webauthn_credentials WHERE credential_id', { rows: [storedCredential] }],
      ])
      verifyAuthenticationResponse.mockRejectedValue(new Error('Response counter value 3 was lower than expected 7'))
      const res = await app.inject({
        method: 'POST',
        url: '/passkey/login-verify',
        payload: { challengeId: CHALLENGE_ID, response: credentialResponse() },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_passkey')
      expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined()
      expect(client.query.mock.calls.find((c) => c[0].includes('SET sign_count'))).toBeUndefined()
    })

    it('rejects a reused or expired challenge', async () => {
      createMockClient()
      const res = await app.inject({
        method: 'POST',
        url: '/passkey/login-verify',
        payload: { challengeId: CHALLENGE_ID, response: credentialResponse() },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_challenge')
    })
  })
})
