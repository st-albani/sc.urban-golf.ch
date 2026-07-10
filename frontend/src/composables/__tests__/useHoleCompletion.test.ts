import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useHoleCompletion } from '../useHoleCompletion'
import type { Player } from '@/services/api'
import type { ScoreMap } from '@/types'

function setup() {
  const players = ref<Player[]>([
    { id: 'p1', name: 'Anna' },
    { id: 'p2', name: 'Boris' },
    { id: 'p3', name: 'Chris' },
  ])
  const scores = ref<ScoreMap>({
    // Loch 1: alle drei erfasst
    p1: { 1: 3, 2: 4 },
    p2: { 1: 4, 2: '' }, // Loch 2 nur Platzhalter → nicht erfasst
    p3: { 1: 0 },        // 0 Schläge ist ein gültiger Score → erfasst
  })
  return { players, scores }
}

describe('useHoleCompletion', () => {
  it('treats 0 as a valid score but empty string / missing as not entered', () => {
    const { players, scores } = setup()
    const { hasScore } = useHoleCompletion(players, scores)
    expect(hasScore('p3', 1)).toBe(true)  // strokes 0
    expect(hasScore('p2', 2)).toBe(false) // empty string placeholder
    expect(hasScore('p3', 2)).toBe(false) // undefined
  })

  it('reports every player as missing when no scores exist for a hole', () => {
    const { players, scores } = setup()
    const { missingPlayers, completion, holeState } = useHoleCompletion(players, scores)
    expect(missingPlayers(9).map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(completion(9)).toEqual({ done: 0, total: 3 })
    expect(holeState(9)).toBe('empty')
  })

  it('reports no missing players and complete state when every player has a score', () => {
    const { players, scores } = setup()
    const { missingPlayers, completion, holeState, isComplete } = useHoleCompletion(players, scores)
    expect(missingPlayers(1)).toEqual([])
    expect(completion(1)).toEqual({ done: 3, total: 3 })
    expect(holeState(1)).toBe('complete')
    expect(isComplete(1)).toBe(true)
  })

  it('reports partial state and the exact missing players', () => {
    const { players, scores } = setup()
    const { missingPlayers, completion, holeState, isComplete } = useHoleCompletion(players, scores)
    // Loch 2: nur p1 hat einen echten Score, p2='' und p3=undefined fehlen
    expect(missingPlayers(2).map((p) => p.id)).toEqual(['p2', 'p3'])
    expect(completion(2)).toEqual({ done: 1, total: 3 })
    expect(holeState(2)).toBe('partial')
    expect(isComplete(2)).toBe(false)
  })

  it('is reactive to score changes', () => {
    const { players, scores } = setup()
    const { completion, holeState } = useHoleCompletion(players, scores)
    expect(holeState(2)).toBe('partial')
    scores.value.p2[2] = 5
    scores.value.p3[2] = 6
    expect(completion(2)).toEqual({ done: 3, total: 3 })
    expect(holeState(2)).toBe('complete')
  })

  it('treats an empty player list as empty, never complete', () => {
    const players = ref<Player[]>([])
    const scores = ref<ScoreMap>({})
    const { holeState, isComplete, completion } = useHoleCompletion(players, scores)
    expect(completion(1)).toEqual({ done: 0, total: 0 })
    expect(holeState(1)).toBe('empty')
    expect(isComplete(1)).toBe(false)
  })
})
