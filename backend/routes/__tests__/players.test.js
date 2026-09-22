import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

// Handler-Ebene: Status, Response-Shape, Validierung und der Aufruf der
// Persistenz-Operation. Das SQL gehört dem Modul und wird dort getestet.
vi.mock('../../persistence/players.js', () => ({
  listPlayers: vi.fn(),
  upsertPlayer: vi.fn(),
  searchRegisteredPlayers: vi.fn(),
}))

import { listPlayers, upsertPlayer, searchRegisteredPlayers } from '../../persistence/players.js'
import playerRoutes from '../players.js'
import { handleError } from '../../utils/errorHandler.js'

function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  app.register(playerRoutes, { prefix: '/' })
  return app
}

let app

beforeEach(() => {
  app = buildApp()
  listPlayers.mockReset()
  upsertPlayer.mockReset()
  searchRegisteredPlayers.mockReset()
})

afterEach(() => app.close())

describe('POST /players', () => {
  it('upserts a player', async () => {
    upsertPlayer.mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'player1234567890', name: 'Alice' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: 'player1234567890', name: 'Alice', status: 'upserted' })
    expect(upsertPlayer).toHaveBeenCalledWith({ id: 'player1234567890', name: 'Alice' })
  })

  it('returns 400 for invalid player', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'short', name: '' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
    expect(upsertPlayer).not.toHaveBeenCalled()
  })

  it('returns 500 through the shared error handler when the write fails', async () => {
    upsertPlayer.mockRejectedValue(new Error('Connection refused'))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'player1234567890', name: 'Alice' },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Internal server error')
  })
})

describe('GET /players', () => {
  it('returns all players', async () => {
    listPlayers.mockResolvedValue([
      { id: 'p1234567890123', name: 'Alice' },
      { id: 'p2345678901234', name: 'Bob' },
    ])

    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
    expect(res.json()[0].name).toBe('Alice')
  })
})

describe('GET /players/search', () => {
  it('returns matching registered players', async () => {
    searchRegisteredPlayers.mockResolvedValue([{ id: 'canon-anna-01', name: 'Anna Meier', avatar: null }])

    const res = await app.inject({ method: 'GET', url: '/search?q=Anna' })

    expect(res.statusCode).toBe(200)
    expect(res.json().players).toEqual([{ id: 'canon-anna-01', name: 'Anna Meier', avatar: null }])
    expect(searchRegisteredPlayers).toHaveBeenCalledWith('Anna')
  })

  it('returns empty for a too-short query without hitting the db', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?q=A' })

    expect(res.statusCode).toBe(200)
    expect(res.json().players).toEqual([])
    expect(searchRegisteredPlayers).not.toHaveBeenCalled()
  })
})
