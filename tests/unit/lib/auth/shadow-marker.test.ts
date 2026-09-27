/**
 * The signed shadow-session marker (Phase 4 fix-2, review N1). Only a
 * value this server signed verifies; anything else is refused, so a
 * thief who knows their own session id cannot mint one.
 */
import { describe, expect, it } from 'vitest';

import { shadowMarkerMatch } from '@/lib/admin/shadow-sessions';
import { signShadowMarker, verifyShadowMarker } from '@/lib/auth/shadow-grant';

const SID = '44444444-4444-4444-8444-444444444444';
const MC = '22222222-2222-4222-8222-222222222222';
const SECRET = 'unit-test-service-role-key';

describe('signShadowMarker / verifyShadowMarker', () => {
  it('round-trips the session id and target', async () => {
    const value = await signShadowMarker({ sessionId: SID, targetUserId: MC }, SECRET);
    expect(value).toMatch(/^v1\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.[0-9a-f]{64}$/);
    expect(await verifyShadowMarker(value, SECRET)).toEqual({ sessionId: SID, targetUserId: MC });
  });

  it('refuses a tampered MAC, a swapped field, another key, no key and junk', async () => {
    const value = await signShadowMarker({ sessionId: SID, targetUserId: MC }, SECRET);
    const tampered = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    const swapped = value.replace(MC, '33333333-3333-4333-8333-333333333333');
    expect(await verifyShadowMarker(tampered, SECRET)).toBeNull();
    expect(await verifyShadowMarker(swapped, SECRET)).toBeNull();
    expect(await verifyShadowMarker(value, 'another-key')).toBeNull();
    expect(await verifyShadowMarker(value, null)).toBeNull();
    expect(await verifyShadowMarker(SID, SECRET)).toBeNull();
    expect(await verifyShadowMarker(undefined, SECRET)).toBeNull();
  });
});

describe('shadowMarkerMatch', () => {
  const base = { sessionId: SID, sessionUserId: MC, secret: SECRET };

  it('is absent with no marker, match only for a signed marker naming this session and user', async () => {
    const value = await signShadowMarker({ sessionId: SID, targetUserId: MC }, SECRET);
    expect(await shadowMarkerMatch({ ...base, marker: undefined })).toBe('absent');
    expect(await shadowMarkerMatch({ ...base, marker: value })).toBe('match');
  });

  it('is mismatch for a forged marker, another session, another user, or no session', async () => {
    const value = await signShadowMarker({ sessionId: SID, targetUserId: MC }, SECRET);
    expect(await shadowMarkerMatch({ ...base, marker: SID })).toBe('mismatch');
    expect(await shadowMarkerMatch({ ...base, marker: value, sessionId: '55555555-5555-4555-8555-555555555555' })).toBe('mismatch');
    expect(await shadowMarkerMatch({ ...base, marker: value, sessionUserId: '33333333-3333-4333-8333-333333333333' })).toBe('mismatch');
    expect(await shadowMarkerMatch({ ...base, marker: value, sessionId: null })).toBe('mismatch');
    expect(await shadowMarkerMatch({ ...base, marker: value, secret: null })).toBe('mismatch');
  });
});
