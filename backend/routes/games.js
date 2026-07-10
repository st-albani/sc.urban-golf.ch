import { query, queryOne, transaction } from '../db/pg.js';
import { schemas, isValidId } from '@urban-golf/contract';
import { getAccountFromRequest } from '../utils/auth.js';

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

      const game = await transaction(async (client) => {
        const gameResult = await client.query(
          // created_by wird nur beim Anlegen gesetzt; beim Bearbeiten (ON CONFLICT)
          // bleibt der ursprüngliche Ersteller unangetastet.
          `INSERT INTO games (id, name, created_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, name`,
          [id, name, createdBy]
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
      let gamesQuery = '';
      let valuesGames = [];
      let countQuery = '';
      let valuesCount = [];

      if (search) {
        gamesQuery = `
          SELECT g.* FROM games g
          WHERE g.name ILIKE $1 OR EXISTS (
            SELECT 1 FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = g.id AND p.name ILIKE $1
          )
          ORDER BY g.created_at DESC
          LIMIT $2 OFFSET $3`;

        valuesGames = [`%${search}%`, perPage, offset];

        countQuery = `
          SELECT COUNT(*) FROM games g
          WHERE g.name ILIKE $1 OR EXISTS (
            SELECT 1 FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = g.id AND p.name ILIKE $1
          )`;
        valuesCount = [`%${search}%`];
      } else {
        gamesQuery = `
          SELECT g.* FROM games g
          ORDER BY g.created_at DESC
          LIMIT $1 OFFSET $2`;

        valuesGames = [perPage, offset];
        countQuery = `SELECT COUNT(*) FROM games g`;
      }

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

    const game = await queryOne(`SELECT id, name FROM games WHERE id = $1`, [gameId]);
    if (!game) return reply.code(404).send({ error: 'Not found' });
    reply.send(game);
  });

  // Spieler eines Spiels abrufen
  fastify.get('/:id/players', async (req, reply) => {
    const gameId = req.params.id;
    if (!isValidId(gameId)) return reply.code(400).send({ error: 'Invalid game ID' });

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
    const values = search ? [`%${search}%`, perPage, offset] : [perPage, offset];

    try {
      const searchFilter = search ? `
        WHERE g.name ILIKE $1
          OR EXISTS (
            SELECT 1 FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = g.id AND p.name ILIKE $1
          )` : '';

      const countValues = search ? [`%${search}%`] : [];

      const gamesQuery = `
        WITH filtered_games AS (
          SELECT g.*
          FROM games g
          ${searchFilter}
          ORDER BY g.created_at DESC
          LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}
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

      const countQuery = `SELECT COUNT(*) FROM games g ${searchFilter}`;

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
