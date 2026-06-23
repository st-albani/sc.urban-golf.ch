import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

import { pgMock } from './_pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({}),
    }),
  },
}))

import { getClient } from '../../db/pg.js'
import feedbackRoutes from '../feedback.js'
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
  app.register(feedbackRoutes, { prefix: '/' })
  return app
}

describe('POST /feedback', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    getClient.mockReset()
  })

  afterEach(() => app.close())

  it('saves feedback and returns success', async () => {
    const client = createMockClient(() => ({ rows: [] }))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 5, message: 'Great app!' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO feedback'),
      [5, 'Great app!', null, null],
    )
    expect(client.release).toHaveBeenCalled()
  })

  it('saves feedback with optional name and email', async () => {
    const client = createMockClient(() => ({ rows: [] }))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 4, message: 'Nice', name: 'Alice', email: 'alice@example.com' },
    })

    expect(res.statusCode).toBe(200)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO feedback'),
      [4, 'Nice', 'Alice', 'alice@example.com'],
    )
  })

  it('returns 400 for invalid feedback', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 0, message: '' },
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

  it('returns 500 on DB error', async () => {
    createMockClient(() => {
      throw new Error('DB write failed')
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 3, message: 'Test feedback' },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Failed to save feedback')
  })
})
