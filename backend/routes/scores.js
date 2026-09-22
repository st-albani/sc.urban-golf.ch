import { schemas } from '@urban-golf/contract';
import { listScores, saveScore } from '../persistence/scores.js';

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
    return reply.send(await listScores(req.query.game_id));
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

    const saved = await saveScore({ gameId: game_id, playerId: player_id, hole, strokes });
    return reply.code(200).send({ id: saved.id, game_id, player_id, hole, strokes });
  });
}
