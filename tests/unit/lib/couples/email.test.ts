/**
 * `resolveCoupleEmail` is the single place that decides which address
 * a couple gets emailed at after the partner-contact-triples
 * migration (new couples carry only `primary_email`; legacy rows may
 * carry only `email`). These cases pin the precedence + trimming
 * behaviour the send routes and the automations snapshot rely on.
 */

import { describe, expect, it } from 'vitest'

import { resolveCoupleEmail } from '@/lib/couples/email'

describe('resolveCoupleEmail', () => {
  it('prefers primary_email when both columns are set', () => {
    expect(
      resolveCoupleEmail({ primary_email: 'primary@test', email: 'legacy@test' }),
    ).toBe('primary@test')
  })

  it('uses primary_email when the legacy email is empty (new couples)', () => {
    expect(resolveCoupleEmail({ primary_email: 'primary@test', email: '' })).toBe(
      'primary@test',
    )
  })

  it('falls back to the legacy email when primary_email is missing', () => {
    expect(resolveCoupleEmail({ primary_email: null, email: 'legacy@test' })).toBe(
      'legacy@test',
    )
    expect(resolveCoupleEmail({ email: 'legacy@test' })).toBe('legacy@test')
  })

  it('trims whitespace and treats whitespace-only values as missing', () => {
    expect(resolveCoupleEmail({ primary_email: '  primary@test ' })).toBe('primary@test')
    expect(resolveCoupleEmail({ primary_email: '   ', email: ' legacy@test ' })).toBe(
      'legacy@test',
    )
  })

  it('returns null when no email exists anywhere', () => {
    expect(resolveCoupleEmail({ primary_email: null, email: '' })).toBeNull()
    expect(resolveCoupleEmail({})).toBeNull()
    expect(resolveCoupleEmail(null)).toBeNull()
    expect(resolveCoupleEmail(undefined)).toBeNull()
  })
})
