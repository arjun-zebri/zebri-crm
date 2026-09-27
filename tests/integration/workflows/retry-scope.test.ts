/**
 * Retry must stay scoped to the one step it was given.
 *
 * Two things are pinned here, deliberately kept apart:
 *
 * - `runStepNow` itself, which was already correctly scoped before this
 *   task. That test cannot fail against the pre-fix code: it exercises
 *   the executor primitive directly, never the call site that leaked.
 *   Kept because it documents `runStepNow`'s own contract, not because
 *   it is proof of anything about the action.
 * - `retryStepAction`, the actual regression test for this task. The
 *   bug lived in the action calling `advanceDueSteps(admin)` with no
 *   owner, an unscoped service-role sweep that ran every tenant's due
 *   steps inside one MC's "Try again" click. This test calls the real
 *   exported server action, through the same mocked `createClient`
 *   swap the rest of this suite uses to simulate two signed-in tenants,
 *   and asserts a second tenant's untouched, unrelated due step is left
 *   alone. If `retryStepAction` is ever changed back to call an
 *   unscoped sweep instead of `runStepNow(admin, stepId)`, this is the
 *   test that catches it. Do not delete it as a duplicate of the
 *   `runStepNow` test above: the two are not equivalent, and only this
 *   one was red before the fix (see `.superpowers/sdd/
 *   2026-09-23-workflows-trust-remediation/task-7-report.md` for the
 *   recorded failure output).
 *
 * @module tests/integration/workflows/retry-scope
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { runStepNow } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

// `retryStepAction` is a Next server action: it calls `revalidatePath`,
// which needs a request store vitest has no way to provide, and it
// reads the caller through `createClient()` from `lib/supabase/server`.
// Both are stubbed the same way the rest of the instance-actions suite
// stubs them, so the action runs for real against local Supabase and
// only its two Next-specific seams are faked. `activeUser` is swapped
// between tenants to simulate two different signed-in MCs calling the
// same action.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first');
    return activeUser.client;
  }),
}));

// eslint-disable-next-line import/order
import { retryStepAction } from '@/app/(dashboard)/workflows/instance-actions';

const admin = serviceClient();
const PAST = '2026-01-01T00:00:00.000Z';

/** One tenant's manual retry must not touch another tenant's queue. */
describe('retry scope', () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    const entitlements = {
      account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro',
    };
    alice = await createTestUser({}, entitlements);
    bob = await createTestUser({}, entitlements);
  });

  afterEach(() => {
    activeUser = null;
  });

  afterAll(async () => {
    await alice?.cleanup();
    await bob?.cleanup();
  });

  async function dueStep(user: TestUser, status: string): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Scope Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Scope Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'x' },
        status,
        due_at: PAST,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('runStepNow runs only the step it was given', async () => {
    const aliceStep = await dueStep(alice, 'pending');
    const bobStep = await dueStep(bob, 'pending');

    await runStepNow(admin, aliceStep);

    const { data: bobAfter } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', bobStep)
      .single();
    expect(bobAfter!.status).toBe('pending');
  });

  it("retryStepAction does not run another tenant's due step", async () => {
    // Alice's step is the one being retried: errored, so the retry gate
    // (`.eq('status', 'errored')`) accepts it.
    const aliceStep = await dueStep(alice, 'errored');
    // Bob's step is untouched and unrelated: pending, and also due in
    // the past. Before this task, `retryStepAction` called
    // `advanceDueSteps(admin)` with no owner scope, which would run
    // every due step in the table, Bob's included, moving it from
    // pending to done as a side effect of Alice pressing "Try again".
    const bobStep = await dueStep(bob, 'pending');

    activeUser = alice;
    const res = await retryStepAction({ stepId: aliceStep });
    expect(res.ok).toBe(true);

    const { data: bobAfter } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', bobStep)
      .single();
    expect(bobAfter!.status).toBe('pending');
  });
});
