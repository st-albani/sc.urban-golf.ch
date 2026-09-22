import { query } from '../db/pg.js';

// Persistenz-Modul für Spieler.

/** Alle Spieler, alphabetisch. */
export function listPlayers() {
  return query('SELECT * FROM players ORDER BY name');
}

/** Spieler anlegen oder umbenennen. */
export async function upsertPlayer({ id, name }) {
  await query(
    `INSERT INTO players (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, name],
  );
}

/**
 * Registrierte Spieler suchen — Konten mit kanonischer Identität, d. h.
 * gesetztem Anzeigenamen. Das Teilstring-Muster baut dieses Modul.
 */
export function searchRegisteredPlayers(term) {
  return query(
    `SELECT p.id, p.name, a.avatar
     FROM accounts a
     JOIN players p ON p.id = a.player_id
     WHERE a.display_name IS NOT NULL AND p.name ILIKE $1
     ORDER BY p.name
     LIMIT 10`,
    [`%${term}%`],
  );
}
