import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'

import { pgMock } from '../../test/helpers/pgMock.js'

// Die Handler sind dünne Adapter: parsen, das Persistenz-Modul rufen,
// antworten. Diese Tests prüfen genau das — Status, Response-Shape,
// Validierung und welche Operation mit welchen Argumenten gerufen wird.
// Das SQL selbst gehört dem Modul und wird dort getestet.
vi.mock('../../persistence/games.js', () => ({
  listGames: vi.fn(),
  listGamesSummary: vi.fn(),
  getGame: vi.fn(),
  getGamePlayers: vi.fn(),
  upsertGameWithPlayers: vi.fn(),
}))

// Nur noch für den Session-Lookup in getAccountFromRequest.
vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import {
  listGames,
  listGamesSummary,
  getGame,
  getGamePlayers,
  upsertGameWithPlayers,
} from '../../persistence/games.js'
import gameRoutes from '../games.js'
import { handleError } from '../../utils/errorHandler.js'

const ACCOUNT = { id: 'acc-owner-1', email: 'owner@example.com', display_name: null, avatar: null }

/** Verbindungs-Fake, der ausschliesslich die Session-Abfrage beantwortet. */
function mockSession(account = null) {
  const client = {
    query: vi.fn(async () => ({ rows: account ? [account] : [], rowCount: account ? 1 : 0 })),
    release: vi.fn(),
  }
  getClient.mockResolvedValue(client)
  return client
}

function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  // Cookie-Plugin: nötig, damit die Routen die (optionale) Session lesen können.
  app.register(fastifyCookie)
  app.register(gameRoutes, { prefix: '/' })
  return app
}

let app

beforeEach(() => {
  app = buildApp()
  getClient.mockReset()
  for (const op of [listGames, listGamesSummary, getGame, getGamePlayers, upsertGameWithPlayers]) {
    op.mockReset()
  }
})

afterEach(() => app.close())

describe('POST /games', () => {
  it('creates a game with players', async () => {
    mockSession()
    upsertGameWithPlayers.mockResolvedValue({ id: 'game1234567890', name: 'My Game', visibility: 'public' })

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
    expect(res.json()).toEqual({
      id: 'game1234567890',
      name: 'My Game',
      visibility: 'public',
      status: 'upserted',
    })
    expect(upsertGameWithPlayers).toHaveBeenCalledWith({
      id: 'game1234567890',
      name: 'My Game',
      playerIds: ['player1234567890'],
      createdBy: null,
      visibility: 'public',
    })
  })

  it('stamps created_by from the session when logged in', async () => {
    mockSession(ACCOUNT)
    upsertGameWithPlayers.mockResolvedValue({ id: 'game1234567890', name: 'Owned Game' })

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
    expect(upsertGameWithPlayers.mock.calls[0][0].createdBy).toBe('acc-owner-1')
  })

  it('leaves created_by null for anonymous creation', async () => {
    const client = mockSession()
    upsertGameWithPlayers.mockResolvedValue({ id: 'game1234567890', name: 'Anon Game' })

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
    expect(upsertGameWithPlayers.mock.calls[0][0].createdBy).toBeNull()
    // Ohne Cookie darf kein Session-Lookup passieren.
    expect(client.query).not.toHaveBeenCalled()
  })

  it('persists visibility=private for a logged-in creator', async () => {
    mockSession(ACCOUNT)
    upsertGameWithPlayers.mockResolvedValue({ id: 'game1234567890', name: 'Private Game', visibility: 'private' })

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
    expect(upsertGameWithPlayers.mock.calls[0][0].visibility).toBe('private')
  })

  it('forces visibility=public for anonymous creation', async () => {
    mockSession()
    upsertGameWithPlayers.mockResolvedValue({ id: 'game1234567890', name: 'Anon Game', visibility: 'public' })

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
    expect(upsertGameWithPlayers.mock.calls[0][0].visibility).toBe('public')
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
    expect(upsertGameWithPlayers).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: 'short', name: '', players: [] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
    expect(upsertGameWithPlayers).not.toHaveBeenCalled()
  })

  it('returns 500 through the shared error handler when the write fails', async () => {
    mockSession()
    upsertGameWithPlayers.mockRejectedValue(new Error('DB connection lost'))

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
    expect(res.json().error).toBe('Internal server error')
  })
})

describe('GET /games', () => {
  it('returns what the read-model hands back', async () => {
    mockSession()
    listGames.mockResolvedValue({ games: [{ id: 'g1', name: 'Game 1' }], total: 5 })

    const res = await app.inject({ method: 'GET', url: '/?page=1&per_page=4' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ games: [{ id: 'g1', name: 'Game 1' }], total: 5 })
    expect(listGames).toHaveBeenCalledWith({ me: null, page: '1', perPage: '4', search: undefined })
  })

  it('forwards the search parameter', async () => {
    mockSession()
    listGames.mockResolvedValue({ games: [], total: 0 })

    await app.inject({ method: 'GET', url: '/?search=alpha' })

    expect(listGames.mock.calls[0][0].search).toBe('alpha')
  })

  it('passes no account for anonymous requests', async () => {
    mockSession()
    listGames.mockResolvedValue({ games: [], total: 0 })

    await app.inject({ method: 'GET', url: '/' })

    expect(listGames.mock.calls[0][0].me).toBeNull()
  })

  it('scopes the read-model to the account for a logged-in request', async () => {
    mockSession({ ...ACCOUNT, id: 'acc-1' })
    listGames.mockResolvedValue({ games: [], total: 0 })

    await app.inject({
      method: 'GET',
      url: '/',
      cookies: { ug_session: 'valid-token' },
    })

    expect(listGames.mock.calls[0][0].me).toBe('acc-1')
  })
})

describe('GET /games/summary', () => {
  it('returns the summary read-model and forwards pagination and search', async () => {
    mockSession()
    listGamesSummary.mockResolvedValue({ games: [{ id: 'g1', players: [], holes: null }], total: 3 })

    const res = await app.inject({ method: 'GET', url: '/summary?page=2&per_page=10&search=alpha' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ games: [{ id: 'g1', players: [], holes: null }], total: 3 })
    expect(listGamesSummary).toHaveBeenCalledWith({
      me: null,
      page: '2',
      perPage: '10',
      search: 'alpha',
    })
  })
})

describe('GET /games/:id', () => {
  it('returns a game by id', async () => {
    mockSession()
    getGame.mockResolvedValue({ id: 'game1234567890', name: 'Found Game', visibility: 'public', is_owner: false })

    const res = await app.inject({ method: 'GET', url: '/game1234567890' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      id: 'game1234567890',
      name: 'Found Game',
      visibility: 'public',
      is_owner: false,
    })
    expect(getGame).toHaveBeenCalledWith('game1234567890', { me: null })
  })

  it('returns 404 for nonexistent game', async () => {
    mockSession()
    getGame.mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: '/game1234567890' })

    expect(res.statusCode).toBe(404)
  })

  it('passes the session account so the read-model can flag ownership', async () => {
    mockSession({ ...ACCOUNT, id: 'acc-1' })
    getGame.mockResolvedValue({ id: 'game1234567890', name: 'Owned', visibility: 'private', is_owner: true })

    const res = await app.inject({
      method: 'GET',
      url: '/game1234567890',
      cookies: { ug_session: 'valid-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().is_owner).toBe(true)
    expect(getGame).toHaveBeenCalledWith('game1234567890', { me: 'acc-1' })
  })

  it('returns 400 for invalid id', async () => {
    const res = await app.inject({ method: 'GET', url: '/bad' })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
  })

  it('rejects an id with forbidden characters before the handler runs', async () => {
    const res = await app.inject({ method: 'GET', url: '/game!!!!!!!!!!' })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
    expect(getGame).not.toHaveBeenCalled()
  })

  it('rejects an overlong id', async () => {
    const res = await app.inject({ method: 'GET', url: `/${'a'.repeat(31)}` })

    expect(res.statusCode).toBe(400)
    expect(getGame).not.toHaveBeenCalled()
  })
})

describe('GET /games/:id/players', () => {
  it('returns players for a game', async () => {
    getGamePlayers.mockResolvedValue([
      { id: 'canon-alice-01', name: 'Alice', registered: true, avatar: null },
      { id: 'p2345678901234', name: 'Bob', registered: false, avatar: null },
    ])

    const res = await app.inject({ method: 'GET', url: '/game1234567890/players' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
    expect(res.json()[0].registered).toBe(true)
    expect(getGamePlayers).toHaveBeenCalledWith('game1234567890')
  })

  it('returns 400 for invalid game id', async () => {
    const res = await app.inject({ method: 'GET', url: '/bad/players' })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
    expect(getGamePlayers).not.toHaveBeenCalled()
  })
})
