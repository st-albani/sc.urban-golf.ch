import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'

import { pgMock } from './_pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

vi.mock('../../utils/mailer.js', () => ({
  sendMail: vi.fn().mockResolvedValue({}),
  isMailConfigured: () => true,
}))

import { getClient } from '../../db/pg.js'
import { sendMail } from '../../utils/mailer.js'
import authRoutes from '../auth.js'
import { hashToken, SESSION_COOKIE } from '../../utils/auth.js'
import { handleError } from '../../utils/errorHandler.js'

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

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  await app.register(fastifyCookie)
  app.register(authRoutes, { prefix: '/' })
  await app.ready()
  return app
}

describe('Auth routes', () => {
  let app

  beforeEach(async () => {
    app = await buildApp()
    getClient.mockReset()
    sendMail.mockClear()
  })

  afterEach(() => app.close())

  describe('POST /request-otp', () => {
    it('stores a code, mails it, and always answers ok', async () => {
      const client = createMockClient()
      const res = await app.inject({
        method: 'POST',
        url: '/request-otp',
        payload: { email: 'User@Example.com' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })
      // Alte Codes entwertet + neuen eingefügt (E-Mail normalisiert)
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE otp_codes SET consumed_at'), ['user@example.com'])
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO otp_codes'), expect.arrayContaining(['user@example.com']))
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }))
    })

    it('rejects an invalid email via schema', async () => {
      const res = await app.inject({ method: 'POST', url: '/request-otp', payload: { email: 'nope' } })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /verify-otp', () => {
    it('verifies a correct code, creates a session and sets a cookie', async () => {
      const code = '123456'
      createMockClient([
        ['code_hash, attempts FROM otp_codes', { rows: [{ id: 'otp1', code_hash: hashToken(code), attempts: 0 }] }],
        ['SET consumed_at', { rows: [] }],
        ['INSERT INTO accounts', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: null }] }],
        ['INSERT INTO sessions', { rows: [] }],
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/verify-otp',
        payload: { email: 'a@b.com', code },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().account).toMatchObject({ id: 'acc1', email: 'a@b.com', displayName: null })
      expect(res.cookies.find((c) => c.name === SESSION_COOKIE)).toBeTruthy()
    })

    it('rejects a wrong code and counts the attempt', async () => {
      const client = createMockClient([
        ['code_hash, attempts FROM otp_codes', { rows: [{ id: 'otp1', code_hash: hashToken('111111'), attempts: 0 }] }],
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/verify-otp',
        payload: { email: 'a@b.com', code: '999999' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_code')
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET attempts = attempts + 1'), ['otp1'])
    })

    it('rejects when there is no active challenge', async () => {
      createMockClient([['code_hash, attempts FROM otp_codes', { rows: [] }]])
      const res = await app.inject({
        method: 'POST',
        url: '/verify-otp',
        payload: { email: 'a@b.com', code: '123456' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_code')
    })
  })

  describe('GET /me', () => {
    it('returns 401 without a session cookie', async () => {
      createMockClient()
      const res = await app.inject({ method: 'GET', url: '/me' })
      expect(res.statusCode).toBe(401)
    })

    it('returns the account for a valid session', async () => {
      createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
      ])
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        cookies: { [SESSION_COOKIE]: 'sometoken' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().account).toMatchObject({ id: 'acc1', email: 'a@b.com', displayName: 'Anna' })
    })
  })

  describe('POST /logout', () => {
    it('deletes the session and clears the cookie', async () => {
      const client = createMockClient()
      const res = await app.inject({
        method: 'POST',
        url: '/logout',
        cookies: { [SESSION_COOKIE]: 'sometoken' },
      })
      expect(res.statusCode).toBe(200)
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sessions'), [hashToken('sometoken')])
      const cleared = res.cookies.find((c) => c.name === SESSION_COOKIE)
      expect(cleared && (cleared.value === '' || cleared.expires)).toBeTruthy()
    })
  })
})
