import { query, transaction } from '../db/pg.js';
import { schemas, isValidId } from '@urban-golf/contract';
import { getAccountFromRequest } from '../utils/auth.js';
import { getGameAccess } from '../utils/gameAccess.js';

/**
 * SQL-Fragment: ein Spiel `g` ist sichtbar, wenn es öffentlich ist ODER der
 * anfragende Account (`meParam`, ein uuid-Platzhalter wie '$1') sein Ersteller
 * ist bzw. über einen zugeordneten Spieler an ihm teilnimmt. Für anonyme
 * Requests (Parameter NULL) reduziert es sich auf `visibility = 'public'`.
 */
function visibilityGuard(meParam) {
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

export default async function (fastify, _opts) {
  // Spiel erstellen oder aktualisieren
  fastify.post('/', {
    schema: schemas.postGame,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const { id, name, players } = req.body;
    const validPlayers = players.filter(pid => isValidId(pid));

    try {
      // Optionale Identität: ist der Request eingeloggt, wird der Ersteller
      // serverseitig aus der Session abgeleitet (nie aus Client-Feldern).
      // Anonym bleibt created_by NULL — der Flow bleibt unverändert.
      const account = await getAccountFromRequest(req);
      const createdBy = account?.id ?? null;

      // Sichtbarkeit nur für eingeloggte Ersteller wirksam — anonyme Spiele
      // bleiben immer öffentlich (kein privates Spiel ohne Konto).
      const visibility = account && req.body.visibility === 'private' ? 'private' : 'public';

      const game = await transaction(async (client) => {
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
          [id, name, createdBy, visibility]
        );

        if (validPlayers.length > 0) {
          const values = [];
          const placeholders = validPlayers.map((pid, i) => {
            values.push(id, pid);
            return `($${i * 2 + 1}, $${i * 2 + 2})`;
          });

          await client.query(
            `INSERT INTO game_players (game_id, player_id)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT DO NOTHING`,
            values
          );
        }

        return gameResult.rows[0];
      });

      reply.send({ ...game, status: 'upserted' });
    } catch (err) {
      fastify.log.error({ id, players, error: err.message }, 'Failed to upsert game with players');
      reply.code(500).send({ error: 'Database error' });
    }
  });

  // Spiele abrufen mit optionaler Suche und Pagination
  fastify.get('/', async (req, reply) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(10, parseInt(req.query.per_page) || 4);
    const offset = (page - 1) * perPage;
    const search = req.query.search;

    try {
      // Optionale Auth: private Spiele nur für den Ersteller oder einen dem
      // Konto zugeordneten Mitspieler; anonyme Requests sehen nur öffentliche.
      const account = await getAccountFromRequest(req);
      const me = account?.id ?? null;

      // Der Guard umschliesst den gesamten WHERE (auch die Suche), damit ein
      // privates Spiel nicht über einen Spielernamen durchsickern kann.
      const whereBase = `WHERE ${visibilityGuard('$1')}`;
      const baseValues = [me];

      let whereClause = whereBase;
      if (search) {
        whereClause += ` AND (
          g.name ILIKE $2 OR EXISTS (
            SELECT 1 FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = g.id AND p.name ILIKE $2
          )
        )`;
        baseValues.push(`%${search}%`);
      }

      const limitIdx = baseValues.length + 1;
      const offsetIdx = baseValues.length + 2;

      const gamesQuery = `
        SELECT g.* FROM games g
        ${whereClause}
        ORDER BY g.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
      const valuesGames = [...baseValues, perPage, offset];

      const countQuery = `SELECT COUNT(*) FROM games g ${whereClause}`;
      const valuesCount = [...baseValues];

      const [games, countRows] = await Promise.all([
        query(gamesQuery, valuesGames),
        query(countQuery, valuesCount),
      ]);

      reply.send({
        games,
        total: parseInt(countRows[0].count),
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Database error' });
    }
  });

  // Spielname via ID abrufen — Path-Param wird ohne JSON-Schema gegen
  // ID_PATTERN aus dem Contract validiert (Fastify-Schemas decken keine
  // route-params nicht ab, wenn die Route ohne :id-schema gemeldet wird).
  fastify.get('/:id', async (req, reply) => {
    const gameId = req.params.id;
    if (!isValidId(gameId)) return reply.code(400).send({ error: 'Invalid game ID' });

    // Phase 2 (Zugriffsschutz): private Spiele nur für Ersteller/Teilnehmer.
    // visibility und is_owner werden mitgeliefert, damit das UI private Runden
    // kennzeichnen kann; die created_by-UUID bleibt intern.
    const account = await getAccountFromRequest(req);
    const access = await getGameAccess(gameId, account?.id ?? null);
    if (!access.exists) return reply.code(404).send({ error: 'Not found' });
    if (!access.allowed) return reply.code(403).send({ error: 'forbidden' });
    reply.send({
      id: gameId,
      name: access.name,
      visibility: access.visibility,
      is_owner: access.isOwner,
    });
  });

  // Spieler eines Spiels abrufen
  fastify.get('/:id/players', async (req, reply) => {
    const gameId = req.params.id;
    if (!isValidId(gameId)) return reply.code(400).send({ error: 'Invalid game ID' });

    // Gleicher Zugriffsschutz wie beim Spiel selbst.
    const account = await getAccountFromRequest(req);
    const access = await getGameAccess(gameId, account?.id ?? null);
    if (!access.exists) return reply.code(404).send({ error: 'Not found' });
    if (!access.allowed) return reply.code(403).send({ error: 'forbidden' });

    const rows = await query(
      // registered/avatar: markiert kanonische (Konto-)Identitäten, damit die
      // Bearbeiten-Ansicht sie read-only hält (kein versehentliches Umbenennen).
      `SELECT p.id, p.name,
              EXISTS (SELECT 1 FROM accounts a WHERE a.player_id = p.id) AS registered,
              (SELECT a.avatar FROM accounts a WHERE a.player_id = p.id) AS avatar
       FROM players p
       JOIN game_players gp ON gp.player_id = p.id
       WHERE gp.game_id = $1`,
      [gameId]
    );
    reply.send(rows);
  });

  // Zusammenfassung with total count for pagination
  fastify.get('/summary', async (req, reply) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(10, parseInt(req.query.per_page) || 10);
    const offset = (page - 1) * perPage;
    const search = req.query.search;

    try {
      // Optionale Auth: gleicher Sichtbarkeits-Guard wie GET / — private Spiele
      // nur für Ersteller/zugeordnete Mitspieler, sonst ausgeblendet.
      const account = await getAccountFromRequest(req);
      const me = account?.id ?? null;

      const baseValues = [me];
      let whereClause = `WHERE ${visibilityGuard('$1')}`;
      if (search) {
        whereClause += ` AND (
          g.name ILIKE $2 OR EXISTS (
            SELECT 1 FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = g.id AND p.name ILIKE $2
          )
        )`;
        baseValues.push(`%${search}%`);
      }

      const limitIdx = baseValues.length + 1;
      const offsetIdx = baseValues.length + 2;
      const values = [...baseValues, perPage, offset];
      const countValues = [...baseValues];

      const gamesQuery = `
        WITH filtered_games AS (
          SELECT g.*
          FROM games g
          ${whereClause}
          ORDER BY g.created_at DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        ),
        player_stats AS (
          SELECT
            g.id AS game_id,
            p.id AS player_id,
            p.name,
            ROUND(AVG(s.strokes)::numeric, 2) AS avg,
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
        FROM filtered_games g
      `;

      const countQuery = `SELECT COUNT(*) FROM games g ${whereClause}`;

      const [games, countRows] = await Promise.all([
        query(gamesQuery, values),
        query(countQuery, countValues),
      ]);

      reply.send({
        games,
        total: parseInt(countRows[0].count),
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Database error' });
    }
  });
}
