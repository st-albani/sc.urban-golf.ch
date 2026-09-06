// Shared standings contract — the one rule that turns players + a ScoreMap
// into totals and averages. Framework-free, pure, no I/O: the Vue frontend and
// the Fastify backend import the same function and therefore show the same
// numbers.
//
// The decisions live here and nowhere else:
//
//  * Counting. A ScoreMap slot counts only if it parses to a whole number.
//    '', null, undefined and garbage mean "hole not played" — they enter
//    neither the sum nor the average. 0 and negative strokes (VALIDATION
//    allows down to STROKES_MIN) are legitimate values and count in full.
//  * Rounding. An average is rounded to AVERAGE_DECIMALS places, half away
//    from zero — the same rule Postgres applies in ROUND(numeric, n), so the
//    backend may keep aggregating in SQL without drifting from this module.
//  * Nothing played. Without a counted hole there is no average: `average` is
//    null and renders as AVERAGE_PLACEHOLDER. The total of no holes is 0.
//
// Rounding is a presentation step, not part of the comparison: helpers that
// feed a comparison (mean) stay unrounded on purpose.

/** Decimal places an average is shown with — the single rounding contract. */
export const AVERAGE_DECIMALS = 1;

/** Rendered instead of an average when nothing was played (en dash). */
export const AVERAGE_PLACEHOLDER = '–';

/**
 * Coerces one ScoreMap slot to strokes. Returns null for anything that does
 * not represent a played hole.
 */
export function toStrokes(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : null;
  if (typeof raw === 'string') {
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/** Unrounded arithmetic mean, or null for an empty list. */
export function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Rounds to AVERAGE_DECIMALS, half away from zero (Postgres ROUND semantics). */
export function roundAverage(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const factor = 10 ** AVERAGE_DECIMALS;
  const magnitude = Math.round(Math.abs(value) * factor) / factor;
  return value < 0 ? -magnitude : magnitude;
}

/** Renders an average — already rounded or raw — for display. */
export function formatAverage(value) {
  const rounded = roundAverage(value);
  return rounded === null ? AVERAGE_PLACEHOLDER : rounded.toFixed(AVERAGE_DECIMALS);
}

/** Total, counted holes and rounded average of a single player. */
export function playerStandings(scores, playerId) {
  const strokes = Object.values(scores?.[playerId] ?? {})
    .map(toStrokes)
    .filter((n) => n !== null);

  return {
    total: strokes.reduce((a, b) => a + b, 0),
    holes: strokes.length,
    average: roundAverage(mean(strokes)),
  };
}

/** Players + scores in, standings out — one row per player, input order kept. */
export function standings(players, scores) {
  return (players ?? []).map((player) => ({
    id: player.id,
    name: player.name,
    ...playerStandings(scores, player.id),
  }));
}
