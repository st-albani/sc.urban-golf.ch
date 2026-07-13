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

  it('persists visibility=private for a logged-in creator', async () => {
    const client = createMockClient((sql) => {
      if (sql.includes('FROM sessions')) {
        return { rows: [{ id: 'acc-owner-1', email: 'owner@example.com', display_name: null, avatar: null }] }
      }
      if (sql.includes('INSERT INTO games')) {
        return { rows: [{ id: 'game1234567890', name: 'Private Game', visibility: 'private' }] }
      }
      return { rows: [] }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      cookies: { ug_session: 'valid-token' },
      payload: {
        id: 'game1234567890',
        name: 'Private Game',
        players: ['player1234567890'],
        visibility: 'private',
      },
    })

    expect(res.statusCode).toBe(200)
    // visibility ist der vierte Parameter des INSERT.
    expect(gamesInsertParams(client)?.[3]).toBe('private')
    // Die Sichtbarkeitsänderung ist ownership-gebunden (CASE im UPSERT).
    const insertCall = client.query.mock.calls.find((c) => c[0].includes('INSERT INTO games'))
    expect(insertCall[0]).toContain('games.created_by = $3')
  })

  it('forces visibility=public for anonymous creation', async () => {
    const client = createMockClient((sql) => {
      if (sql.includes('INSERT INTO games')) {
        return { rows: [{ id: 'game1234567890', name: 'Anon Game', visibility: 'public' }] }
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
        visibility: 'private',
      },
    })

    expect(res.statusCode).toBe(200)
    // Ohne Session bleibt das Spiel öffentlich, obwohl 'private' gewünscht wurde.
    expect(gamesInsertParams(client)?.[3]).toBe('public')
  })

  it('rejects an invalid visibility value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        id: 'game1234567890',
        name: 'Bad Vis',
        players: ['player1234567890'],
        visibility: 'secret',
      },
    })

    expect(res.statusCode).toBe(400)
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

  it('hides private games from anonymous requests (guard, me=null)', async () => {
    const client = createMockClient((sql) => {
      if (sql.includes('COUNT')) return { rows: [{ count: '2' }] }
      return { rows: [{ id: 'g1', name: 'Public Game', visibility: 'public' }] }
    })

    const res = await app.inject({ method: 'GET', url: '/?page=1&per_page=4' })

    expect(res.statusCode).toBe(200)
    const listCall = client.query.mock.calls.find((c) => c[0].includes('FROM games g') && !c[0].includes('COUNT'))
    // Der Guard schränkt anonym auf öffentliche Spiele ein; me (Param 1) ist null.
    expect(listCall[0]).toContain("g.visibility = 'public'")
    expect(listCall[1][0]).toBeNull()
  })

  it('scopes the guard to the account for a logged-in request', async () => {
    const client = createMockClient((sql) => {
      if (sql.includes('FROM sessions')) {
        return { rows: [{ id: 'acc-1', email: 'a@b.c', display_name: null, avatar: null }] }
      }
      if (sql.includes('COUNT')) return { rows: [{ count: '3' }] }
      return { rows: [{ id: 'g1', name: 'Mine', visibility: 'private' }] }
    })

    const res = await app.inject({
      method: 'GET',
      url: '/?page=1&per_page=4',
      cookies: { ug_session: 'valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const listCall = client.query.mock.calls.find((c) => c[0].includes('FROM games g') && !c[0].includes('COUNT'))
    // me (Param 1) trägt die Account-ID, damit eigene/teilnehmende private Spiele sichtbar werden.
    expect(listCall[1][0]).toBe('acc-1')
    expect(listCall[0]).toContain('account_players')
  })

  it('applies the guard together with the search filter', async () => {
    const client = createMockClient(() => ({ rows: [{ count: '0' }] }))

    await app.inject({ method: 'GET', url: '/?search=alpha' })

    const listCall = client.query.mock.calls.find(
      (c) => c[0].includes('ILIKE') && c[0].includes('FROM games g') && !c[0].includes('COUNT'),
    )
    // Guard UND Suche greifen zusammen (privates Spiel nicht über Spielername auffindbar).
    expect(listCall[0]).toContain("g.visibility = 'public'")
    expect(listCall[0]).toContain('ILIKE')
    expect(listCall[1]).toContain('%alpha%')
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

  it('flags is_owner for the creator and never leaks created_by', async () => {
    createMockClient((sql) => {
      if (sql.includes('FROM sessions')) {
        return { rows: [{ id: 'acc-1', email: 'a@b.c', display_name: null, avatar: null }] }
      }
      return { rows: [{ id: 'game1234567890', name: 'Owned', visibility: 'private', created_by: 'acc-1' }], rowCount: 1 }
    })

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890',
      cookies: { ug_session: 'valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.is_owner).toBe(true)
    expect(body.visibility).toBe('private')
    expect(body.created_by).toBeUndefined()
  })

  it('denies anonymous access to a private game (403)', async () => {
    createMockClient(() => ({
      rows: [{ id: 'game1234567890', name: 'Owned', visibility: 'private', created_by: 'acc-1', is_participant: false }],
      rowCount: 1,
    }))

    const res = await app.inject({ method: 'GET', url: '/game1234567890' })

    expect(res.statusCode).toBe(403)
  })

  it('allows a registered participant to access a private game', async () => {
    createMockClient((sql) => {
      if (sql.includes('FROM sessions')) {
        return { rows: [{ id: 'acc-2', email: 'p@b.c', display_name: null, avatar: null }] }
      }
      // getGameAccess: fremder Account, aber Teilnehmer (is_participant true).
      return { rows: [{ id: 'game1234567890', name: 'Shared', visibility: 'private', created_by: 'acc-1', is_participant: true }], rowCount: 1 }
    })

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890',
      cookies: { ug_session: 'valid-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().is_owner).toBe(false)
    expect(res.json().visibility).toBe('private')
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

  it('returns players for a game, flagging registered identities', async () => {
    const client = createMockClient(() => ({
      rows: [
        { id: 'canon-alice-01', name: 'Alice', registered: true, avatar: null },
        { id: 'p2345678901234', name: 'Bob', registered: false, avatar: null },
      ],
    }))

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890/players',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
    expect(res.json()[0].registered).toBe(true)
    // Die Query markiert kanonische (Konto-)Identitäten.
    const call = client.query.mock.calls.find((c) => c[0].includes('AS registered'))
    expect(call).toBeDefined()
  })

  it('returns 400 for invalid game id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bad/players',
    })

    expect(res.statusCode).toBe(400)
  })

  it('denies players of a foreign private game (403)', async () => {
    createMockClient((sql) => {
      if (sql.includes('is_participant')) {
        return { rows: [{ id: 'game1234567890', name: 'Secret', visibility: 'private', created_by: 'acc-1', is_participant: false }] }
      }
      return { rows: [] }
    })

    const res = await app.inject({ method: 'GET', url: '/game1234567890/players' })

    expect(res.statusCode).toBe(403)
  })

  it('serves players of a private game to its owner', async () => {
    const client = createMockClient((sql) => {
      if (sql.includes('FROM sessions')) {
        return { rows: [{ id: 'acc-1', email: 'o@b.c', display_name: null, avatar: null }] }
      }
      if (sql.includes('is_participant')) {
        return { rows: [{ id: 'game1234567890', name: 'Mine', visibility: 'private', created_by: 'acc-1', is_participant: false }] }
      }
      if (sql.includes('AS registered')) {
        return { rows: [{ id: 'canon-alice-01', name: 'Alice', registered: true, avatar: null }] }
      }
      return { rows: [] }
    })

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890/players',
      cookies: { ug_session: 'valid-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    const playersCall = client.query.mock.calls.find((c) => c[0].includes('AS registered'))
    expect(playersCall).toBeDefined()
  })
})
