import { describe, it, expect, vi, beforeEach } from 'vitest'

import { pgMock } from '../../test/helpers/pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import {
  listGames,
  listGamesSummary,
  getGame,
  getGamePlayers,
  upsertGameWithPlayers,
  visibilityGuard,
} from '../games.js'

// Diese Tests sprechen das Persistenz-Modul direkt an und prüfen, was es
// zurückgibt und womit es die DB parametrisiert — nicht, welchen Abfragetext
// es dafür heute absetzt.

/**
 * Fake für die Verbindungsschicht. Er muss die beiden Abfragen eines
 * Listen-Read-Models unterscheiden (Zähl- vs. Datenzeilen) und tut das an der
 * einzigen Stelle, an der sie sich unterscheiden können — der Abfrage selbst.
 * Die Zusicherungen greifen danach nur noch auf `seen.*.params` zu.
 */
function fakeDb({ rows = [], count = '0' } = {}) {
  const seen = { list: null, count: null, calls: [] }

  const client = {
    query: vi.fn(async (sql, params) => {
      seen.calls.push({ sql, params })
      if (sql.includes('SELECT COUNT(*)')) {
        seen.count = { sql, params }
        return { rows: [{ count }] }
      }
      seen.list = { sql, params }
      return { rows, rowCount: rows.length }
    }),
    release: vi.fn(),
  }

  getClient.mockResolvedValue(client)
  return seen
}

describe('listGames', () => {
  beforeEach(() => getClient.mockReset())

  it('returns the rows plus a numeric total', async () => {
    fakeDb({ rows: [{ id: 'g1', name: 'Game 1' }], count: '5' })

    expect(await listGames()).toEqual({
      games: [{ id: 'g1', name: 'Game 1' }],
      total: 5,
    })
  })

  it('defaults to page 1 with four games per page', async () => {
    const seen = fakeDb()

    await listGames({ me: null })

    // [me, limit, offset]
    expect(seen.list.params).toEqual([null, 4, 0])
  })

  it('turns page and perPage into limit and offset', async () => {
    const seen = fakeDb()

    await listGames({ page: '3', perPage: '5' })

    expect(seen.list.params.slice(-2)).toEqual([5, 10])
  })

  it('caps perPage at ten', async () => {
    const seen = fakeDb()

    await listGames({ perPage: '999' })

    expect(seen.list.params.slice(-2)).toEqual([10, 0])
  })

  it('clamps a page below one', async () => {
    const seen = fakeDb()

    await listGames({ page: '-2' })

    expect(seen.list.params.slice(-2)).toEqual([4, 0])
  })

  it('binds the search term as a wildcard pattern', async () => {
    const seen = fakeDb()

    await listGames({ search: 'alpha' })

    expect(seen.list.params).toEqual([null, '%alpha%', 4, 0])
    // Die Zählung filtert identisch, sonst stimmt die Pagination nicht.
    expect(seen.count.params).toEqual([null, '%alpha%'])
  })

  it('applies the visibility guard to both the page and the count', async () => {
    const seen = fakeDb()

    await listGames({ me: 'acc-1', search: 'alpha' })

    expect(seen.list.params[0]).toBe('acc-1')
    expect(seen.count.params[0]).toBe('acc-1')
    // Der Guard greift auch zusammen mit der Suche — ein privates Spiel darf
    // nicht über einen Spielernamen auffindbar werden.
    expect(seen.list.sql).toContain(visibilityGuard('$1'))
    expect(seen.count.sql).toContain(visibilityGuard('$1'))
  })
})

describe('listGamesSummary', () => {
  beforeEach(() => getClient.mockReset())

  it('returns the leaderboard rows plus a numeric total', async () => {
    const row = {
      id: 'g1',
      name: 'Game 1',
      players: [{ id: 'p1', name: 'Alice', avg: '3.7', total: '11' }],
      holes: [1, 2, 3],
    }
    fakeDb({ rows: [row], count: '2' })

    expect(await listGamesSummary()).toEqual({ games: [row], total: 2 })
  })

  it('defaults to ten games per page', async () => {
    const seen = fakeDb()

    await listGamesSummary({ me: null })

    expect(seen.list.params).toEqual([null, 10, 0])
  })

  it('applies the same guard and search filter as the plain list', async () => {
    const seen = fakeDb()

    await listGamesSummary({ me: 'acc-1', search: 'alpha', page: '2' })

    expect(seen.list.params).toEqual(['acc-1', '%alpha%', 10, 10])
    expect(seen.list.sql).toContain(visibilityGuard('$1'))
  })
})

describe('getGame', () => {
  beforeEach(() => getClient.mockReset())

  it('returns null when the game does not exist', async () => {
    fakeDb({ rows: [] })

    expect(await getGame('game1234567890')).toBeNull()
  })

  it('flags is_owner for the creator and never returns created_by', async () => {
    fakeDb({ rows: [{ id: 'game1234567890', name: 'Owned', visibility: 'private', created_by: 'acc-1' }] })

    const game = await getGame('game1234567890', { me: 'acc-1' })

    expect(game).toEqual({
      id: 'game1234567890',
      name: 'Owned',
      visibility: 'private',
      is_owner: true,
    })
  })

  it('reports is_owner=false for anyone else and for anonymous callers', async () => {
    const seen = fakeDb({ rows: [{ id: 'game1234567890', name: 'Owned', visibility: 'private', created_by: 'acc-1' }] })

    expect((await getGame('game1234567890', { me: 'acc-2' })).is_owner).toBe(false)
    expect((await getGame('game1234567890')).is_owner).toBe(false)
    expect(seen.list.params).toEqual(['game1234567890'])
  })

  it('does not treat a null creator as a match for an anonymous caller', async () => {
    fakeDb({ rows: [{ id: 'game1234567890', name: 'Anon', visibility: 'public', created_by: null }] })

    expect((await getGame('game1234567890')).is_owner).toBe(false)
  })
})

describe('getGamePlayers', () => {
  beforeEach(() => getClient.mockReset())

  it('returns the players of a game with their registration flag', async () => {
    const rows = [
      { id: 'canon-alice-01', name: 'Alice', registered: true, avatar: null },
      { id: 'p2345678901234', name: 'Bob', registered: false, avatar: null },
    ]
    const seen = fakeDb({ rows })

    expect(await getGamePlayers('game1234567890')).toEqual(rows)
    expect(seen.list.params).toEqual(['game1234567890'])
  })
})

describe('upsertGameWithPlayers', () => {
  beforeEach(() => getClient.mockReset())

  function transactionDb(gameRow) {
    const statements = []
    const client = {
      query: vi.fn(async (sql, params) => {
        statements.push({ sql, params })
        return { rows: sql.includes('INSERT INTO games') ? [gameRow] : [], rowCount: 0 }
      }),
      release: vi.fn(),
    }
    getClient.mockResolvedValue(client)
    return { statements, client }
  }

  it('returns the upserted game row', async () => {
    transactionDb({ id: 'game1234567890', name: 'My Game', visibility: 'public' })

    const game = await upsertGameWithPlayers({
      id: 'game1234567890',
      name: 'My Game',
      playerIds: ['player1234567890'],
    })

    expect(game).toEqual({ id: 'game1234567890', name: 'My Game', visibility: 'public' })
  })

  it('writes the game and its players on one connection, then releases it', async () => {
    const { statements, client } = transactionDb({ id: 'game1234567890', name: 'My Game' })

    await upsertGameWithPlayers({
      id: 'game1234567890',
      name: 'My Game',
      playerIds: ['player1234567890', 'player2345678901'],
      createdBy: 'acc-1',
      visibility: 'private',
    })

    // Der Zwei-Schritt-Write ist atomar: beide Statements laufen zwischen
    // BEGIN und COMMIT auf demselben Client.
    const keywords = statements.map((s) => s.sql.trim().split(/\s+/).slice(0, 2).join(' '))
    expect(keywords[0]).toBe('BEGIN')
    expect(keywords.at(-1)).toBe('COMMIT')
    expect(statements).toHaveLength(4)
    expect(statements[1].params).toEqual(['game1234567890', 'My Game', 'acc-1', 'private'])
    expect(statements[2].params).toEqual([
      'game1234567890', 'player1234567890',
      'game1234567890', 'player2345678901',
    ])
    expect(client.release).toHaveBeenCalled()
  })

  it('skips the player write when there are no players', async () => {
    const { statements } = transactionDb({ id: 'game1234567890', name: 'Solo' })

    await upsertGameWithPlayers({ id: 'game1234567890', name: 'Solo', playerIds: [] })

    expect(statements).toHaveLength(3) // BEGIN, games-Upsert, COMMIT
  })

  it('rolls back and rethrows when a statement fails', async () => {
    const client = {
      query: vi.fn(async (sql) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
        throw new Error('DB connection lost')
      }),
      release: vi.fn(),
    }
    getClient.mockResolvedValue(client)

    await expect(
      upsertGameWithPlayers({ id: 'game1234567890', name: 'Crash', playerIds: [] }),
    ).rejects.toThrow('DB connection lost')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalled()
  })
})
