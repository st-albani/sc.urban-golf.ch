import { schemas, isValidId } from '@urban-golf/contract';
import { getAccountFromRequest } from '../utils/auth.js';
import {
  listGames,
  listGamesSummary,
  getGame,
  getGamePlayers,
  upsertGameWithPlayers,
} from '../persistence/games.js';

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

    // Optionale Identität: ist der Request eingeloggt, wird der Ersteller
    // serverseitig aus der Session abgeleitet (nie aus Client-Feldern).
    // Anonym bleibt created_by NULL — der Flow bleibt unverändert.
    const account = await getAccountFromRequest(req);

    // Sichtbarkeit nur für eingeloggte Ersteller wirksam — anonyme Spiele
    // bleiben immer öffentlich (kein privates Spiel ohne Konto).
    const visibility = account && req.body.visibility === 'private' ? 'private' : 'public';

    const game = await upsertGameWithPlayers({
      id,
      name,
      playerIds: players.filter(pid => isValidId(pid)),
      createdBy: account?.id ?? null,
      visibility,
    });

    return reply.send({ ...game, status: 'upserted' });
  });

  // Spiele abrufen mit optionaler Suche und Pagination
  fastify.get('/', async (req, reply) => {
    // Optionale Auth: private Spiele nur für den Ersteller oder einen dem
    // Konto zugeordneten Mitspieler; anonyme Requests sehen nur öffentliche.
    const account = await getAccountFromRequest(req);

    return reply.send(await listGames({
      me: account?.id ?? null,
      page: req.query.page,
      perPage: req.query.per_page,
      search: req.query.search,
    }));
  });

  // Spielname via ID abrufen
  fastify.get('/:id', { schema: schemas.idParams }, async (req, reply) => {
    // Phase 1 (ungelistet): der Direktzugriff bleibt offen — visibility und ein
    // is_owner-Flag werden mitgeliefert, damit das UI private Runden kennzeichnen
    // und den Sichtbarkeits-Umschalter nur dem Ersteller anbieten kann.
    const account = await getAccountFromRequest(req);
    const game = await getGame(req.params.id, { me: account?.id ?? null });
    if (!game) return reply.code(404).send({ error: 'Not found' });
    return reply.send(game);
  });

  // Spieler eines Spiels abrufen
  fastify.get('/:id/players', { schema: schemas.idParams }, async (req, reply) => {
    return reply.send(await getGamePlayers(req.params.id));
  });

  // Zusammenfassung with total count for pagination
  fastify.get('/summary', async (req, reply) => {
    // Optionale Auth: gleicher Sichtbarkeits-Guard wie GET / — private Spiele
    // nur für Ersteller/zugeordnete Mitspieler, sonst ausgeblendet.
    const account = await getAccountFromRequest(req);

    return reply.send(await listGamesSummary({
      me: account?.id ?? null,
      page: req.query.page,
      perPage: req.query.per_page,
      search: req.query.search,
    }));
  });
}
