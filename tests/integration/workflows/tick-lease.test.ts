import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The lease stops two overlapping ticks racing for every due step. It
 * has to do that without also stopping the next minute's tick, so it is
 * released at the end of a run and only expires for a run that died.
 */
describe('scheduler lease', () => {
  const admin = serviceClient();
  let user: TestUser;

  /** The real tick's settings: twice the 45-second budget. */
  const TTL = 120;

  beforeAll(async () => {
    user = await createTestUser();
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('grants to the first caller and refuses the second', async () => {
    const name = `test-lease-${Date.now()}`;

    const first = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: randomUUID(),
    });
    const second = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: randomUUID(),
    });

    expect(first.data).toBe(true);
    expect(second.data).toBe(false);
  });

  /**
   * The cadence the scheduler actually runs at, which is the case a
   * pair of back-to-back acquires does not model: pg_cron fires every
   * 60 seconds and the TTL is 120, so a tick that finishes without
   * releasing refuses the next minute's tick on a completely healthy
   * system, and the schedule silently becomes two-minute.
   */
  it('lets the next minute tick in once the previous run has finished', async () => {
    const name = `test-lease-cadence-${Date.now()}`;
    const firstTick = randomUUID();
    const secondTick = randomUUID();

    const first = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: firstTick,
    });
    expect(first.data).toBe(true);

    const released = await admin.rpc('release_scheduler_lease', {
      p_name: name,
      p_token: firstTick,
    });
    expect(released.data).toBe(true);

    const second = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: secondTick,
    });
    expect(second.data).toBe(true);
  });

  /**
   * A tick that was refused the lease still reaches the end of its
   * request. It must not be able to hand back a hold it never had, or
   * the run that is genuinely working would lose its protection to the
   * one that did nothing.
   */
  it('refuses to release a lease held by another run', async () => {
    const name = `test-lease-foreign-${Date.now()}`;
    const holder = randomUUID();
    const loser = randomUUID();

    await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: holder,
    });
    const refused = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: loser,
    });
    expect(refused.data).toBe(false);

    const strayRelease = await admin.rpc('release_scheduler_lease', {
      p_name: name,
      p_token: loser,
    });
    expect(strayRelease.data).toBe(false);

    // Still held by the run that took it.
    const third = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: randomUUID(),
    });
    expect(third.data).toBe(false);
  });

  it('grants again once the lease has expired', async () => {
    const name = `test-lease-expiry-${Date.now()}`;

    await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: 0,
      p_token: randomUUID(),
    });
    const again = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: randomUUID(),
    });

    expect(again.data).toBe(true);
  });

  /**
   * The expiry path's own hazard: a run whose lease ran out mid-flight
   * comes back to release, by which time its successor is holding the
   * lease. The token is what stops it taking the successor's protection
   * away.
   */
  it('a run whose lease expired cannot release its successor', async () => {
    const name = `test-lease-late-${Date.now()}`;
    const dead = randomUUID();
    const successor = randomUUID();

    await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: 0,
      p_token: dead,
    });
    const took = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: successor,
    });
    expect(took.data).toBe(true);

    const lateRelease = await admin.rpc('release_scheduler_lease', {
      p_name: name,
      p_token: dead,
    });
    expect(lateRelease.data).toBe(false);

    const stillHeld = await admin.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: randomUUID(),
    });
    expect(stillHeld.data).toBe(false);
  });

  // Pins the grant, not just the WHERE clause. The earlier revoke draft
  // dropped `public` alone, which reads as safe but leaves `anon` and
  // `authenticated` still holding EXECUTE on Supabase's default schema
  // privileges (they are granted directly at function-creation time, not
  // inherited through the PUBLIC pseudo-role). This is the same shape as
  // the audit's other critical finding, a scheduler function callable by
  // signed-in users, so it is pinned the same way `scheduler.test.ts`
  // pins `tick_watchdog` and the other service-role-only functions: call
  // it through a real client for that role and assert Postgres itself
  // refuses it, rather than trusting a one-time manual grant check.
  it('cannot be called by an authenticated or anonymous client', async () => {
    const name = `test-lease-privilege-${Date.now()}`;
    const token = randomUUID();

    const authed = await user.client.rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: token,
    });
    expect(authed.error?.message).toMatch(/permission denied/);

    const anon = await anonClient().rpc('acquire_scheduler_lease', {
      p_name: name,
      p_ttl_seconds: TTL,
      p_token: token,
    });
    expect(anon.error?.message).toMatch(/permission denied/);

    // The release is a scheduler function too, and releasing somebody
    // else's lease is as damaging as taking it.
    const authedRelease = await user.client.rpc('release_scheduler_lease', {
      p_name: name,
      p_token: token,
    });
    expect(authedRelease.error?.message).toMatch(/permission denied/);

    const anonRelease = await anonClient().rpc('release_scheduler_lease', {
      p_name: name,
      p_token: token,
    });
    expect(anonRelease.error?.message).toMatch(/permission denied/);
  });
});
