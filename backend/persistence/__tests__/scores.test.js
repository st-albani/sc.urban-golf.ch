import { describe, it, expect, vi, beforeEach } from 'vitest'

import { pgMock } from '../../test/helpers/pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import { listScores, saveScore } from '../scores.js'

function fakeDb(rows = []) {
  const seen = { params: null }
  getClient.mockResolvedValue({
    query: vi.fn(async (sql, params) => {
      seen.params = params
      return { rows, rowCount: rows.length }
    }),
    release: vi.fn(),
  })
  return seen
}

describe('listScores', () => {
  beforeEach(() => getClient.mockReset())

  it('returns the score rows of a game', async () => {
    const rows = [
      { id: 1, game_id: 'game1234567890', player_id: 'p1234567890123', hole: 1, strokes: 3, player_name: 'Alice' },
    ]
    const seen = fakeDb(rows)

    expect(await listScores('game1234567890')).toEqual(rows)
    expect(seen.params).toEqual(['game1234567890'])
  })

  it('returns an empty list for a game without scores', async () => {
    fakeDb([])

    expect(await listScores('game1234567890')).toEqual([])
  })
})

describe('saveScore', () => {
  beforeEach(() => getClient.mockReset())

  it('returns the written row and binds the values in schema order', async () => {
    const seen = fakeDb([{ id: 42 }])

    const saved = await saveScore({
      gameId: 'game1234567890',
      playerId: 'player1234567890',
      hole: 7,
      strokes: 3,
    })

    expect(saved).toEqual({ id: 42 })
    expect(seen.params).toEqual(['game1234567890', 'player1234567890', 7, 3])
  })
})
