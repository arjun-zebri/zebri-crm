// @vitest-environment node
/**
 * The two-factor assurance check behind the middleware gate
 * (Phase 4, Task 23). The case that matters most is the last one in the
 * first block: a password-only (aal1) session of a user with a verified
 * factor must be told it still owes the second factor.
 */
import { describe, expect, it } from 'vitest';

import {
  currentAssuranceLevel,
  decodeJwtPayload,
  hasVerifiedFactor,
  needsSecondFactor,
} from '@/lib/auth/mfa';

/** An unsigned token with the given payload: the helper never checks signatures. */
function token(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

const withFactor = { factors: [{ status: 'verified', factor_type: 'totp' }] };
const unverifiedOnly = { factors: [{ status: 'unverified', factor_type: 'totp' }] };
const noFactors = { factors: [] };

describe('needsSecondFactor', () => {
  it('is false for a user with no factors, whatever the session level', () => {
    expect(needsSecondFactor(noFactors, token({ aal: 'aal1' }))).toBe(false);
    expect(needsSecondFactor({}, token({ aal: 'aal1' }))).toBe(false);
  });

  it('is false for a half-finished (unverified) enrolment', () => {
    expect(needsSecondFactor(unverifiedOnly, token({ aal: 'aal1' }))).toBe(false);
  });

  it('is false once the session has reached aal2', () => {
    expect(needsSecondFactor(withFactor, token({ aal: 'aal2' }))).toBe(false);
  });

  it('is true for a password-only session of a user with a verified factor', () => {
    expect(needsSecondFactor(withFactor, token({ aal: 'aal1' }))).toBe(true);
  });

  it('fails closed on a missing or unreadable token', () => {
    expect(needsSecondFactor(withFactor, undefined)).toBe(true);
    expect(needsSecondFactor(withFactor, 'not-a-jwt')).toBe(true);
    expect(needsSecondFactor(withFactor, token({}))).toBe(true);
  });
});

describe('helpers', () => {
  it('decodes a base64url payload with padding stripped', () => {
    expect(decodeJwtPayload(token({ sub: 'u1', aal: 'aal2' }))).toEqual({ sub: 'u1', aal: 'aal2' });
  });

  it('rejects non-object payloads and malformed tokens', () => {
    const arrayPayload = `x.${Buffer.from('[1]').toString('base64url')}.y`;
    expect(decodeJwtPayload(arrayPayload)).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload('a.%%%.c')).toBeNull();
  });

  it('reads only recognised levels', () => {
    expect(currentAssuranceLevel(token({ aal: 'aal3' }))).toBeNull();
    expect(currentAssuranceLevel(token({ aal: 'aal1' }))).toBe('aal1');
  });

  it('counts only verified factors', () => {
    expect(hasVerifiedFactor(withFactor)).toBe(true);
    expect(hasVerifiedFactor(unverifiedOnly)).toBe(false);
    expect(hasVerifiedFactor(null)).toBe(false);
  });
});
