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
import gameRoutes from '../games.js'
import authRoutes from '../auth.js'
import { handleError } from '../../utils/errorHandler.js'
import { SESSION_COOKIE } from '../../utils/auth.js'
import { avgStrokesSql } from '../../utils/standingsSql.js'
import { AVERAGE_DECIMALS, playerStandings } from '@urban-golf/contract/standings'

// Die Summary-Read-Models aggregieren aus Pagination-Gründen in SQL. Diese
// Tests nageln sie an den Standings-Vertrag: dieselbe Rundung, dieselbe Zahl.

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

async function buildApp(routes) {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  await app.register(fastifyCookie)
  app.register(routes, { prefix: '/' })
  await app.ready()
  return app
}

function sqlContaining(client, needle) {
  return client.query.mock.calls.find((c) => c[0].includes(needle))?.[0]
}

describe('summary read-model rounding', () => {
  let app

  beforeEach(() => {
    getClient.mockReset()
  })

  afterEach(() => app?.close())

  it('rounds the average in SQL with the decimals from the standings contract', async () => {
    app = await buildApp(gameRoutes)
    const client = createMockClient([['SELECT COUNT(*)', { rows: [{ count: '0' }] }]])

    const res = await app.inject({ method: 'GET', url: '/summary' })
    expect(res.statusCode).toBe(200)

    const sql = sqlContaining(client, 'player_stats AS')
    expect(sql).toContain(`${avgStrokesSql('s.strokes')} AS avg`)
    expect(sql).toContain(`ROUND(AVG(s.strokes)::numeric, ${AVERAGE_DECIMALS})`)
  })

  it('uses the same expression for the account read-model', async () => {
    app = await buildApp(authRoutes)
    const client = createMockClient([
      ['FROM sessions s', { rows: [{ id: 'acc1', email: 'a@b.com', display_name: 'Anna' }] }],
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/my-games',
      cookies: { [SESSION_COOKIE]: 'tok' },
    })
    expect(res.statusCode).toBe(200)

    const sql = sqlContaining(client, 'WITH my_games AS')
    expect(sql).toContain(`${avgStrokesSql('s.strokes')} AS avg`)
  })

  it('agrees with the standings module on a fixed fixture', () => {
    // Was Postgres für diese Schlagfolgen liefert — AVG als exaktes numeric,
    // dann ROUND(..., AVERAGE_DECIMALS), kaufmännisch weg von der Null.
    const fixture = [
      { strokes: { 1: 3, 2: 4, 3: 4 }, postgres: 3.7 }, // 11/3  = 3.666… → 3.7
      { strokes: { 1: 3, 2: 4 }, postgres: 3.5 }, //       7/2   = 3.5
      { strokes: { 1: 3, 2: 3, 3: 4, 4: 3 }, postgres: 3.3 }, // 13/4 = 3.25 → 3.3
      { strokes: { 1: -3, 2: -3, 3: -4, 4: -3 }, postgres: -3.3 }, // -3.25 → -3.3
      { strokes: {}, postgres: null }, //                  AVG über nichts = NULL
    ]

    for (const { strokes, postgres } of fixture) {
      expect(playerStandings({ p1: strokes }, 'p1').average).toBe(postgres)
    }
  })
})
