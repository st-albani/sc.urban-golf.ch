import { describe, it, expect } from 'vitest'
import { parseGameRef } from './gameRef'

describe('parseGameRef', () => {
  const id = 'mock-game-alpha-2026'

  it('accepts a bare valid id', () => {
    expect(parseGameRef(id)).toBe(id)
    expect(parseGameRef(`  ${id}  `)).toBe(id)
  })

  it('extracts the id from a full share link', () => {
    expect(parseGameRef(`https://sc.urban-golf.ch/games/${id}`)).toBe(id)
  })

  it('extracts the game id even from a hole deep-link', () => {
    expect(parseGameRef(`https://sc.urban-golf.ch/games/${id}/3`)).toBe(id)
  })

  it('rejects too-short or invalid ids', () => {
    expect(parseGameRef('short')).toBeNull()
    expect(parseGameRef('has spaces here')).toBeNull()
    expect(parseGameRef('')).toBeNull()
    expect(parseGameRef('https://example.com/other/path')).toBeNull()
  })
})
