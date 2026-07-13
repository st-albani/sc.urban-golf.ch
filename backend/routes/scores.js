import { query } from '../db/pg.js';
import { schemas } from '@urban-golf/contract';
import { getAccountFromRequest } from '../utils/auth.js';
import { getGameAccess } from '../utils/gameAccess.js';

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

    // Phase-2-Zugriffsschutz: Scores privater Spiele nur für Ersteller/Teilnehmer.
    const account = await getAccountFromRequest(req);
    const access = await getGameAccess(gameId, account?.id ?? null);
    if (!access.exists) return reply.code(404).send({ error: 'Not found' });
    if (!access.allowed) return reply.code(403).send({ error: 'forbidden' });

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

    // Scores privater Spiele nur von Ersteller/Teilnehmern (kein anonymes
    // Scoren per geteiltem Link mehr — bewusste Phase-2-Semantik).
    const account = await getAccountFromRequest(req);
    const access = await getGameAccess(game_id, account?.id ?? null);
    if (!access.exists) return reply.code(404).send({ error: 'Not found' });
    if (!access.allowed) return reply.code(403).send({ error: 'forbidden' });

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
