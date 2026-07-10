/**
 * Playwright-Fixture: mockt die Backend-API gegen ein deterministisches
 * In-Memory-Dataset. So laufen Smoke-Tests komplett ohne Backend/DB.
 */
import type { Page, Route } from '@playwright/test'

export interface MockPlayer {
  id: string
  name: string
}

export interface MockGame {
  id: string
  name: string
  created_at: string
}

export interface MockScore {
  game_id: string
  player_id: string
  hole: number
  strokes: number
}

export interface MockDataset {
  players: MockPlayer[]
  games: MockGame[]
  gamePlayers: Record<string, string[]> // gameId → playerIds
  scores: MockScore[]
}

export function defaultDataset(): MockDataset {
  return {
    players: [
      { id: 'pl-anna-meier-001', name: 'Anna Meier' },
      { id: 'pl-boris-wild-002', name: 'Boris Wild' },
      { id: 'pl-chris-schmid-3', name: 'Christian Schmid' },
      { id: 'pl-david-huber-04', name: 'David Huber' },
    ],
    games: [
      { id: 'mock-game-alpha-2026', name: 'Stadtpark-Runde',     created_at: '2026-04-12T18:30:00Z' },
      { id: 'mock-game-beta-2026',  name: 'Frühlings-Training',  created_at: '2026-04-05T10:15:00Z' },
    ],
    gamePlayers: {
      'mock-game-alpha-2026': ['pl-anna-meier-001', 'pl-boris-wild-002', 'pl-chris-schmid-3', 'pl-david-huber-04'],
      'mock-game-beta-2026':  ['pl-anna-meier-001', 'pl-boris-wild-002'],
    },
    scores: [
      // Alpha, holes 1–3 — David will have lowest total (best)
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-anna-meier-001', hole: 1, strokes: 3 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-anna-meier-001', hole: 2, strokes: 4 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-anna-meier-001', hole: 3, strokes: 4 }, // total 11
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-boris-wild-002', hole: 1, strokes: 4 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-boris-wild-002', hole: 2, strokes: 5 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-boris-wild-002', hole: 3, strokes: 4 }, // total 13
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-chris-schmid-3', hole: 1, strokes: 5 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-chris-schmid-3', hole: 2, strokes: 5 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-chris-schmid-3', hole: 3, strokes: 5 }, // total 15
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-david-huber-04', hole: 1, strokes: 2 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-david-huber-04', hole: 2, strokes: 3 },
      { game_id: 'mock-game-alpha-2026', player_id: 'pl-david-huber-04', hole: 3, strokes: 3 }, // total 8 → LEADER
    ],
  }
}

/** Baut die /games/summary-Response. */
function buildSummary(data: MockDataset) {
  return {
    games: data.games.map((g) => {
      const playerIds = data.gamePlayers[g.id] || []
      const players = playerIds.map((pid) => {
        const p = data.players.find((pp) => pp.id === pid)!
        const playerScores = data.scores.filter((s) => s.game_id === g.id && s.player_id === pid)
        const total = playerScores.reduce((acc, s) => acc + s.strokes, 0)
        const avg = playerScores.length ? total / playerScores.length : null
        return { id: p.id, name: p.name, total: playerScores.length ? total : null, avg }
      })
      const holes = [...new Set(data.scores.filter((s) => s.game_id === g.id).map((s) => s.hole))].sort((a, b) => a - b)
      return { ...g, players, holes }
    }),
  }
}

/**
 * Installiert alle API-Routen auf die übergebene Page.
 * Gibt eine `state`-Referenz zurück, so dass Tests Daten mutieren können.
 */
export async function installMockApi(page: Page, seed?: MockDataset) {
  const state: MockDataset = seed ? structuredClone(seed) : defaultDataset()

  await page.route('**/api/games/summary**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSummary(state)),
    })
  })

  await page.route('**/api/games', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}') as {
        id: string; name: string; players: string[]
      }
      const game: MockGame = {
        id: payload.id,
        name: payload.name,
        created_at: new Date().toISOString(),
      }
      state.games.push(game)
      state.gamePlayers[game.id] = payload.players
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...game, status: 'created' }),
      })
    }
    return route.fallback()
  })

  await page.route('**/api/games/*/players', (route) => {
    const match = route.request().url().match(/\/api\/games\/([^/]+)\/players/)
    const gameId = match?.[1]
    const playerIds = (gameId && state.gamePlayers[gameId]) || []
    const players = playerIds
      .map((id) => state.players.find((p) => p.id === id))
      .filter(Boolean)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(players),
    })
  })

  await page.route('**/api/games/*', (route) => {
    const url = route.request().url()
    if (url.includes('/summary') || url.endsWith('/players')) return route.fallback()
    const match = url.match(/\/api\/games\/([^/?]+)(?:$|\?)/)
    const gameId = match?.[1]
    const game = state.games.find((g) => g.id === gameId)
    if (!game) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(game),
    })
  })

  await page.route('**/api/players', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}') as { id: string; name: string }
      if (!state.players.find((p) => p.id === payload.id)) {
        state.players.push({ id: payload.id, name: payload.name })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...payload, status: 'created' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.players),
    })
  })

  await page.route('**/api/scores**', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const payload = JSON.parse(req.postData() || '{}') as MockScore
      const idx = state.scores.findIndex(
        (s) => s.game_id === payload.game_id && s.player_id === payload.player_id && s.hole === payload.hole
      )
      if (idx >= 0) state.scores[idx].strokes = payload.strokes
      else state.scores.push(payload)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
    }
    const url = req.url()
    const gameId = new URL(url).searchParams.get('game_id')
    const filtered = gameId ? state.scores.filter((s) => s.game_id === gameId) : state.scores
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(filtered) })
  })

  await page.route('**/api/feedback', (route) => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })

  // ---- Auth (optionale Identität) ----
  // Zustandsbehaftet, damit die "Session" auch einen Reload (page.goto) überlebt
  // — wie ein echtes Cookie.
  const authState: { account: { id: string; email: string; displayName: string | null } | null } = { account: null }

  await page.route('**/api/auth/request-otp', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  )
  await page.route('**/api/auth/verify-otp', (route) => {
    const payload = JSON.parse(route.request().postData() || '{}') as { email: string; code: string }
    if (payload.code === '123456') {
      authState.account = { id: 'acc-mock-1', email: payload.email, displayName: null }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ account: authState.account }),
      })
    }
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_code' }) })
  })
  await page.route('**/api/auth/me', (route) => {
    if (authState.account) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: authState.account }) })
    }
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthenticated' }) })
  })
  await page.route('**/api/auth/logout', (route) => {
    authState.account = null
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route('**/api/auth/profile', (route) => {
    const p = JSON.parse(route.request().postData() || '{}') as { displayName: string }
    if (authState.account) authState.account.displayName = p.displayName
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ account: authState.account ?? { id: 'acc-mock-1', email: 'spieler@example.com', displayName: p.displayName }, claimedCount: 2 }),
    })
  })
  await page.route('**/api/auth/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rounds: 3,
        overallAvg: 3.67,
        bestRoundAvg: 3.0,
        worstRoundAvg: 4.2,
        winRate: 0.33,
        wins: 1,
        trend: [
          { gameId: 'g1', name: 'R1', date: '2026-01-01T00:00:00Z', avg: 4.2 },
          { gameId: 'g2', name: 'R2', date: '2026-01-02T00:00:00Z', avg: 3.8 },
          { gameId: 'g3', name: 'R3', date: '2026-01-03T00:00:00Z', avg: 3.0 },
        ],
      }),
    }),
  )
  await page.route('**/api/auth/account-summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'spieler@example.com', displayName: 'Anna Meier', playerNames: ['Anna Meier'], rounds: 3 }),
    }),
  )
  await page.route(/\/api\/auth\/account(\?|$)/, (route) => {
    if (route.request().method() === 'DELETE') {
      authState.account = null
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    return route.fallback()
  })
  await page.route('**/api/auth/opponents', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ opponents: [{ name: 'Boris Wild', rounds: 3 }] }) }),
  )
  await page.route('**/api/auth/head-to-head**', (route) => {
    const name = new URL(route.request().url()).searchParams.get('name') || ''
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name, shared: 5, wins: 3, losses: 2, ties: 0, myAvg: 3.5, opponentAvg: 3.8 }),
    })
  })
  await page.route('**/api/auth/my-games', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        games: [{
          id: 'mock-game-alpha-2026',
          name: 'Stadtpark-Runde',
          created_at: '2026-04-12T18:30:00Z',
          players: [{ id: 'pl-anna-meier-001', name: 'Anna Meier', avg: 3.67, total: 11 }],
          holes: [1, 2, 3],
        }],
      }),
    }),
  )

  return state
}
