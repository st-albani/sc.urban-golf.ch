import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'

import { pgMock } from './_pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import gameRoutes from '../games.js'
import { handleError } from '../../utils/errorHandler.js'

function createMockClient(queryImpl) {
  const client = {
    query: vi.fn(queryImpl || (() => ({ rows: [], rowCount: 0 }))),
    release: vi.fn(),
  }
  getClient.mockResolvedValue(client)
  return client
}

function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  // Cookie-Plugin: nötig, damit POST /games die (optionale) Session lesen kann.
  app.register(fastifyCookie)
  app.register(gameRoutes, { prefix: '/' })
  return app
}

// Findet die Parameter des INSERT-INTO-games-Aufrufs auf dem Mock-Client.
function gamesInsertParams(client) {
  const call = client.query.mock.calls.find((c) => c[0].includes('INSERT INTO games'))
  return call?.[1]
}

describe('POST /games', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('creates a game with players', async () => {
    const client = createMockClient((sql) => {
      if (sql.includes('INSERT INTO games')) {
        return { rows: [{ id: 'game1234567890', name: 'My Game' }] }
      }
      return { rows: [] }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        id: 'game1234567890',
        name: 'My Game',
        players: ['player1234567890'],
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('upserted')
    expect(body.name).toBe('My Game')
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })

  it('stamps created_by from the session when logged in', async () => {
    const client = createMockClient((sql) => {
      // Session-Lookup in getAccountFromRequest
      if (sql.includes('FROM sessions')) {
        return { rows: [{ id: 'acc-owner-1', email: 'owner@example.com', display_name: null, avatar: null }] }
      }
      if (sql.includes('INSERT INTO games')) {
        return { rows: [{ id: 'game1234567890', name: 'Owned Game' }] }
      }
      return { rows: [] }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      cookies: { ug_session: 'valid-token' },
      payload: {
        id: 'game1234567890',
        name: 'Owned Game',
        players: ['player1234567890'],
      },
    })

    expect(res.statusCode).toBe(200)
    // created_by ist der dritte Parameter des INSERT.
    expect(gamesInsertParams(client)?.[2]).toBe('acc-owner-1')
  })

  it('leaves created_by null for anonymous creation', async () => {
    const client = createMockClient((sql) => {
      if (sql.includes('INSERT INTO games')) {
        return { rows: [{ id: 'game1234567890', name: 'Anon Game' }] }
      }
      return { rows: [] }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        id: 'game1234567890',
        name: 'Anon Game',
        players: ['player1234567890'],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(gamesInsertParams(client)?.[2]).toBeNull()
    // Ohne Cookie darf kein Session-Lookup passieren.
    const sessionCall = client.query.mock.calls.find((c) => c[0].includes('FROM sessions'))
    expect(sessionCall).toBeUndefined()
  })

  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'short', name: '', players: [] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
  })

  it('returns 500 and rolls back on DB error', async () => {
    createMockClient((sql) => {
      if (sql === 'BEGIN') return { rows: [] }
      if (sql === 'ROLLBACK') return { rows: [] }
      throw new Error('DB connection lost')
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        id: 'game1234567890',
        name: 'Crash Game',
        players: ['player1234567890'],
      },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Database error')
  })
})

describe('GET /games', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('returns paginated games', async () => {
    createMockClient((sql) => {
      if (sql.includes('COUNT')) return { rows: [{ count: '5' }] }
      return { rows: [{ id: 'g1', name: 'Game 1' }] }
    })

    const res = await app.inject({
      method: 'GET',
      url: '/?page=1&per_page=4',
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.games).toHaveLength(1)
    expect(body.total).toBe(5)
  })

  it('supports search parameter', async () => {
    const client = createMockClient(() => ({ rows: [{ count: '0' }] }))

    await app.inject({
      method: 'GET',
      url: '/?search=alpha',
    })

    const searchCall = client.query.mock.calls.find(c => c[0].includes('ILIKE'))
    expect(searchCall).toBeDefined()
    expect(searchCall[1]).toContain('%alpha%')
  })
})

describe('GET /games/:id', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('returns a game by id', async () => {
    createMockClient(() => ({
      rows: [{ id: 'game1234567890', name: 'Found Game' }],
      rowCount: 1,
    }))

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Found Game')
  })

  it('returns 404 for nonexistent game', async () => {
    createMockClient(() => ({ rows: [], rowCount: 0 }))

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890',
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bad',
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /games/:id/players', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('returns players for a game', async () => {
    createMockClient(() => ({
      rows: [
        { id: 'p1234567890123', name: 'Alice' },
        { id: 'p2345678901234', name: 'Bob' },
      ],
    }))

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890/players',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
  })

  it('returns 400 for invalid game id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bad/players',
    })

    expect(res.statusCode).toBe(400)
  })
})
