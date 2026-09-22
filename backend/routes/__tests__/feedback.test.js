import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

// Handler-Ebene: Status, Response-Shape, Validierung und der Aufruf der
// Persistenz-Operation. Das SQL gehört dem Modul und wird dort getestet.
vi.mock('../../persistence/feedback.js', () => ({
  saveFeedback: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({}),
    }),
  },
}))

import { saveFeedback } from '../../persistence/feedback.js'
import feedbackRoutes from '../feedback.js'
import { handleError } from '../../utils/errorHandler.js'

function buildApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler(handleError)
  app.register(feedbackRoutes, { prefix: '/' })
  return app
}

let app

beforeEach(() => {
  app = buildApp()
  saveFeedback.mockReset()
})

afterEach(() => app.close())

describe('POST /feedback', () => {
  it('saves feedback and returns success', async () => {
    saveFeedback.mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 5, message: 'Great app!' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    expect(saveFeedback).toHaveBeenCalledWith({
      rating: 5,
      message: 'Great app!',
      name: undefined,
      email: undefined,
    })
  })

  it('forwards an optional name and email', async () => {
    saveFeedback.mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 4, message: 'Nice', name: 'Alice', email: 'alice@example.com' },
    })

    expect(res.statusCode).toBe(200)
    expect(saveFeedback).toHaveBeenCalledWith({
      rating: 4,
      message: 'Nice',
      name: 'Alice',
      email: 'alice@example.com',
    })
  })

  it('returns 400 for invalid feedback', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 0, message: '' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation failed')
    expect(saveFeedback).not.toHaveBeenCalled()
  })

  it('returns 400 for empty body', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: {} })

    expect(res.statusCode).toBe(400)
  })

  it('returns 500 through the shared error handler when the write fails', async () => {
    saveFeedback.mockRejectedValue(new Error('DB write failed'))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { rating: 3, message: 'Test feedback' },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Internal server error')
  })
})
