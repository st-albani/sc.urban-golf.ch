// Regressionsschutz für einen stillen Fehlermodus: Mit registriertem
// @fastify/compress liefert ein async-Handler, der `reply.send(x)` aufruft und
// danach implizit `undefined` zurückgibt, eine Antwort mit gesetztem
// `content-encoding`, aber leerem Body (`content-length: 0`). Fastify wertet
// das `undefined` als Ergebnis und fährt einen zweiten onSend-Zyklus, dessen
// leerer Payload die komprimierte Antwort überschreibt — ohne Fehlermeldung,
// ohne Log-Eintrag. Siehe fastify/fastify-compress#237.
//
// Der Test hält deshalb zwei Dinge fest: dass Kompression überhaupt greift,
// und dass die komprimierten Bytes den unkomprimierten entsprechen.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import compress from '@fastify/compress'
import { gunzipSync, brotliDecompressSync } from 'node:zlib'

import { pgMock } from './_pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import playerRoutes from '../players.js'
import { handleError } from '../../utils/errorHandler.js'

// Über dem 1-KB-Schwellwert von @fastify/compress, sonst wird nicht komprimiert.
const MANY_PLAYERS = Array.from({ length: 200 }, (_, i) => ({
  id: `player${String(i).padStart(7, '0')}`,
  name: `Testspieler Nummer ${i}`,
}))

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  await app.register(compress)
  app.register(playerRoutes, { prefix: '/' })
  return app
}

describe('Response-Kompression', () => {
  let app

  beforeEach(async () => {
    app = await buildApp()
    getClient.mockReset()
    getClient.mockResolvedValue({
      query: vi.fn(() => ({ rows: MANY_PLAYERS, rowCount: MANY_PLAYERS.length })),
      release: vi.fn(),
    })
  })

  afterEach(() => app.close())

  it('komprimiert grosse Antworten mit gzip und liefert einen nicht-leeren Body', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'accept-encoding': 'gzip' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-encoding']).toBe('gzip')
    // Der eigentliche Regressionsschutz — hier stand früher 0.
    expect(res.rawPayload.length).toBeGreaterThan(0)
    expect(JSON.parse(gunzipSync(res.rawPayload).toString('utf8'))).toHaveLength(MANY_PLAYERS.length)
  })

  it('komprimiert mit brotli, wenn der Client es anbietet', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'accept-encoding': 'br' },
    })

    expect(res.headers['content-encoding']).toBe('br')
    expect(res.rawPayload.length).toBeGreaterThan(0)
    expect(JSON.parse(brotliDecompressSync(res.rawPayload).toString('utf8'))).toHaveLength(MANY_PLAYERS.length)
  })

  it('liefert byte-identische Daten wie die unkomprimierte Antwort', async () => {
    const plain = await app.inject({ method: 'GET', url: '/', headers: { 'accept-encoding': 'identity' } })
    const gzipped = await app.inject({ method: 'GET', url: '/', headers: { 'accept-encoding': 'gzip' } })

    expect(plain.headers['content-encoding']).toBeUndefined()
    expect(gunzipSync(gzipped.rawPayload).equals(plain.rawPayload)).toBe(true)
    expect(gzipped.rawPayload.length).toBeLessThan(plain.rawPayload.length)
  })

  it('lässt Antworten unter dem Schwellwert unkomprimiert', async () => {
    getClient.mockResolvedValue({
      query: vi.fn(() => ({ rows: [{ id: 'player0000001', name: 'Alice' }], rowCount: 1 })),
      release: vi.fn(),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'accept-encoding': 'gzip' },
    })

    expect(res.headers['content-encoding']).toBeUndefined()
    expect(JSON.parse(res.payload)).toHaveLength(1)
  })
})
