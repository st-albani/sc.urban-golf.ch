import { schemas } from '@urban-golf/contract';
import { query, queryOne } from '../db/pg.js';
import { sendMail, isMailConfigured } from '../utils/mailer.js';
import {
  SESSION_COOKIE,
  OTP_TTL_MS,
  SESSION_TTL_MS,
  OTP_MAX_ATTEMPTS,
  hashToken,
  generateOtpCode,
  generateSessionToken,
  normalizeEmail,
  sessionCookieOptions,
  getAccountFromRequest,
} from '../utils/auth.js';

export default async function (fastify, _opts) {
  // Einmalcode anfordern. Antwortet immer 200 (kein Account-Enumeration-Leak).
  fastify.post('/request-otp', {
    schema: schemas.postAuthRequestOtp,
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const email = normalizeEmail(request.body.email);
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    try {
      // Ältere, noch offene Codes dieser E-Mail entwerten.
      await query(
        `UPDATE otp_codes SET consumed_at = now() WHERE email = $1 AND consumed_at IS NULL`,
        [email],
      );
      await query(
        `INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
        [email, hashToken(code), expiresAt],
      );
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Database error' });
    }

    const subject = 'Dein Urban-Golf Login-Code';
    const text = `Dein Login-Code lautet: ${code}\n\nEr ist 10 Minuten gültig. Wenn du das nicht warst, ignoriere diese Mail.`;
    if (isMailConfigured()) {
      try {
        await sendMail({ to: email, subject, text });
      } catch (err) {
        request.log.warn(err, 'OTP-Mail konnte nicht gesendet werden');
      }
    } else {
      // Dev-Komfort: ohne SMTP den Code loggen (nie in der Response ausgeben).
      request.log.info({ email, code }, 'OTP erzeugt (SMTP nicht konfiguriert)');
    }

    return reply.send({ ok: true });
  });

  // Code verifizieren → Account (upsert) + Session-Cookie.
  fastify.post('/verify-otp', {
    schema: schemas.postAuthVerifyOtp,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const email = normalizeEmail(request.body.email);
    const code = String(request.body.code);
    let account;

    try {
      const challenge = await queryOne(
        `SELECT id, code_hash, attempts FROM otp_codes
          WHERE email = $1 AND consumed_at IS NULL AND expires_at > now()
          ORDER BY created_at DESC
          LIMIT 1`,
        [email],
      );

      if (!challenge) {
        return reply.code(400).send({ error: 'invalid_code' });
      }
      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        await query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [challenge.id]);
        return reply.code(400).send({ error: 'invalid_code' });
      }
      if (challenge.code_hash !== hashToken(code)) {
        await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [challenge.id]);
        return reply.code(400).send({ error: 'invalid_code' });
      }

      // Erfolg: Code verbrauchen, Account upserten, Session anlegen.
      await query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [challenge.id]);
      account = await queryOne(
        `INSERT INTO accounts (email) VALUES ($1)
           ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id, email, display_name`,
        [email],
      );

      const token = generateSessionToken();
      await query(
        `INSERT INTO sessions (account_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [account.id, hashToken(token), new Date(Date.now() + SESSION_TTL_MS)],
      );
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Database error' });
    }

    return reply.send({
      account: { id: account.id, email: account.email, displayName: account.display_name },
    });
  });

  // Aktuelle Session/Account.
  fastify.get('/me', async (request, reply) => {
    try {
      const account = await getAccountFromRequest(request);
      if (!account) return reply.code(401).send({ error: 'unauthenticated' });
      return reply.send({ account });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Database error' });
    }
  });

  // Abmelden.
  fastify.post('/logout', async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) {
      try {
        await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
      } catch (err) {
        request.log.error(err);
      }
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({ ok: true });
  });
}
