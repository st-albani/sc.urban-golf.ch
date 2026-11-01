export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 Minuten

/**
 * Relying-Party-Konfiguration für Passkeys. Wird pro Aufruf aus der Umgebung
 * gelesen, damit Tests sie über process.env setzen können.
 *
 * WEBAUTHN_RP_ID muss die (registrierbare) Domain des Frontends sein, nicht die
 * der API — ein Passkey ist an die Domain gebunden, auf der er erstellt wurde.
 * WEBAUTHN_ORIGINS sind die exakten Frontend-Origins (Schema + Host + Port);
 * ohne eigene Angabe gelten die CORS-Origins, die bereits das Frontend nennen.
 */
export function webauthnConfig() {
  const origins = (process.env.WEBAUTHN_ORIGINS || process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return {
    rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME || 'Urban Golf ScoreCard',
    origins,
  };
}
