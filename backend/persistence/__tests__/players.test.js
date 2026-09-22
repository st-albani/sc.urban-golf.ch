import { describe, it, expect, vi, beforeEach } from 'vitest'

import { pgMock } from '../../test/helpers/pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import { listPlayers, upsertPlayer, searchRegisteredPlayers } from '../players.js'

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

describe('listPlayers', () => {
  beforeEach(() => getClient.mockReset())

  it('returns all player rows', async () => {
    const rows = [{ id: 'p1234567890123', name: 'Alice' }, { id: 'p2345678901234', name: 'Bob' }]
    fakeDb(rows)

    expect(await listPlayers()).toEqual(rows)
  })
})

describe('upsertPlayer', () => {
  beforeEach(() => getClient.mockReset())

  it('binds id and name', async () => {
    const seen = fakeDb()

    await upsertPlayer({ id: 'player1234567890', name: 'Alice' })

    expect(seen.params).toEqual(['player1234567890', 'Alice'])
  })
})

describe('searchRegisteredPlayers', () => {
  beforeEach(() => getClient.mockReset())

  it('returns the matches and wraps the term in wildcards', async () => {
    const rows = [{ id: 'canon-anna-01', name: 'Anna Meier', avatar: null }]
    const seen = fakeDb(rows)

    expect(await searchRegisteredPlayers('Anna')).toEqual(rows)
    expect(seen.params).toEqual(['%Anna%'])
  })
})
