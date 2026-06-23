import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

import { pgMock } from './_pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import playerRoutes from '../players.js'
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
  app.register(playerRoutes, { prefix: '/' })
  return app
}

describe('POST /players', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('upserts a player', async () => {
    createMockClient(() => ({ rows: [] }))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'player1234567890', name: 'Alice' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: 'player1234567890', name: 'Alice', status: 'upserted' })
  })

  it('returns 400 for invalid player', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'short', name: '' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
  })

  it('returns 500 on DB error', async () => {
    createMockClient(() => {
      throw new Error('Connection refused')
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'player1234567890', name: 'Alice' },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Database error')
  })
})

describe('GET /players', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('returns all players', async () => {
    createMockClient(() => ({
      rows: [
        { id: 'p1234567890123', name: 'Alice' },
        { id: 'p2345678901234', name: 'Bob' },
      ],
    }))

    const res = await app.inject({
      method: 'GET',
      url: '/',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
    expect(res.json()[0].name).toBe('Alice')
  })
})
