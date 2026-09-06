/** One slot of a ScoreMap — a played hole, a placeholder or nothing at all. */
export type StrokeSlot = number | string | null | undefined;

/** `{ playerId: { hole: strokes } }` as both workspaces hold it. */
export type ScoreMap = {
  [playerId: string]: { [hole: number]: StrokeSlot } | undefined;
};

export interface StandingsPlayer {
  id: string;
  name: string;
}

export interface PlayerStandings {
  total: number;
  /** Holes that counted — slots that coerced to strokes. */
  holes: number;
  /** Rounded to AVERAGE_DECIMALS, or null when nothing was played. */
  average: number | null;
}

export interface StandingsRow extends PlayerStandings, StandingsPlayer {}

export const AVERAGE_DECIMALS: number;
export const AVERAGE_PLACEHOLDER: string;

export function toStrokes(raw: unknown): number | null;
export function mean(values: readonly number[]): number | null;
export function roundAverage(value: number | null | undefined): number | null;
export function formatAverage(value: number | null | undefined): string;
export function playerStandings(
  scores: ScoreMap | null | undefined,
  playerId: string,
): PlayerStandings;
export function standings(
  players: readonly StandingsPlayer[] | null | undefined,
  scores: ScoreMap | null | undefined,
): StandingsRow[];
