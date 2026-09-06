import { toStrokes, mean } from '@urban-golf/contract/standings'
import type { ScoreMap } from '@/types'

/**
 * Returns a Tailwind class for heatmap coloring based on how a score
 * compares to the average for that hole across all players.
 *
 * Coercion and averaging come from the shared standings contract; the hole
 * average stays unrounded because it feeds a comparison, not a display.
 * Non-positive strokes are skipped here — a heat comparison needs a played
 * hole, not a placeholder.
 */
export function heatmapClass(
  playerId: string,
  hole: number,
  scores: ScoreMap,
  playerIds: string[]
): string {
  const value = toStrokes(scores[playerId]?.[hole])
  if (value === null || value === 0) return ''

  const holeScores = playerIds
    .map(id => toStrokes(scores[id]?.[hole]))
    .filter((n): n is number => n !== null && n > 0)

  if (holeScores.length < 2) return ''

  const avg = mean(holeScores)
  if (avg === null) return ''
  const diff = value - avg

  // In golf, lower is better — negative diff = good, positive = bad
  if (diff <= -1.5) return 'scorecard-heatmap-great'
  if (diff <= -0.5) return 'scorecard-heatmap-good'
  if (diff >= 1.5) return 'scorecard-heatmap-bad'
  if (diff >= 0.5) return 'scorecard-heatmap-poor'
  return ''
}
