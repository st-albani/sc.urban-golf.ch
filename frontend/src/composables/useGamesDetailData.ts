import { ref, type Ref } from 'vue'
import { fetchGame, fetchGamePlayers, fetchScores } from '@/services/api'
import type { Player, GameVisibility } from '@/services/api'

type ScoreMap = { [playerId: string]: { [hole: number]: number | string } }

export function useGamesDetailData(gameId: Ref<string>) {
  const players = ref<Player[]>([])
  const scores = ref<ScoreMap>({})
  const holes = ref<number[]>([])
  const gameName = ref<string>('')
  const visibility = ref<GameVisibility>('public')
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try {
      const [game, playerList, scoreData] = await Promise.all([
        fetchGame(gameId.value),
        fetchGamePlayers(gameId.value),
        fetchScores(gameId.value),
      ])

      gameName.value = game.name || `Game #${gameId.value}`
      visibility.value = game.visibility === 'private' ? 'private' : 'public'
      players.value = playerList

      for (const player of players.value) {
        scores.value[player.id] = {}
      }

      for (const entry of scoreData) {
        const { player_id, hole, strokes } = entry
        if (!scores.value[player_id]) scores.value[player_id] = {}
        scores.value[player_id][hole] = strokes
      }

      holes.value = Array.from(new Set(scoreData.map((e) => e.hole))).sort((a, b) => a - b)
      if (holes.value.length === 0) holes.value.push(1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load game data'
      error.value = message
      console.error('Error loading game detail data:', err)
    }
  }

  return { players, scores, holes, gameName, visibility, error, load }
}
