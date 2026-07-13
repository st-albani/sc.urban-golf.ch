import { queryOne } from '../db/pg.js';

/**
 * Zugriffs-Entscheidung für ein Spiel (Phase-2-Sichtbarkeit).
 *
 * Öffentliche Spiele sind für alle zugänglich. Private Spiele nur für den
 * Ersteller (`created_by`) oder einen registrierten Mitspieler
 * (`account_players` ∩ `game_players`). `accountId` darf null sein (anonym).
 *
 * Rückgabe:
 *   { exists, allowed, isOwner, visibility, name }
 * `exists=false` → Spiel gibt es nicht (Aufrufer antwortet 404).
 * `allowed=false` bei existierendem Spiel → privat und kein Zugriff (403).
 */
export async function getGameAccess(gameId, accountId) {
  const row = await queryOne(
    `SELECT g.id, g.name, g.visibility, g.created_by,
            ($2::uuid IS NOT NULL AND EXISTS (
              SELECT 1 FROM game_players gp
              JOIN account_players ap ON ap.player_id = gp.player_id
              WHERE gp.game_id = g.id AND ap.account_id = $2::uuid
            )) AS is_participant
       FROM games g
      WHERE g.id = $1`,
    [gameId, accountId ?? null],
  );

  if (!row) return { exists: false, allowed: false, isOwner: false };

  const isOwner = accountId != null && row.created_by === accountId;
  const allowed = row.visibility !== 'private' || isOwner || row.is_participant === true;

  return { exists: true, allowed, isOwner, visibility: row.visibility, name: row.name };
}
