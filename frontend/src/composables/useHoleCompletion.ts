import { type Ref } from 'vue'
import type { Player } from '@/services/api'
import type { ScoreMap } from '@/types'

export type HoleState = 'empty' | 'partial' | 'complete'

/**
 * Leitet pro Loch ab, für welche Spieler noch kein Score erfasst ist.
 * Referenz für "vollständig" ist die aktive Spielerliste des Spiels.
 *
 * Ein leerer String ('') ist der Platzhalter für ein noch nicht eingegebenes
 * Feld (siehe ensureScoreFieldsExist in der Hole-View) und zählt daher NICHT
 * als erfasst — Number('') wäre sonst irreführend 0.
 */
export function useHoleCompletion(players: Ref<Player[]>, scores: Ref<ScoreMap>) {
  function hasScore(playerId: string, hole: number): boolean {
    const v = scores.value[playerId]?.[hole]
    return v !== undefined && v !== null && v !== ''
  }

  function missingPlayers(hole: number): Player[] {
    return players.value.filter((p) => !hasScore(p.id, hole))
  }

  function completion(hole: number): { done: number; total: number } {
    const total = players.value.length
    const done = players.value.reduce((acc, p) => acc + (hasScore(p.id, hole) ? 1 : 0), 0)
    return { done, total }
  }

  function holeState(hole: number): HoleState {
    const { done, total } = completion(hole)
    if (total === 0 || done === 0) return 'empty'
    return done === total ? 'complete' : 'partial'
  }

  function isComplete(hole: number): boolean {
    const { done, total } = completion(hole)
    return total > 0 && done === total
  }

  return { hasScore, missingPlayers, completion, holeState, isComplete }
}
