import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'

import { pgMock } from './_pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import scoreRoutes from '../scores.js'
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
  // Cookie-Plugin: nötig, damit die Score-Routen die (optionale) Session lesen
  // und den Phase-2-Zugriffsschutz privater Spiele prüfen können.
  app.register(fastifyCookie)
  app.register(scoreRoutes, { prefix: '/' })
  return app
}

// Mock-Helfer: erste Query ist der getGameAccess-Lookup (enthält is_participant).
function accessRow({ visibility = 'public', created_by = null, is_participant = false } = {}) {
  return { rows: [{ id: 'game1234567890', name: 'G', visibility, created_by, is_participant }] }
}

describe('GET /scores', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('returns scores for a game', async () => {
    createMockClient(() => ({
      rows: [
        { id: 1, game_id: 'game1234567890', player_id: 'p1234567890123', hole: 1, strokes: 3, player_name: 'Alice' },
      ],
    }))

    const res = await app.inject({
      method: 'GET',
      url: '/?game_id=game1234567890',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].player_name).toBe('Alice')
  })

  it('returns 400 when game_id is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
  })

  it('returns 400 when game_id is invalid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/?game_id=bad',
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('POST /scores', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('creates or updates a score (upsert)', async () => {
    createMockClient(() => ({
      rows: [{ id: 42 }],
    }))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        game_id: 'game1234567890',
        player_id: 'player1234567890',
        hole: 1,
        strokes: 3,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(42)
    expect(body.hole).toBe(1)
    expect(body.strokes).toBe(3)
  })

  it('returns 400 for invalid score', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        game_id: 'bad',
        player_id: 'bad',
        hole: 0,
        strokes: 100,
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
  })

  it('returns 400 for empty body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('Scores — Zugriffsschutz private Spiele (Phase 2)', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('denies reading scores of a foreign private game (403)', async () => {
    createMockClient((sql) => {
      if (sql.includes('is_participant')) return accessRow({ visibility: 'private', created_by: 'acc-1', is_participant: false })
      return { rows: [] }
    })

    const res = await app.inject({ method: 'GET', url: '/?game_id=game1234567890' })

    expect(res.statusCode).toBe(403)
  })

  it('serves scores of a private game to a participant', async () => {
    createMockClient((sql) => {
      if (sql.includes('FROM sessions')) return { rows: [{ id: 'acc-2', email: 'p@b.c', display_name: null, avatar: null }] }
      if (sql.includes('is_participant')) return accessRow({ visibility: 'private', created_by: 'acc-1', is_participant: true })
      return { rows: [{ id: 1, game_id: 'game1234567890', player_id: 'p1234567890123', hole: 1, strokes: 3, player_name: 'Alice' }] }
    })

    const res = await app.inject({
      method: 'GET',
      url: '/?game_id=game1234567890',
      cookies: { ug_session: 'valid-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
  })

  it('denies posting a score to a foreign private game (403)', async () => {
    createMockClient((sql) => {
      if (sql.includes('is_participant')) return accessRow({ visibility: 'private', created_by: 'acc-1', is_participant: false })
      return { rows: [{ id: 42 }] }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { game_id: 'game1234567890', player_id: 'player1234567890', hole: 1, strokes: 3 },
    })

    expect(res.statusCode).toBe(403)
  })

  it('lets a participant post a score to a private game', async () => {
    createMockClient((sql) => {
      if (sql.includes('FROM sessions')) return { rows: [{ id: 'acc-2', email: 'p@b.c', display_name: null, avatar: null }] }
      if (sql.includes('is_participant')) return accessRow({ visibility: 'private', created_by: 'acc-1', is_participant: true })
      return { rows: [{ id: 42 }] }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      cookies: { ug_session: 'valid-token' },
      payload: { game_id: 'game1234567890', player_id: 'player1234567890', hole: 1, strokes: 3 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(42)
  })
})
