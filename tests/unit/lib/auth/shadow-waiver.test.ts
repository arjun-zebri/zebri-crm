// @vitest-environment node
/**
 * The two-factor waiver for shadow sessions (Phase 4, Task 23), built on
 * the hotfix's grant (`shadow-grant.test.ts` covers signing itself).
 *
 * The bare `zebri_shadow_admin_id` cookie can be forged by anyone who
 * knows an admin's id. Nothing short of a grant signed with the server
 * key, for this exact admin and target, in date, from a still-current
 * admin, may waive a second factor. Refusals use the same closed reasons
 * as the `admin_shadow_exit_refused` alert.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  evaluateShadowGrant,
  type ShadowAdminStatus,
  shadowWaiverApplies,
  signShadowGrant,
} from '@/lib/auth/shadow-grant';

const SECRET = 'unit-test-service-role-key';
const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const NOW = 1_800_000_000_000;

async function grant(adminId = ADMIN, targetUserId = TARGET, expiresAt = NOW + 60_000) {
  return signShadowGrant({ adminId, targetUserId, expiresAt }, SECRET);
}

function input(overrides: Partial<Parameters<typeof evaluateShadowGrant>[0]> = {}) {
  return {
    claimedAdminId: ADMIN,
    grant: undefined as string | undefined,
    sessionUserId: TARGET,
    now: NOW,
    secret: SECRET,
    adminStatus: vi.fn(async (): Promise<ShadowAdminStatus> => 'admin'),
    ...overrides,
  };
}

describe('evaluateShadowGrant', () => {
  it('accepts a grant for this admin and target from a current admin', async () => {
    const i = input({ grant: await grant() });
    expect(await evaluateShadowGrant(i)).toEqual({ ok: true, adminId: ADMIN });
    expect(i.adminStatus).toHaveBeenCalledWith(ADMIN);
  });

  it.each([
    ['no_session', async () => input({ sessionUserId: null, grant: await grant() })],
    ['invalid_grant', async () => input()],
    ['invalid_grant', async () => input({ grant: await grant(), secret: null })],
    ['invalid_grant', async () => input({ grant: await grant(ADMIN, TARGET, NOW - 1) })],
    ['invalid_grant', async () => input({ grant: await signShadowGrant({ adminId: ADMIN, targetUserId: TARGET, expiresAt: NOW + 60_000 }, 'other-key') })],
    ['invalid_grant', async () => input({ claimedAdminId: TARGET, grant: await grant(TARGET, TARGET) })],
    ['target_mismatch', async () => input({ grant: await grant(ADMIN, OTHER) })],
    ['admin_cookie_mismatch', async () => input({ claimedAdminId: OTHER, grant: await grant() })],
    ['admin_cookie_mismatch', async () => input({ claimedAdminId: undefined, grant: await grant() })],
  ] as const)('refuses with %s', async (reason, make) => {
    const i = await make();
    expect(await evaluateShadowGrant(i)).toEqual({ ok: false, reason });
    // A forged or mismatched cookie never costs an Auth lookup.
    expect(i.adminStatus).not.toHaveBeenCalled();
  });

  it('refuses a demoted admin and a failed lookup, with distinct reasons', async () => {
    const g = await grant();
    expect(await evaluateShadowGrant(input({ grant: g, adminStatus: async () => 'not_admin' }))).toEqual({
      ok: false,
      reason: 'not_admin',
    });
    expect(await evaluateShadowGrant(input({ grant: g, adminStatus: async () => 'lookup_failed' }))).toEqual({
      ok: false,
      reason: 'admin_lookup_failed',
    });
  });

  it('shadowWaiverApplies is the boolean of the same decision', async () => {
    expect(await shadowWaiverApplies(input({ grant: await grant() }))).toBe(true);
    expect(await shadowWaiverApplies(input())).toBe(false);
  });
});
