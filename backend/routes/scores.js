import { query } from '../db/pg.js';
import { schemas } from '@urban-golf/contract';

export default async function (fastify, _opts) {
  fastify.get('/', {
    schema: schemas.getScores,
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const { game_id: gameId } = req.query;

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
    schema: schemas.postScore,
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
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
