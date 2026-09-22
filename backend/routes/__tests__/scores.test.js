import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

// Handler-Ebene: Status, Response-Shape, Validierung und der Aufruf der
// Persistenz-Operation. Das SQL gehört dem Modul und wird dort getestet.
vi.mock('../../persistence/scores.js', () => ({
  listScores: vi.fn(),
  saveScore: vi.fn(),
}))

import { listScores, saveScore } from '../../persistence/scores.js'
import scoreRoutes from '../scores.js'
import { handleError } from '../../utils/errorHandler.js'

function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  app.register(scoreRoutes, { prefix: '/' })
  return app
}

let app

beforeEach(() => {
  app = buildApp()
  listScores.mockReset()
  saveScore.mockReset()
})

afterEach(() => app.close())

describe('GET /scores', () => {
  it('returns scores for a game', async () => {
    listScores.mockResolvedValue([
      { id: 1, game_id: 'game1234567890', player_id: 'p1234567890123', hole: 1, strokes: 3, player_name: 'Alice' },
    ])

    const res = await app.inject({ method: 'GET', url: '/?game_id=game1234567890' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].player_name).toBe('Alice')
    expect(listScores).toHaveBeenCalledWith('game1234567890')
  })

  it('returns 400 when game_id is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
    expect(listScores).not.toHaveBeenCalled()
  })

  it('returns 400 when game_id is invalid', async () => {
    const res = await app.inject({ method: 'GET', url: '/?game_id=bad' })

    expect(res.statusCode).toBe(400)
    expect(listScores).not.toHaveBeenCalled()
  })
})

describe('POST /scores', () => {
  it('creates or updates a score (upsert)', async () => {
    saveScore.mockResolvedValue({ id: 42 })

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
    expect(res.json()).toEqual({
      id: 42,
      game_id: 'game1234567890',
      player_id: 'player1234567890',
      hole: 1,
      strokes: 3,
    })
    expect(saveScore).toHaveBeenCalledWith({
      gameId: 'game1234567890',
      playerId: 'player1234567890',
      hole: 1,
      strokes: 3,
    })
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
    expect(saveScore).not.toHaveBeenCalled()
  })

  it('returns 400 for empty body', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: {} })

    expect(res.statusCode).toBe(400)
  })
})
