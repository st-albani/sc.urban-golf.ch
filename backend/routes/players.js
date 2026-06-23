import { query } from '../db/pg.js';
import { schemas } from '@urban-golf/contract';

export default async function (fastify, _opts) {
  // Spieler erstellen oder aktualisieren (POST + UPSERT)
  fastify.post('/', {
    schema: schemas.postPlayer,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const { id, name } = req.body;

    try {
      await query(
        `INSERT INTO players (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [id, name]
      );
      reply.code(200).send({ id, name, status: 'upserted' });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Database error' });
    }
  });

  // Alle Spieler abrufen
  fastify.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM players ORDER BY name');
    reply.send(rows);
  });
}
