import crypto from 'crypto';
import { queryOne } from '../db/pg.js';

export const SESSION_COOKIE = 'ug_session';
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 Minuten
export const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 Tage
export const OTP_MAX_ATTEMPTS = 5;

// Optionaler serverseitiger Pepper für die Hashes (Defense in Depth).
const PEPPER = process.env.AUTH_PEPPER || '';

/** Einweg-Hash für OTP-Codes und Session-Tokens (nie Klartext speichern). */
export function hashToken(value) {
  return crypto.createHash('sha256').update(PEPPER + String(value)).digest('hex');
}

/** 6-stelliger numerischer Login-Code. */
export function generateOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Zufälliges, unguessbares Session-Token (roh im Cookie, Hash in der DB). */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/** Cookie-Optionen — cross-site-fähig in Produktion (SameSite=None; Secure). */
export function sessionCookieOptions() {
  const prod = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    path: '/',
    sameSite: prod ? 'none' : 'lax',
    secure: prod,
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/**
 * Liest die Session aus dem Cookie und gibt den zugehörigen Account zurück
 * (oder null). Wiederverwendbar für geschützte Endpunkte.
 */
export async function getAccountFromRequest(request) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const row = await queryOne(
    `SELECT a.id, a.email, a.display_name
       FROM sessions s
       JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return row ? { id: row.id, email: row.email, displayName: row.display_name } : null;
}

/**
 * Fastify-preHandler: erzwingt eine gültige Session. Setzt request.account
 * oder antwortet mit 401. Für geschützte (account-scoped) Endpunkte.
 */
export async function requireAuth(request, reply) {
  const account = await getAccountFromRequest(request);
  if (!account) {
    reply.code(401).send({ error: 'unauthenticated' });
    return reply;
  }
  request.account = account;
}
