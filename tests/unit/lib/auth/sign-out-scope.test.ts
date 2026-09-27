/**
 * `signOutScope` (Phase 4 review, I1): a browser sign-out inside a shadow
 * session is local, so support never signs the MC out of their own
 * devices; an MC signing themselves out keeps the global default.
 */
import { describe, expect, it } from 'vitest';

import { signOutScope } from '@/lib/auth/sign-out-scope';

describe('signOutScope', () => {
  it('is local while the shadow flag is set', () => {
    expect(signOutScope('zebri_is_shadowing=1')).toBe('local');
    expect(signOutScope('a=b; zebri_is_shadowing=1; c=d')).toBe('local');
  });

  it('is global otherwise', () => {
    expect(signOutScope('')).toBe('global');
    expect(signOutScope('a=b; c=d')).toBe('global');
    expect(signOutScope('zebri_is_shadowing=0')).toBe('global');
    expect(signOutScope('xzebri_is_shadowing=1')).toBe('global');
  });
});

describe('signOutScope cookie name', () => {
  it('matches the flag enterShadow sets', async () => {
    const { SHADOW_FLAG_COOKIE } = await import('@/lib/auth/shadow-grant');
    expect(signOutScope(`${SHADOW_FLAG_COOKIE}=1`)).toBe('local');
  });
});
