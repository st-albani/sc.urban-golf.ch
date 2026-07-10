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

  describe('POST /profile', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'POST', url: '/profile', payload: { displayName: 'Anna' } })
      expect(res.statusCode).toBe(401)
    })

    it('sets the display name and claims players with that name', async () => {
      const client = createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: null }] }],
        ['UPDATE accounts SET display_name', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
        ['INSERT INTO account_players', { rows: [{ player_id: 'p1' }, { player_id: 'p2' }] }],
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/profile',
        payload: { displayName: 'Anna' },
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        account: { id: 'acc1', email: 'a@b.com', displayName: 'Anna', avatar: null },
        claimedCount: 2,
      })
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO account_players'), ['acc1', 'Anna'])
    })
  })

  describe('POST /avatar', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'POST', url: '/avatar', payload: { avatar: 'data:image/png;base64,AAA' } })
      expect(res.statusCode).toBe(401)
    })

    it('stores a data-URL avatar', async () => {
      const client = createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna', avatar: null }] }],
        ['UPDATE accounts SET avatar', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna', avatar: 'data:image/png;base64,AAA' }] }],
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/avatar',
        payload: { avatar: 'data:image/png;base64,AAA' },
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().account.avatar).toBe('data:image/png;base64,AAA')
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE accounts SET avatar'), ['acc1', 'data:image/png;base64,AAA'])
    })

    it('rejects a non-image value by storing null', async () => {
      createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna', avatar: null }] }],
        ['UPDATE accounts SET avatar', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna', avatar: null }] }],
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/avatar',
        payload: { avatar: 'not-an-image' },
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().account.avatar).toBeNull()
    })
  })

  describe('GET /my-games', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'GET', url: '/my-games' })
      expect(res.statusCode).toBe(401)
    })

    it('returns owned and participated games (created_by ∪ claimed players)', async () => {
      const client = createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
        ['WITH my_games AS', { rows: [{ id: 'g1', name: 'Stadtpark', players: [], holes: [1, 2] }] }],
      ])
      const res = await app.inject({
        method: 'GET',
        url: '/my-games',
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().games).toHaveLength(1)
      expect(res.json().games[0].name).toBe('Stadtpark')

      // Der Ownership-Zweig (created_by) muss Teil der Abfrage sein.
      const myGamesCall = client.query.mock.calls.find((c) => c[0].includes('WITH my_games AS'))
      expect(myGamesCall[0]).toContain('created_by = $1')
    })
  })

  describe('GET /stats', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'GET', url: '/stats' })
      expect(res.statusCode).toBe(401)
    })

    it('computes rounds, averages and win rate from claimed rounds', async () => {
      createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
        ['WITH my_players AS', {
          rows: [
            { game_id: 'g1', name: 'R1', created_at: '2026-01-01', my_total: 12, my_holes: 3, best_total: 8 },
            { game_id: 'g2', name: 'R2', created_at: '2026-01-02', my_total: 9, my_holes: 3, best_total: 9 },
            { game_id: 'g3', name: 'R3', created_at: '2026-01-03', my_total: 0, my_holes: 0, best_total: null },
          ],
        }],
      ])
      const res = await app.inject({ method: 'GET', url: '/stats', cookies: { [SESSION_COOKIE]: 'tok' } })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.rounds).toBe(2) // g3 has no holes played
      expect(body.overallAvg).toBe(3.5) // (12+9)/(3+3)
      expect(body.bestRoundAvg).toBe(3)
      expect(body.worstRoundAvg).toBe(4)
      expect(body.wins).toBe(1) // only R2 (my_total == best_total)
      expect(body.winRate).toBe(0.5)
      expect(body.trend).toHaveLength(2)
    })
  })

  describe('GET /opponents', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'GET', url: '/opponents' })
      expect(res.statusCode).toBe(401)
    })

    it('lists recurring co-players', async () => {
      createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
        ['my_names AS', { rows: [{ name: 'Boris', rounds: 5 }, { name: 'Chris', rounds: 2 }] }],
      ])
      const res = await app.inject({ method: 'GET', url: '/opponents', cookies: { [SESSION_COOKIE]: 'tok' } })
      expect(res.statusCode).toBe(200)
      expect(res.json().opponents).toHaveLength(2)
      expect(res.json().opponents[0]).toEqual({ name: 'Boris', rounds: 5 })
    })
  })

  describe('GET /head-to-head', () => {
    it('requires a name', async () => {
      createMockClient([['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }]])
      const res = await app.inject({ method: 'GET', url: '/head-to-head', cookies: { [SESSION_COOKIE]: 'tok' } })
      expect(res.statusCode).toBe(400)
    })

    it('computes the balance over shared rounds', async () => {
      createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
        ['shared AS', {
          rows: [
            { game_id: 'g1', my_total: 10, my_holes: 3, opp_total: 12, opp_holes: 3 }, // win
            { game_id: 'g2', my_total: 14, my_holes: 3, opp_total: 11, opp_holes: 3 }, // loss
            { game_id: 'g3', my_total: 9, my_holes: 3, opp_total: 9, opp_holes: 3 }, // tie
          ],
        }],
      ])
      const res = await app.inject({
        method: 'GET',
        url: '/head-to-head?name=Boris',
        cookies: { [SESSION_COOKIE]: 'tok' },
      })
      expect(res.statusCode).toBe(200)
      const b = res.json()
      expect(b).toMatchObject({ name: 'Boris', shared: 3, wins: 1, losses: 1, ties: 1 })
      expect(b.myAvg).toBe(3.67)
      expect(b.opponentAvg).toBe(3.56)
    })
  })

  describe('GET /account-summary', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'GET', url: '/account-summary' })
      expect(res.statusCode).toBe(401)
    })

    it('returns the linked data', async () => {
      createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
        ['FROM account_players ap JOIN players', { rows: [{ name: 'Anna' }, { name: 'Anna M.' }] }],
        ['COUNT(DISTINCT gp.game_id)', { rows: [{ rounds: 7 }] }],
      ])
      const res = await app.inject({ method: 'GET', url: '/account-summary', cookies: { [SESSION_COOKIE]: 'tok' } })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        email: 'a@b.com', displayName: 'Anna', playerNames: ['Anna', 'Anna M.'], rounds: 7,
      })
    })
  })

  describe('DELETE /account', () => {
    it('requires a session', async () => {
      createMockClient()
      const res = await app.inject({ method: 'DELETE', url: '/account' })
      expect(res.statusCode).toBe(401)
    })

    it('keeps scores by default (deletes account only)', async () => {
      const client = createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
      ])
      const res = await app.inject({ method: 'DELETE', url: '/account', cookies: { [SESSION_COOKIE]: 'tok' } })
      expect(res.statusCode).toBe(200)
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM accounts'), ['acc1'])
      expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM players'), expect.anything())
    })

    it('removes claimed players when keepScores=false', async () => {
      const client = createMockClient([
        ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
      ])
      const res = await app.inject({ method: 'DELETE', url: '/account?keepScores=false', cookies: { [SESSION_COOKIE]: 'tok' } })
      expect(res.statusCode).toBe(200)
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM players'), ['acc1'])
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM accounts'), ['acc1'])
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
