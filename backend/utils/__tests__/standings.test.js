import { describe, it, expect } from 'vitest'
import {
  AVERAGE_DECIMALS,
  AVERAGE_PLACEHOLDER,
  standings,
  playerStandings,
  formatAverage,
  roundAverage,
  toStrokes,
  mean,
} from '@urban-golf/contract/standings'

// Der Standings-Vertrag liegt in packages/contract und wird von beiden
// Workspaces gelesen — getestet wird er hier wie validate.test.js.

const players = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Charlie' },
]

describe('standings', () => {
  it('returns total and average per player, in input order', () => {
    const scores = {
      p1: { 1: 3, 2: 4 },
      p2: { 1: 5, 2: 2, 3: 5 },
      p3: { 1: 2 },
    }
    expect(standings(players, scores)).toEqual([
      { id: 'p1', name: 'Alice', total: 7, holes: 2, average: 3.5 },
      { id: 'p2', name: 'Bob', total: 12, holes: 3, average: 4 },
      { id: 'p3', name: 'Charlie', total: 2, holes: 1, average: 2 },
    ])
  })

  it('gives a player without any scores a total of 0 and no average', () => {
    expect(standings(players, {})).toEqual([
      { id: 'p1', name: 'Alice', total: 0, holes: 0, average: null },
      { id: 'p2', name: 'Bob', total: 0, holes: 0, average: null },
      { id: 'p3', name: 'Charlie', total: 0, holes: 0, average: null },
    ])
  })

  it('survives an empty roster and a missing ScoreMap', () => {
    expect(standings([], {})).toEqual([])
    expect(standings(players, undefined)).toHaveLength(3)
    expect(standings(undefined, {})).toEqual([])
  })
})

describe('playerStandings', () => {
  it('ignores empty placeholder slots in total and average', () => {
    // '' ist das Platzhalter-Slot eines noch nicht gespielten Lochs.
    const stats = playerStandings({ p1: { 1: 4, 2: '', 3: 2 } }, 'p1')
    expect(stats).toEqual({ total: 6, holes: 2, average: 3 })
  })

  it('ignores null, undefined and non-numeric slots', () => {
    const stats = playerStandings({ p1: { 1: 4, 2: null, 3: undefined, 4: 'x' } }, 'p1')
    expect(stats).toEqual({ total: 4, holes: 1, average: 4 })
  })

  it('counts a single hole', () => {
    expect(playerStandings({ p1: { 7: 5 } }, 'p1')).toEqual({ total: 5, holes: 1, average: 5 })
  })

  it('counts zero as a played hole', () => {
    expect(playerStandings({ p1: { 1: 0, 2: 4 } }, 'p1')).toEqual({
      total: 4,
      holes: 2,
      average: 2,
    })
  })

  it('lets negative strokes take part in total and average', () => {
    expect(playerStandings({ p1: { 1: -3, 2: 5 } }, 'p1')).toEqual({
      total: 2,
      holes: 2,
      average: 1,
    })
  })

  it('accepts string slots as written by the score inputs', () => {
    expect(playerStandings({ p1: { 1: '3', 2: '4' } }, 'p1')).toEqual({
      total: 7,
      holes: 2,
      average: 3.5,
    })
  })

  it('returns empty standings for an unknown player', () => {
    expect(playerStandings({ p1: { 1: 3 } }, 'nobody')).toEqual({
      total: 0,
      holes: 0,
      average: null,
    })
  })
})

describe('the rounding contract', () => {
  it('rounds an average to one decimal', () => {
    expect(AVERAGE_DECIMALS).toBe(1)
    expect(playerStandings({ p1: { 1: 3, 2: 4, 3: 4 } }, 'p1').average).toBe(3.7)
  })

  it('rounds halves away from zero, like Postgres ROUND(numeric, n)', () => {
    expect(roundAverage(3.25)).toBe(3.3)
    expect(roundAverage(-3.25)).toBe(-3.3)
    expect(roundAverage(-2.35)).toBe(-2.4)
  })

  it('has no average without a counted hole', () => {
    expect(roundAverage(null)).toBeNull()
    expect(mean([])).toBeNull()
  })

  it('formats an average with a fixed number of decimals', () => {
    expect(formatAverage(3)).toBe('3.0')
    expect(formatAverage(3.5)).toBe('3.5')
    // Ein bereits gerundeter Wert aus dem Backend bleibt unverändert.
    expect(formatAverage(3.7)).toBe('3.7')
  })

  it('formats a missing average as the placeholder', () => {
    expect(formatAverage(null)).toBe(AVERAGE_PLACEHOLDER)
    expect(formatAverage(undefined)).toBe(AVERAGE_PLACEHOLDER)
  })
})

describe('toStrokes', () => {
  it('accepts numbers and numeric strings, rejects everything else', () => {
    expect(toStrokes(4)).toBe(4)
    expect(toStrokes('4')).toBe(4)
    expect(toStrokes(-2)).toBe(-2)
    expect(toStrokes('')).toBeNull()
    expect(toStrokes(null)).toBeNull()
    expect(toStrokes(undefined)).toBeNull()
    expect(toStrokes('abc')).toBeNull()
    expect(toStrokes(NaN)).toBeNull()
  })

  it('truncates toward zero so a stroke is always whole', () => {
    expect(toStrokes(3.7)).toBe(3)
    expect(toStrokes('3.7')).toBe(3)
    expect(toStrokes(-3.7)).toBe(-3)
  })
})
