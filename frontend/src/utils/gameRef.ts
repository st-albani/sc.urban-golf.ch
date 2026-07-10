import { ID_PATTERN } from '@/constants'

/**
 * Extrahiert eine gültige Spiel-ID aus einem geteilten Link oder einer roh
 * eingegebenen/gescannten ID. Akzeptiert sowohl `…/games/<id>` als auch
 * `…/games/<id>/<hole>` sowie die bare ID. Gibt null zurück, wenn nichts
 * Gültiges erkennbar ist.
 */
export function parseGameRef(input: string): string | null {
  const value = input.trim()
  if (!value) return null

  // Bare ID
  if (ID_PATTERN.test(value)) return value

  // Aus einem Link: erstes /games/<id>-Segment
  const match = value.match(/\/games\/([a-zA-Z0-9_-]+)/)
  if (match && ID_PATTERN.test(match[1])) return match[1]

  return null
}
