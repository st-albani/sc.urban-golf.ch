// Shared validation contract — single source of truth for both workspaces.
// Harmonized values: where frontend and backend previously disagreed, the
// more permissive value wins (STROKES_MAX 20, GAME_NAME_MAX_LENGTH 100) so
// existing data never becomes retroactively invalid.

export const VALIDATION = Object.freeze({
  STROKES_MIN: -3,
  STROKES_MAX: 20,
  HOLE_MIN: 1,
  HOLE_MAX: 18,
  NAME_MAX_LENGTH: 100,
  GAME_NAME_MAX_LENGTH: 100,
  MESSAGE_MAX_LENGTH: 2000,
  PLAYERS_MAX: 10,
  RATING_MIN: 1,
  RATING_MAX: 5,
  EMAIL_MAX_LENGTH: 100,
});

export const ID_PATTERN = /^[a-zA-Z0-9_-]{10,30}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ID_PATTERN_STRING = '^[a-zA-Z0-9_-]{10,30}$';

const idSchema = {
  type: 'string',
  pattern: ID_PATTERN_STRING,
};

const playerSchema = {
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: idSchema,
    name: { type: 'string', minLength: 1, maxLength: VALIDATION.NAME_MAX_LENGTH },
  },
};

const gameRowSchema = {
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: idSchema,
    name: { type: 'string' },
    created_at: { type: ['string', 'null'] },
  },
};

const scoreRowSchema = {
  type: 'object',
  required: ['game_id', 'player_id', 'hole', 'strokes'],
  properties: {
    id: { type: ['integer', 'string'] },
    game_id: idSchema,
    player_id: idSchema,
    player_name: { type: 'string' },
    hole: { type: 'integer', minimum: VALIDATION.HOLE_MIN, maximum: VALIDATION.HOLE_MAX },
    strokes: { type: 'integer', minimum: VALIDATION.STROKES_MIN, maximum: VALIDATION.STROKES_MAX },
  },
};

export const schemas = Object.freeze({
  postPlayer: {
    body: {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: idSchema,
        name: { type: 'string', minLength: 1, maxLength: VALIDATION.NAME_MAX_LENGTH },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: idSchema,
          name: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  },

  getPlayers: {
    response: {
      200: { type: 'array', items: playerSchema },
    },
  },

  getGameById: {
    response: { 200: gameRowSchema },
  },

  getGamePlayers: {
    response: {
      200: { type: 'array', items: playerSchema },
    },
  },

  postGame: {
    body: {
      type: 'object',
      required: ['id', 'name', 'players'],
      properties: {
        id: idSchema,
        name: { type: 'string', minLength: 1, maxLength: VALIDATION.GAME_NAME_MAX_LENGTH },
        players: {
          type: 'array',
          minItems: 1,
          maxItems: VALIDATION.PLAYERS_MAX,
          items: idSchema,
        },
      },
      additionalProperties: false,
    },
  },

  getScores: {
    querystring: {
      type: 'object',
      required: ['game_id'],
      properties: { game_id: idSchema },
    },
  },

  postScore: {
    body: {
      type: 'object',
      required: ['game_id', 'player_id', 'hole', 'strokes'],
      properties: {
        game_id: idSchema,
        player_id: idSchema,
        hole: { type: 'integer', minimum: VALIDATION.HOLE_MIN, maximum: VALIDATION.HOLE_MAX },
        strokes: { type: 'integer', minimum: VALIDATION.STROKES_MIN, maximum: VALIDATION.STROKES_MAX },
      },
      additionalProperties: false,
    },
  },

  postFeedback: {
    body: {
      type: 'object',
      required: ['rating', 'message'],
      properties: {
        rating: {
          type: 'integer',
          minimum: VALIDATION.RATING_MIN,
          maximum: VALIDATION.RATING_MAX,
        },
        message: {
          type: 'string',
          minLength: 1,
          maxLength: VALIDATION.MESSAGE_MAX_LENGTH,
        },
        name: {
          type: ['string', 'null'],
          maxLength: VALIDATION.NAME_MAX_LENGTH,
        },
        email: {
          type: ['string', 'null'],
          maxLength: VALIDATION.EMAIL_MAX_LENGTH,
          pattern: '^$|^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
      },
      additionalProperties: false,
    },
  },

  postAuthRequestOtp: {
    body: {
      type: 'object',
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          minLength: 3,
          maxLength: VALIDATION.EMAIL_MAX_LENGTH,
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
      },
      additionalProperties: false,
    },
  },

  postAuthVerifyOtp: {
    body: {
      type: 'object',
      required: ['email', 'code'],
      properties: {
        email: {
          type: 'string',
          minLength: 3,
          maxLength: VALIDATION.EMAIL_MAX_LENGTH,
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
        code: {
          type: 'string',
          pattern: '^[0-9]{4,8}$',
        },
      },
      additionalProperties: false,
    },
  },

  postAuthProfile: {
    body: {
      type: 'object',
      required: ['displayName'],
      properties: {
        displayName: {
          type: 'string',
          minLength: 1,
          maxLength: VALIDATION.NAME_MAX_LENGTH,
        },
      },
      additionalProperties: false,
    },
  },
});

export { playerSchema, gameRowSchema, scoreRowSchema };

export function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export function isValidEmail(email) {
  return typeof email === 'string'
    && email.length <= VALIDATION.EMAIL_MAX_LENGTH
    && EMAIL_PATTERN.test(email);
}
