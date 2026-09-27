// @vitest-environment node
/**
 * The two-factor gate in `middleware.ts` (Phase 4, Task 23).
 *
 * A user with a verified TOTP factor whose session is still aal1 (password
 * only) must not reach a dashboard page or API route. The gate reads the
 * factor list from the server-validated user and the level from the access
 * token, so the stubs below hand the middleware exactly those two things.
 * The shadow cases pin that a bare admin-id cookie waives nothing, and a
 * signed grant from a still-current admin does.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = '11111111-1111-1111-1111-111111111111';
const MC = '22222222-2222-2222-2222-222222222222';
const SECRET = 'service-role-key-for-tests';
// JWT session_id of the shadow session, and the marker enterShadow sets.
const SID = '44444444-4444-4444-8444-444444444444';
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';

const world = vi.hoisted(() => ({
  factors: [] as Array<{ status: string; factor_type: string }>,
  aal: 'aal1',
  adminIsAdmin: true,
  status: 'active',
}));

function token(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: MC,
            app_metadata: { account_type: 'vendor', subscription_status: world.status },
            factors: world.factors,
          },
        },
      }),
      getSession: async () => ({ data: { session: { access_token: token({ sub: MC, aal: world.aal, session_id: SID }) } } }),
    },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: {
            user: {
              id,
              app_metadata: { account_type: world.adminIsAdmin ? 'admin' : 'vendor' },
            },
          },
          error: null,
        }),
      },
    },
  }),
}));

import { signShadowGrant, signShadowMarker } from '@/lib/auth/shadow-grant';
import { middleware } from '@/middleware';

async function run(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(`https://app.zebri.test${path}`);
  for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v);
  const res = await middleware(req);
  const location = res.headers.get('location');
  return { status: res.status, location: location ? new URL(location) : null };
}

beforeEach(() => {
  world.factors = [{ status: 'verified', factor_type: 'totp' }];
  world.aal = 'aal1';
  world.adminIsAdmin = true;
  world.status = 'active';
});

describe('middleware two-factor gate', () => {
  it('sends an aal1 session of a 2FA user to the code screen, keeping where they were going', async () => {
    const { location } = await run('/couples?tab=list');
    expect(location?.pathname).toBe('/login/mfa');
    expect(location?.searchParams.get('next')).toBe('/couples?tab=list');
  });

  it('answers an API call with 401 instead of a redirect', async () => {
    expect((await run('/api/couples')).status).toBe(401);
  });

  it('lets the same user through once the session is aal2', async () => {
    world.aal = 'aal2';
    expect((await run('/couples')).location).toBeNull();
  });

  it('does not gate a user without a verified factor', async () => {
    world.factors = [{ status: 'unverified', factor_type: 'totp' }];
    expect((await run('/couples')).location).toBeNull();
  });

  it('leaves the code screen itself reachable', async () => {
    expect((await run('/login/mfa')).location).toBeNull();
  });

  it('does not waive for a hand-set admin-id cookie without a grant', async () => {
    const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN });
    expect(location?.pathname).toBe('/login/mfa');
  });

  // Review M1 / N1: the waiver needs a marker this server signed for this
  // very session. The session id alone is readable by whoever holds the
  // session, so an unsigned or forged marker equal to it waives nothing.
  it('waives for a live grant plus a marker signed for this session', async () => {
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    const marker = await signShadowMarker({ sessionId: SID, targetUserId: MC }, SECRET);
    const res = await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant, zebri_shadow_session: marker });
    expect(res.location).toBeNull();
  });

  it('does not waive a forged marker that equals this session id (the M1 thief)', async () => {
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    for (const forged of [
      SID,
      `v1.${SID}.${MC}.${'0'.repeat(64)}`,
      await signShadowMarker({ sessionId: SID, targetUserId: MC }, 'another-servers-key'),
    ]) {
      const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant, zebri_shadow_session: forged });
      expect(location?.pathname, forged).toBe('/login/mfa');
    }
  });

  it('does not waive a marker with a tampered signature', async () => {
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    const good = await signShadowMarker({ sessionId: SID, targetUserId: MC }, SECRET);
    const tampered = `${good.slice(0, -1)}${good.endsWith('0') ? '1' : '0'}`;
    const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant, zebri_shadow_session: tampered });
    expect(location?.pathname).toBe('/login/mfa');
  });

  it('does not waive a correctly signed marker for another target', async () => {
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    const other = await signShadowMarker({ sessionId: SID, targetUserId: '33333333-3333-3333-3333-333333333333' }, SECRET);
    const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant, zebri_shadow_session: other });
    expect(location?.pathname).toBe('/login/mfa');
  });

  it('does not waive a valid grant without the session marker', async () => {
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant });
    expect(location?.pathname).toBe('/login/mfa');
  });

  it('does not waive a signed marker that names another session', async () => {
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    const marker = await signShadowMarker({ sessionId: '55555555-5555-4555-8555-555555555555', targetUserId: MC }, SECRET);
    const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant, zebri_shadow_session: marker });
    expect(location?.pathname).toBe('/login/mfa');
  });

  it('does not waive when the grant names an admin who has since been demoted', async () => {
    world.adminIsAdmin = false;
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant });
    expect(location?.pathname).toBe('/login/mfa');
  });
});

// Task 23 review, I2: the past-due paywall skip used to trust the bare
// admin-id cookie, which any MC can set from devtools.
describe('middleware past-due paywall and shadow mode', () => {
  beforeEach(() => {
    world.factors = [];
    world.status = 'past_due';
  });

  it('sends a past-due MC to billing', async () => {
    expect((await run('/couples')).location?.pathname).toBe('/settings');
  });

  it('still sends them to billing with a hand-set admin-id cookie and no grant', async () => {
    const { location } = await run('/couples', { zebri_shadow_admin_id: ADMIN });
    expect(location?.pathname).toBe('/settings');
    expect(location?.searchParams.get('tab')).toBe('billing');
  });

  it('lets a verified shadow session through (a real admin looking at the account)', async () => {
    const grant = await signShadowGrant({ adminId: ADMIN, targetUserId: MC, expiresAt: Date.now() + 60_000 }, SECRET);
    expect((await run('/couples', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: grant })).location).toBeNull();
  });
});
