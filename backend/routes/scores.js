import { query } from '../db/pg.js';
import { validateScore, isValidId } from '../utils/validate.js';

export default async function (fastify, _opts) {
  fastify.get('/', {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const gameId = req.query.game_id;
    if (!gameId || !isValidId(gameId)) {
      return reply.code(400).send({ error: 'Missing or invalid game_id query parameter' });
    }

    const rows = await query(
      `SELECT s.*, p.name as player_name FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.game_id = $1
       ORDER BY s.hole ASC, p.name ASC`,
      [gameId]
    );
    reply.send(rows);
  });

  fastify.post('/', {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const validationErrors = validateScore(req.body || {});
    if (validationErrors) {
      return reply.code(400).send({ error: 'Validation failed', details: validationErrors });
    }

    const { game_id, player_id, strokes, hole } = req.body;

    const rows = await query(
      `INSERT INTO scores (game_id, player_id, hole, strokes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, player_id, hole)
       DO UPDATE SET strokes = EXCLUDED.strokes
       RETURNING id`,
      [game_id, player_id, hole, strokes]
    );
    reply.code(200).send({ id: rows[0].id, game_id, player_id, hole, strokes });
  });
}
