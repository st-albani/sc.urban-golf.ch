import { schemas } from '@urban-golf/contract';
import { listPlayers, upsertPlayer, searchRegisteredPlayers } from '../persistence/players.js';

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

    await upsertPlayer({ id, name });
    return reply.code(200).send({ id, name, status: 'upserted' });
  });

  // Alle Spieler abrufen
  fastify.get('/', async (_req, reply) => {
    return reply.send(await listPlayers());
  });

  // Registrierte Spieler suchen (Konten mit kanonischer Identität, d. h.
  // gesetztem Anzeigenamen). Für die Spielersuche beim Erstellen eines
  // Spiels — bewusst auch ohne Login nutzbar.
  fastify.get('/search', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return reply.send({ players: [] });

    return reply.send({ players: await searchRegisteredPlayers(q) });
  });
}
