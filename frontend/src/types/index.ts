import type { InjectionKey, Ref } from 'vue'
import type { Player, GameVisibility } from '@/services/api'

export type ScoreMap = { [playerId: string]: { [hole: number]: number | string } }

export interface GamesDetailContext {
  players: Ref<Player[]>
  scores: Ref<ScoreMap>
  holes: Ref<number[]>
  gameName: Ref<string>
  visibility: Ref<GameVisibility>
  error: Ref<string | null>
  load: () => Promise<void>
  /**
   * Aktiv editierte / gerade gespeicherte Score-Felder ("playerId:hole").
   * Die Live-Aktualisierung überschreibt diese Felder nicht.
   */
  lockedScores: Ref<Set<string>>
}

export const gamesDetailKey: InjectionKey<GamesDetailContext> = Symbol('gamesDetailData')
