import { query } from '../db/pg.js';

// Persistenz-Modul für Scores.

/** Alle Scores eines Spiels, nach Loch und Spielername sortiert. */
export function listScores(gameId) {
  return query(
    `SELECT s.*, p.name as player_name FROM scores s
     JOIN players p ON s.player_id = p.id
     WHERE s.game_id = $1
     ORDER BY s.hole ASC, p.name ASC`,
    [gameId],
  );
}

/**
 * Score schreiben oder überschreiben (ein Eintrag pro Spiel × Spieler × Loch).
 * Gibt die geschriebene Zeile zurück.
 */
export async function saveScore({ gameId, playerId, hole, strokes }) {
  const rows = await query(
    `INSERT INTO scores (game_id, player_id, hole, strokes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (game_id, player_id, hole)
     DO UPDATE SET strokes = EXCLUDED.strokes
     RETURNING id`,
    [gameId, playerId, hole, strokes],
  );
  return rows[0];
}
