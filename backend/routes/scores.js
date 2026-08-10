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
    return reply.send(rows);
  });

  fastify.post('/', {
    schema: schemas.postScore,
    config: {
      rateLimit: {
        // Das Limit greift pro IP — eine Gruppe am selben Hotspot (oder mehrere
        // Geräte an derselben Runde) teilt es sich. Mit 60/min reichten wenige
        // Löcher zu sechst, um 429 zu kassieren; da 4xx nicht wiederholt wird,
        // ging der Score dabei früher verloren. 300 lässt normales Scoring
        // durch und bremst weiterhin echten Missbrauch.
        max: 300,
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
    return reply.code(200).send({ id: rows[0].id, game_id, player_id, hole, strokes });
  });
}
