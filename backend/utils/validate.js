import { VALIDATION, isValidId, isValidEmail } from '@urban-golf/contract'

export { isValidId, isValidEmail }

export function validateScore({ game_id, player_id, hole, strokes } = {}) {
  const errors = []

  if (!isValidId(game_id)) errors.push('Invalid game_id')
  if (!isValidId(player_id)) errors.push('Invalid player_id')

  if (!Number.isInteger(hole) || hole < VALIDATION.HOLE_MIN || hole > VALIDATION.HOLE_MAX) {
    errors.push(`hole must be integer ${VALIDATION.HOLE_MIN}-${VALIDATION.HOLE_MAX}`)
  }

  if (!Number.isInteger(strokes) || strokes < VALIDATION.STROKES_MIN || strokes > VALIDATION.STROKES_MAX) {
    errors.push(`strokes must be integer ${VALIDATION.STROKES_MIN} to ${VALIDATION.STROKES_MAX}`)
  }

  return errors.length ? errors : null
}

export function validatePlayer({ id, name } = {}) {
  const errors = []

  if (!isValidId(id)) errors.push('Invalid player id')

  if (typeof name !== 'string' || name.trim() === '') {
    errors.push('Player name cannot be blank')
  } else if (name.length > VALIDATION.NAME_MAX_LENGTH) {
    errors.push(`Player name must be at most ${VALIDATION.NAME_MAX_LENGTH} characters`)
  }

  return errors.length ? errors : null
}

export function validateGame({ id, name, players } = {}) {
  const errors = []

  if (!isValidId(id)) errors.push('Invalid game id')

  if (typeof name !== 'string' || name.trim() === '') {
    errors.push('Game name required')
  } else if (name.length > VALIDATION.GAME_NAME_MAX_LENGTH) {
    errors.push(`Game name must be at most ${VALIDATION.GAME_NAME_MAX_LENGTH} characters`)
  }

  if (!Array.isArray(players) || players.length === 0) {
    errors.push('At least one player required')
  }

  return errors.length ? errors : null
}

export function validateFeedback({ rating, message, name, email } = {}) {
  const errors = []

  if (!Number.isInteger(rating) || rating < VALIDATION.RATING_MIN || rating > VALIDATION.RATING_MAX) {
    errors.push(`Rating must be ${VALIDATION.RATING_MIN}-${VALIDATION.RATING_MAX}`)
  }

  if (typeof message !== 'string' || message.trim() === '') {
    errors.push('Message required')
  } else if (message.length > VALIDATION.MESSAGE_MAX_LENGTH) {
    errors.push(`Message must be at most ${VALIDATION.MESSAGE_MAX_LENGTH} characters`)
  }

  if (name !== undefined && name !== null && typeof name === 'string' && name.length > VALIDATION.NAME_MAX_LENGTH) {
    errors.push(`Name must be at most ${VALIDATION.NAME_MAX_LENGTH} characters`)
  }

  if (email !== undefined && email !== null && email !== '') {
    if (!isValidEmail(email)) {
      errors.push('Invalid email format')
    }
  }

  return errors.length ? errors : null
}
