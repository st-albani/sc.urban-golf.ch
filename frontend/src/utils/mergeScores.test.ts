import { describe, it, expect } from 'vitest'
import { mergeServerScores, scoresToMap, scoreKey } from './mergeScores'
import type { ScoreMap } from '@/types'

const NONE = new Set<string>()

describe('scoresToMap', () => {
  it('groups flat score rows by player and hole', () => {
    const map = scoresToMap([
      { player_id: 'p1', hole: 1, strokes: 3 },
      { player_id: 'p1', hole: 2, strokes: 4 },
      { player_id: 'p2', hole: 1, strokes: 5 },
    ])
    expect(map).toEqual({ p1: { 1: 3, 2: 4 }, p2: { 1: 5 } })
  })
})

describe('mergeServerScores', () => {
  it('applies a value another device changed on the server', () => {
    const local: ScoreMap = { p1: { 1: 3 } }
    const last: ScoreMap = { p1: { 1: 3 } }
    const server: ScoreMap = { p1: { 1: 5 } } // remote changed 3 → 5
    const merged = mergeServerScores(local, server, last, NONE)
    expect(merged.p1[1]).toBe(5)
  })

  it('preserves a local edit when the server field did not change', () => {
    // User changed p1/1 locally to 9; server still shows the old 3 (save in flight)
    const local: ScoreMap = { p1: { 1: 9 } }
    const last: ScoreMap = { p1: { 1: 3 } }
    const server: ScoreMap = { p1: { 1: 3 } }
    const merged = mergeServerScores(local, server, last, NONE)
    expect(merged.p1[1]).toBe(9)
  })

  it('never overwrites a locked (actively edited) field', () => {
    const local: ScoreMap = { p1: { 1: 9 } }
    const last: ScoreMap = { p1: { 1: 3 } }
    const server: ScoreMap = { p1: { 1: 7 } } // remote changed, but field is locked
    const merged = mergeServerScores(local, server, last, new Set([scoreKey('p1', 1)]))
    expect(merged.p1[1]).toBe(9)
  })

  it('adds a brand new remote field', () => {
    const local: ScoreMap = { p1: { 1: 3 } }
    const last: ScoreMap = {}
    const server: ScoreMap = { p1: { 1: 3 }, p2: { 1: 4 } }
    const merged = mergeServerScores(local, server, last, NONE)
    expect(merged.p2[1]).toBe(4)
  })

  it('does not mutate the original local map (new reference for touched player)', () => {
    const local: ScoreMap = { p1: { 1: 3 } }
    const last: ScoreMap = { p1: { 1: 3 } }
    const server: ScoreMap = { p1: { 1: 5 } }
    const merged = mergeServerScores(local, server, last, NONE)
    expect(local.p1[1]).toBe(3) // original untouched
    expect(merged).not.toBe(local)
    expect(merged.p1).not.toBe(local.p1)
  })
})
