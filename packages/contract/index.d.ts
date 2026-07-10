export interface ValidationLimits {
  readonly STROKES_MIN: -3;
  readonly STROKES_MAX: 20;
  readonly HOLE_MIN: 1;
  readonly HOLE_MAX: 18;
  readonly NAME_MAX_LENGTH: 100;
  readonly GAME_NAME_MAX_LENGTH: 100;
  readonly MESSAGE_MAX_LENGTH: 2000;
  readonly PLAYERS_MAX: 10;
  readonly RATING_MIN: 1;
  readonly RATING_MAX: 5;
  readonly EMAIL_MAX_LENGTH: 100;
}

export const VALIDATION: ValidationLimits;
export const ID_PATTERN: RegExp;
export const EMAIL_PATTERN: RegExp;
export const ID_PATTERN_STRING: string;

export type JSONSchema = Record<string, unknown>;

export interface RouteSchema {
  body?: JSONSchema;
  querystring?: JSONSchema;
  response?: Record<string | number, JSONSchema>;
}

export interface Schemas {
  readonly postPlayer: RouteSchema;
  readonly getPlayers: RouteSchema;
  readonly postGame: RouteSchema;
  readonly getGameById: RouteSchema;
  readonly getGamePlayers: RouteSchema;
  readonly getScores: RouteSchema;
  readonly postScore: RouteSchema;
  readonly postFeedback: RouteSchema;
  readonly postAuthRequestOtp: RouteSchema;
  readonly postAuthVerifyOtp: RouteSchema;
  readonly postAuthProfile: RouteSchema;
}

export const schemas: Schemas;
export const playerSchema: JSONSchema;
export const gameRowSchema: JSONSchema;
export const scoreRowSchema: JSONSchema;

export function isValidId(id: unknown): id is string;
export function isValidEmail(email: unknown): email is string;
