import { describe, it, expect, vi, beforeEach } from 'vitest'

import { pgMock } from '../../test/helpers/pgMock.js'

vi.mock('../../db/pg.js', () => pgMock(vi))

import { getClient } from '../../db/pg.js'
import { saveFeedback } from '../feedback.js'

function fakeDb() {
  const seen = { params: null, release: vi.fn() }
  getClient.mockResolvedValue({
    query: vi.fn(async (sql, params) => {
      seen.params = params
      return { rows: [], rowCount: 0 }
    }),
    release: seen.release,
  })
  return seen
}

describe('saveFeedback', () => {
  beforeEach(() => getClient.mockReset())

  it('writes rating and message and releases the connection', async () => {
    const seen = fakeDb()

    await saveFeedback({ rating: 5, message: 'Great app!' })

    expect(seen.params).toEqual([5, 'Great app!', null, null])
    expect(seen.release).toHaveBeenCalled()
  })

  it('keeps an optional name and email', async () => {
    const seen = fakeDb()

    await saveFeedback({ rating: 4, message: 'Nice', name: 'Alice', email: 'alice@example.com' })

    expect(seen.params).toEqual([4, 'Nice', 'Alice', 'alice@example.com'])
  })

  it('stores empty name and email as null', async () => {
    const seen = fakeDb()

    await saveFeedback({ rating: 3, message: 'Ok', name: '', email: '' })

    expect(seen.params).toEqual([3, 'Ok', null, null])
  })
})
