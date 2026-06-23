import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

import { pgMock } from './_pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import scoreRoutes from '../scores.js'

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
  app.register(scoreRoutes, { prefix: '/' })
  return app
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
    expect(res.json().error).toContain('Missing or invalid game_id')
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
