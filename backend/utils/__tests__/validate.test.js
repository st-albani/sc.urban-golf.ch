import { describe, it, expect } from 'vitest'
import { isValidId, isValidEmail } from '@urban-golf/contract'

// Body / payload validation now happens via Fastify JSON schemas wired
// onto each route from @urban-golf/contract.schemas (see routes/*.js +
// route integration tests). These remaining unit tests cover the two
// pure id/email predicates that still get called from path-param guards
// (e.g. /games/:id).

describe('isValidId', () => {
  it('accepts valid nanoid', () => {
    expect(isValidId('abcdefghij1234567890')).toBe(true)
    expect(isValidId('abc_def-ghi12')).toBe(true)
  })
  it('rejects too short', () => {
    expect(isValidId('short')).toBe(false)
  })
  it('rejects too long', () => {
    expect(isValidId('a'.repeat(31))).toBe(false)
  })
  it('rejects special chars', () => {
    expect(isValidId('abc!@#$%^&*()12')).toBe(false)
  })
  it('rejects non-string', () => {
    expect(isValidId(12345)).toBe(false)
    expect(isValidId(null)).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('name+tag@domain.co')).toBe(true)
    expect(isValidEmail('a@b.ch')).toBe(true)
  })
  it('rejects missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })
  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })
  it('rejects missing TLD', () => {
    expect(isValidEmail('user@domain')).toBe(false)
  })
  it('rejects spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
    expect(isValidEmail('user@ example.com')).toBe(false)
  })
  it('rejects email > 100 chars', () => {
    expect(isValidEmail('a'.repeat(90) + '@example.com')).toBe(false)
  })
  it('rejects non-string', () => {
    expect(isValidEmail(123)).toBe(false)
    expect(isValidEmail(null)).toBe(false)
  })
})
