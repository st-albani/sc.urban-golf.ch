import { AVERAGE_DECIMALS } from '@urban-golf/contract/standings';

/**
 * Aggregat-Ausdruck für den Schnitt eines Spielers in den Summary-Read-Models.
 *
 * Die Summary-Abfragen rechnen aus Pagination-Gründen weiter in Postgres statt
 * pro Zeile in JS. Damit sie trotzdem dieselbe Zahl liefern wie das Frontend,
 * kommt die Nachkommastelle aus dem Standings-Vertrag: `ROUND(numeric, n)`
 * rundet wie `roundAverage()` kaufmännisch weg von der Null.
 */
export function avgStrokesSql(strokesExpr) {
  return `ROUND(AVG(${strokesExpr})::numeric, ${AVERAGE_DECIMALS})`;
}
