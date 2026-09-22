import { schemas } from '@urban-golf/contract';
import { saveFeedback } from '../persistence/feedback.js';
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

    await saveFeedback({ rating, message, name, email });

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

    return reply.send({ success: true });
  });
}
