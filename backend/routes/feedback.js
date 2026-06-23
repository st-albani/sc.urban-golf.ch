import { query } from '../db/pg.js';
import nodemailer from 'nodemailer';
import { schemas } from '@urban-golf/contract';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

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
    if (process.env.BREVO_SMTP_USER && process.env.ADMIN_EMAIL) {
      try {
        await transporter.sendMail({
          from: '"Urban-Golf.ch - ScoreCard" <info@urban-golf.ch>',
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
