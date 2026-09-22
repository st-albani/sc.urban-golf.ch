import { query } from '../db/pg.js';

// Persistenz-Modul für Feedback.

/** Feedback speichern. Leere Angaben zu Name/Email werden zu NULL. */
export async function saveFeedback({ rating, message, name, email }) {
  await query(
    `INSERT INTO feedback (rating, message, name, email)
     VALUES ($1, $2, $3, $4)`,
    [rating, message, name || null, email || null],
  );
}
