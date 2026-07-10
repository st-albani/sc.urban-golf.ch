import type { ScoreMap } from '@/types'

/** Schlüssel eines Score-Feldes für das Locked-Set. */
export function scoreKey(playerId: string, hole: number): string {
  return `${playerId}:${hole}`
}

/**
 * Merged frische Server-Scores in die lokale ScoreMap für die Live-Aktualisierung.
 *
 * Regeln:
 * - Ein Server-Wert wird nur übernommen, wenn er sich seit dem letzten Poll
 *   geändert hat (ein anderes Gerät hat geschrieben). Dadurch bleiben lokale
 *   Edits an server-unveränderten Feldern erhalten.
 * - Felder in `locked` (gerade aktiv editiert / im Save) werden nie überschrieben.
 *
 * Gibt eine neue ScoreMap zurück (nur berührte Spieler werden flach kopiert),
 * damit Vue-Reaktivität sauber greift.
 */
export function mergeServerScores(
  local: ScoreMap,
  server: ScoreMap,
  lastServer: ScoreMap,
  locked: Set<string>,
): ScoreMap {
  const next: ScoreMap = { ...local }

  for (const playerId in server) {
    for (const holeStr in server[playerId]) {
      const hole = Number(holeStr)
      const serverVal = server[playerId][hole]
      const lastVal = lastServer[playerId]?.[hole]

      if (serverVal === lastVal) continue // keine Server-Änderung → lokal lassen
      if (locked.has(scoreKey(playerId, hole))) continue // aktiv editiert

      next[playerId] = { ...(next[playerId] ?? {}) }
      next[playerId][hole] = serverVal
    }
  }

  return next
}

/** Baut aus der rohen Scores-Liste eine ScoreMap. */
export function scoresToMap(
  entries: Array<{ player_id: string; hole: number; strokes: number }>,
): ScoreMap {
  const map: ScoreMap = {}
  for (const e of entries) {
    ;(map[e.player_id] ??= {})[e.hole] = e.strokes
  }
  return map
}
