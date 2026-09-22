import { query, queryOne, transaction } from '../db/pg.js';
import { avgStrokesSql } from '../utils/standingsSql.js';

// Persistenz-Modul für Spiele: alles SQL rund um `games`, `game_players` und
// die daraus abgeleiteten Read-Models liegt hier. Die Handler parsen den
// Request, rufen eine dieser Operationen und antworten — sie kennen weder
// Tabellen noch Pagination-Mathematik.

/** Obergrenze für `perPage` in beiden Listen-Read-Models. */
const PER_PAGE_MAX = 10;
const LIST_PER_PAGE_DEFAULT = 4;
const SUMMARY_PER_PAGE_DEFAULT = 10;

/**
 * SQL-Fragment: ein Spiel `g` ist sichtbar, wenn es öffentlich ist ODER der
 * anfragende Account (`meParam`, ein uuid-Platzhalter wie '$1') sein Ersteller
 * ist bzw. über einen zugeordneten Spieler an ihm teilnimmt. Für anonyme
 * Requests (Parameter NULL) reduziert es sich auf `visibility = 'public'`.
 *
 * Exportiert, damit Tests festnageln können, dass beide Read-Models denselben
 * Guard anwenden, ohne dafür Abfragetext nachzubauen.
 */
export function visibilityGuard(meParam) {
  return `(
    g.visibility = 'public'
    OR (${meParam}::uuid IS NOT NULL AND (
      g.created_by = ${meParam}::uuid
      OR EXISTS (
        SELECT 1 FROM game_players gp2
        JOIN account_players ap ON ap.player_id = gp2.player_id
        WHERE gp2.game_id = g.id AND ap.account_id = ${meParam}::uuid
      )
    ))
  )`;
}

/**
 * Pagination-Mathematik beider Listen: Seite ab 1, Seitengrösse auf
 * PER_PAGE_MAX gedeckelt, Offset daraus abgeleitet. Nimmt die rohen
 * Query-Werte (Strings) entgegen.
 */
function paginate(page, perPage, defaultPerPage) {
  const currentPage = Math.max(1, parseInt(page) || 1);
  const limit = Math.min(PER_PAGE_MAX, parseInt(perPage) || defaultPerPage);
  return { limit, offset: (currentPage - 1) * limit };
}

/**
 * WHERE-Klausel beider Listen: Sichtbarkeits-Guard, optional um den Suchfilter
 * erweitert. Der Guard umschliesst die Suche mit, damit ein privates Spiel
 * nicht über einen Spielernamen durchsickern kann.
 */
function listFilter(me, search) {
  const values = [me];
  let where = `WHERE ${visibilityGuard('$1')}`;

  if (search) {
    where += ` AND (
      g.name ILIKE $2 OR EXISTS (
        SELECT 1 FROM game_players gp
        JOIN players p ON gp.player_id = p.id
        WHERE gp.game_id = g.id AND p.name ILIKE $2
      )
    )`;
    values.push(`%${search}%`);
  }

  return { where, values };
}

async function countGames(where, values) {
  const rows = await query(`SELECT COUNT(*) FROM games g ${where}`, values);
  return parseInt(rows[0].count);
}

/** Spiele-Liste mit Gesamtzahl für die Pagination. */
export async function listGames({ me = null, page, perPage, search } = {}) {
  const { where, values } = listFilter(me, search);
  const { limit, offset } = paginate(page, perPage, LIST_PER_PAGE_DEFAULT);

  const [games, total] = await Promise.all([
    query(
      `SELECT g.* FROM games g
       ${where}
       ORDER BY g.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    countGames(where, values),
  ]);

  return { games, total };
}

/**
 * Leaderboard-Read-Model: pro Spiel die Spieler mit Schnitt und Summe sowie
 * die gespielten Löcher. Aggregiert aus Pagination-Gründen in Postgres; die
 * Rundung kommt aus dem Standings-Vertrag (avgStrokesSql).
 */
export async function listGamesSummary({ me = null, page, perPage, search } = {}) {
  const { where, values } = listFilter(me, search);
  const { limit, offset } = paginate(page, perPage, SUMMARY_PER_PAGE_DEFAULT);

  const [games, total] = await Promise.all([
    query(
      `WITH filtered_games AS (
         SELECT g.*
         FROM games g
         ${where}
         ORDER BY g.created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}
       ),
       player_stats AS (
         SELECT
           g.id AS game_id,
           p.id AS player_id,
           p.name,
           ${avgStrokesSql('s.strokes')} AS avg,
           SUM(s.strokes) AS total
         FROM filtered_games g
         JOIN game_players gp ON gp.game_id = g.id
         JOIN players p ON p.id = gp.player_id
         LEFT JOIN scores s ON s.game_id = g.id AND s.player_id = p.id
         GROUP BY g.id, p.id, p.name
       )
       SELECT
         g.*,
         (
           SELECT json_agg(
             jsonb_build_object(
               'id', ps.player_id,
               'name', ps.name,
               'avg', ps.avg,
               'total', ps.total
             )
           )
           FROM player_stats ps
           WHERE ps.game_id = g.id
         ) AS players,
         (
           SELECT ARRAY_AGG(DISTINCT s.hole ORDER BY s.hole)
           FROM scores s
           WHERE s.game_id = g.id
         ) AS holes
       FROM filtered_games g`,
      [...values, limit, offset],
    ),
    countGames(where, values),
  ]);

  return { games, total };
}

/**
 * Ein Spiel per ID. `me` entscheidet über das is_owner-Flag; die
 * created_by-UUID selbst verlässt dieses Modul nie. Ohne Treffer: null.
 */
export async function getGame(id, { me = null } = {}) {
  const game = await queryOne(
    `SELECT id, name, visibility, created_by FROM games WHERE id = $1`,
    [id],
  );
  if (!game) return null;

  return {
    id: game.id,
    name: game.name,
    visibility: game.visibility,
    is_owner: me != null && game.created_by === me,
  };
}

/** Spieler eines Spiels. */
export function getGamePlayers(gameId) {
  return query(
    // registered/avatar: markiert kanonische (Konto-)Identitäten, damit die
    // Bearbeiten-Ansicht sie read-only hält (kein versehentliches Umbenennen).
    `SELECT p.id, p.name,
            EXISTS (SELECT 1 FROM accounts a WHERE a.player_id = p.id) AS registered,
            (SELECT a.avatar FROM accounts a WHERE a.player_id = p.id) AS avatar
     FROM players p
     JOIN game_players gp ON gp.player_id = p.id
     WHERE gp.game_id = $1`,
    [gameId],
  );
}

/**
 * Spiel anlegen oder aktualisieren und seine Spieler zuordnen — ein
 * Zwei-Schritt-Write, der atomar bleibt. Gibt die Spielzeile zurück.
 */
export function upsertGameWithPlayers({ id, name, playerIds = [], createdBy = null, visibility = 'public' }) {
  return transaction(async (client) => {
    const gameResult = await client.query(
      // created_by wird nur beim Anlegen gesetzt; beim Bearbeiten (ON CONFLICT)
      // bleibt der ursprüngliche Ersteller unangetastet. Die Sichtbarkeit
      // darf nur der Ersteller ändern — sonst bleibt der bestehende Wert.
      `INSERT INTO games (id, name, created_by, visibility)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         visibility = CASE
           WHEN $3 IS NOT NULL AND games.created_by = $3
           THEN EXCLUDED.visibility ELSE games.visibility END
       RETURNING id, name, visibility`,
      [id, name, createdBy, visibility],
    );

    if (playerIds.length > 0) {
      const values = [];
      const placeholders = playerIds.map((pid, i) => {
        values.push(id, pid);
        return `($${i * 2 + 1}, $${i * 2 + 2})`;
      });

      await client.query(
        `INSERT INTO game_players (game_id, player_id)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        values,
      );
    }

    return gameResult.rows[0];
  });
}
