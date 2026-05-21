/**
 * Phase 1 — 5-couple cap enforcement.
 *
 * The `enforce_starter_couple_limit` Postgres trigger fires before
 * any INSERT into `public.couples`. It blocks the insert when the
 * owning user is on Starter (free) AND already has 5 rows.
 *
 * These tests prove the cap fires for Starter, doesn't fire for
 * Pro/Max, and respects the §7.4 app_metadata model (a user can't
 * set `subscription_plan='pro'` in user_metadata to escape the cap).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { userInState } from '../helpers/billing-states';
import { type TestUser } from '../helpers/supabase';

let user: TestUser;
afterEach(async () => {
  await user?.cleanup();
});

/** Insert N couples directly as the test user. Returns the first error encountered. */
async function insertN(u: TestUser, n: number) {
  for (let i = 0; i < n; i++) {
    const { error } = await u.client.from('couples').insert({
      name: `Couple ${i + 1}`,
      user_id: u.id,
    });
    if (error) return { inserted: i, error };
  }
  return { inserted: n, error: null };
}

describe('5-couple cap — Starter users', () => {
  it('Starter user can add 5 couples; the 6th is blocked by STARTER_COUPLE_LIMIT', async () => {
    user = await userInState('never_trialled');
    const r1 = await insertN(user, 5);
    expect(r1.error).toBeNull();
    expect(r1.inserted).toBe(5);

    const sixth = await user.client.from('couples').insert({
      name: 'Sixth',
      user_id: user.id,
    });
    expect(sixth.error).not.toBeNull();
    expect(sixth.error?.message ?? '').toMatch(/STARTER_COUPLE_LIMIT/);
  });

  it('Starter user with 4 couples can add a 5th', async () => {
    user = await userInState('never_trialled');
    const r1 = await insertN(user, 4);
    expect(r1.inserted).toBe(4);
    const fifth = await user.client.from('couples').insert({ name: 'Fifth', user_id: user.id });
    expect(fifth.error).toBeNull();
  });

  it('Trial-expired user is treated as Starter (status=trialing but trial_end past) — cap is enforced by current SQL by status only, so still gets cap-free during trialing', async () => {
    // The SQL function checks status in ('active','trialing') — date is
    // not consulted, so a trial that has expired but status hasn't been
    // flipped yet still bypasses the cap. Stripe webhook flipping the
    // status is Phase 2's job. Documenting current behaviour:
    user = await userInState('trial_expired', { plan: 'pro' });
    const r = await insertN(user, 10);
    expect(r.error).toBeNull();
    expect(r.inserted).toBe(10);
  });
});

describe('5-couple cap — paid users are uncapped', () => {
  it('Pro user can add 10+ couples', async () => {
    user = await userInState('active', { plan: 'pro' });
    const r = await insertN(user, 10);
    expect(r.error).toBeNull();
    expect(r.inserted).toBe(10);
  });

  it('Max user can add 10+ couples', async () => {
    user = await userInState('active', { plan: 'max' });
    const r = await insertN(user, 10);
    expect(r.error).toBeNull();
    expect(r.inserted).toBe(10);
  });

  it('Trialing Pro user can add 10+ couples (trial bypasses the cap)', async () => {
    user = await userInState('trialing', { plan: 'pro' });
    const r = await insertN(user, 10);
    expect(r.error).toBeNull();
    expect(r.inserted).toBe(10);
  });

  it('Comped user can add 10+ couples', async () => {
    user = await userInState('comped', { plan: 'pro' });
    const r = await insertN(user, 10);
    expect(r.error).toBeNull();
    expect(r.inserted).toBe(10);
  });
});

describe('5-couple cap — §7.4 escalation block', () => {
  it('user setting subscription_plan="pro" in user_metadata does NOT bypass the cap', async () => {
    // Vendor user, no paid app_metadata. Attacker tries to bypass via
    // the user-writable user_metadata.
    user = await userInState('never_trialled');
    await user.client.auth.updateUser({
      data: { subscription_status: 'active', subscription_plan: 'pro', is_subscribed: true },
    });

    const r1 = await insertN(user, 5);
    expect(r1.inserted).toBe(5);
    const sixth = await user.client.from('couples').insert({
      name: 'Bypass attempt',
      user_id: user.id,
    });
    expect(sixth.error).not.toBeNull();
    expect(sixth.error?.message ?? '').toMatch(/STARTER_COUPLE_LIMIT/);
  });
});

describe('5-couple cap — past_due users', () => {
  it('Past-due user is treated as Starter (status not in active|trialing) — cap fires', async () => {
    user = await userInState('past_due', { plan: 'pro' });
    const r1 = await insertN(user, 5);
    expect(r1.inserted).toBe(5);
    const sixth = await user.client.from('couples').insert({
      name: 'After past_due',
      user_id: user.id,
    });
    expect(sixth.error).not.toBeNull();
    expect(sixth.error?.message ?? '').toMatch(/STARTER_COUPLE_LIMIT/);
  });

  it('Expired user is treated as Starter — cap fires', async () => {
    user = await userInState('expired');
    const r1 = await insertN(user, 5);
    expect(r1.inserted).toBe(5);
    const sixth = await user.client.from('couples').insert({
      name: 'After expired',
      user_id: user.id,
    });
    expect(sixth.error).not.toBeNull();
    expect(sixth.error?.message ?? '').toMatch(/STARTER_COUPLE_LIMIT/);
  });
});
