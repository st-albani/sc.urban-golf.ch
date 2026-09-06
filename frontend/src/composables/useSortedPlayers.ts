import { ref, computed, type Ref } from 'vue'
import { standings, playerStandings, formatAverage } from '@urban-golf/contract/standings'
import type { Player } from '@/services/api'
import type { ScoreMap } from '@/types'

type SortColumn = 'name' | 'total' | 'average'
type SortDirection = 'asc' | 'desc'

export function useSortedPlayers(players: Ref<Player[]>, scores: Ref<ScoreMap>) {
  const sortColumn = ref<SortColumn>('name')
  const sortDirection = ref<SortDirection>('asc')

  const standingsById = computed(() =>
    Object.fromEntries(standings(players.value, scores.value).map((row) => [row.id, row])),
  )

  const statsFor = (playerId: string) =>
    standingsById.value[playerId] ?? playerStandings(scores.value, playerId)

  const totalScore = (playerId: string): number => statsFor(playerId).total

  const averageScore = (playerId: string): string => formatAverage(statsFor(playerId).average)

  const sortedPlayers = computed<Player[]>(() => {
    return [...players.value].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      if (sortColumn.value === 'name') {
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
      } else if (sortColumn.value === 'total') {
        aVal = statsFor(a.id).total
        bVal = statsFor(b.id).total
      } else {
        aVal = statsFor(a.id).average ?? 0
        bVal = statsFor(b.id).average ?? 0
      }

      if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1
      return 0
    })
  })

  return { sortColumn, sortDirection, sortedPlayers, totalScore, averageScore }
}
