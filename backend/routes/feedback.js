import { query } from '../db/pg.js';
import { schemas } from '@urban-golf/contract';
import { sendMail, isMailConfigured } from '../utils/mailer.js';

export default async function (fastify, _opts) {
  fastify.post('/', {
    schema: schemas.postFeedback,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const { rating, message, name, email } = request.body;

    try {
      await query(
        `INSERT INTO feedback (rating, message, name, email)
         VALUES ($1, $2, $3, $4)`,
        [rating, message, name || null, email || null]
      );
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to save feedback' });
    }

    // Benachrichtigung senden (optional, darf nicht fehlschlagen)
    if (isMailConfigured() && process.env.ADMIN_EMAIL) {
      try {
        await sendMail({
          to: process.env.ADMIN_EMAIL,
          subject: '🎉 Neues Feedback eingegangen',
          text: `Bewertung: ${rating}/5\nVon: ${name || 'Anonym'} <${email || 'keine Email'}>\n\n${message}`,
        });
      } catch (err) {
        request.log.warn(err, 'Feedback-Benachrichtigung konnte nicht gesendet werden');
      }
    }

    reply.send({ success: true });
  });
}
