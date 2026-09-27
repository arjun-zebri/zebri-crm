import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps, completeStep } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * `recomputeInstance` rewrites every non-terminal step's `due_at` from its
 * timing config whenever any step in the instance transitions. Three kinds
 * of row hold engine state in that column rather than a schedule, and all
 * three have to be excluded or the recompute overwrites the state it did
 * not write: a `running` step (covered in `executor-stuck.test.ts`,
 * alongside `sweepStuckSteps`, which is what the exclusion actually
 * protects), a `pending` step mid-retry-backoff, and a `waiting` step the
 * engine parked itself. This file is the one place that proves the latter
 * two together, since both are `recomputeInstance`-only behaviour with no
 * other moving part worth separating them by.
 */
describe('recomputeInstance exclusions', () => {
  const admin = serviceClient();
  let user: TestUser;
  const PAST = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  /**
   * The backoff lives in `due_at` and nowhere else, so anything that
   * rewrites due dates from the step's timing config erases it. The
   * recompute runs whenever any step in the instance transitions, which
   * on a real workflow is constantly: sends A and B go out together, A
   * fails and is pushed a minute out, B completes, and the recompute
   * pulls A back to its original anchor, which is in the past. The next
   * tick retries A at once, so all three attempts burn inside one or
   * two minutes rather than six and a provider having a genuinely bad
   * five minutes still buries the workflow.
   *
   * Moved here from `executor-retry.test.ts` so the three recompute
   * exclusions that are specific to `recomputeInstance` live in one
   * file; it is not duplicated there.
   */
  it('keeps the retry backoff when a sibling step completes', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Backoff Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({
        user_id: user.id,
        couple_id: couple!.id,
        name: 'Backoff Test workflow',
        applied_at: PAST,
      })
      .select('id')
      .single();
    // Default timing is `after_previous` with no delay, so the head of
    // the lane recomputes to the apply instant: PAST, and due again the
    // moment the recompute writes it.
    const { data: failing } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Send email',
        config: { actionType: 'send_email', subject: 'Hi', body: 'Hello', recipients: ['couple'] },
        status: 'pending',
        due_at: PAST,
      })
      .select('id')
      .single();
    const { data: sibling } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 1,
        type: 'todo',
        title: 'Call the venue',
        status: 'pending',
      })
      .select('id')
      .single();

    await advanceDueSteps(admin);

    const { data: afterFailure } = await admin
      .from('workflow_steps')
      .select('due_at, attempt_count')
      .eq('id', failing!.id)
      .single();
    expect(afterFailure!.attempt_count).toBe(1);
    const backoffAt = afterFailure!.due_at;
    expect(new Date(backoffAt!).getTime()).toBeGreaterThan(Date.now());

    // The MC ticks the to-do sitting beside it, which recomputes the
    // whole instance.
    await completeStep(admin, sibling!.id);

    const { data: afterRecompute } = await admin
      .from('workflow_steps')
      .select('due_at, status')
      .eq('id', failing!.id)
      .single();
    expect(afterRecompute!.due_at).toBe(backoffAt);
    expect(new Date(afterRecompute!.due_at!).getTime()).toBeGreaterThan(Date.now());
  });

  /**
   * A `waiting` row of type other than `wait` is never written by
   * anything but the sleep branch of `runOneStep`: a send parked by the
   * rate limiter, a step parked on a missing variable, or one sitting in
   * front of an MC's approval. In all three the due date is a wake time
   * the engine chose, not the step's template anchor. This step's
   * default timing (`after_previous`, no delay) recomputes to the
   * instance's `applied_at`, which is in the past and different from
   * the engine-chosen due date below, so an unguarded recompute has a
   * real new value to write, and would make the step due again on the
   * next tick: an audit row, and for the missing-variables case a
   * `automation_paused_missing_variables` Slack alert, every minute
   * until the underlying condition clears.
   */
  it('leaves an engine-parked waiting step alone when a sibling completes', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Parked Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({
        user_id: user.id,
        couple_id: couple!.id,
        name: 'Parked Test workflow',
        applied_at: PAST,
      })
      .select('id')
      .single();
    const { data: parked } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Send email',
        config: { actionType: 'send_email', subject: 'Hi', body: 'Hello', recipients: ['couple'] },
        status: 'waiting',
        due_at: '2099-01-01T00:00:00.000Z',
      })
      .select('id')
      .single();
    const { data: sibling } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 1,
        type: 'todo',
        title: 'Call the venue',
        status: 'pending',
      })
      .select('id')
      .single();

    await completeStep(admin, sibling!.id);

    const { data: afterRecompute } = await admin
      .from('workflow_steps')
      .select('due_at')
      .eq('id', parked!.id)
      .single();
    // Compared as instants, since Postgres hands the timestamp back in
    // its own format rather than the ISO string it was given.
    expect(new Date(afterRecompute!.due_at!).getTime()).toBe(
      new Date('2099-01-01T00:00:00.000Z').getTime(),
    );
  });

  /**
   * A sleeping wait owns its wake time. Its `due_at` was written by
   * `evaluateWaitAction` when it started (start plus the configured
   * duration); the template timing only says when the wait STARTS. This
   * test used to assert the opposite, that the recompute rewrites it
   * from the timing, and that was the bug: the rewrite threw the
   * duration away, so ticking any sibling to-do ended a three-day wait
   * at the next tick and sent the email behind it early. Contract
   * changed in Task 16 fix round 1. The wedding-date function keeps the
   * same rule; see `sleeping-wait.test.ts` for both paths end to end.
   */
  it('leaves a sleeping wait step on its own wake time', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Wait Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({
        user_id: user.id,
        couple_id: couple!.id,
        name: 'Wait Test workflow',
        applied_at: PAST,
      })
      .select('id')
      .single();
    const { data: waitStep } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'wait',
        title: 'Wait',
        config: {},
        status: 'waiting',
        due_at: '2099-01-01T00:00:00.000Z',
      })
      .select('id')
      .single();
    const { data: sibling } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 1,
        type: 'todo',
        title: 'Call the venue',
        status: 'pending',
      })
      .select('id')
      .single();

    await completeStep(admin, sibling!.id);

    const { data: afterRecompute } = await admin
      .from('workflow_steps')
      .select('due_at')
      .eq('id', waitStep!.id)
      .single();
    // Default timing is `after_previous` with no delay at the head of the
    // lane, which would recompute to the apply instant. It must not.
    expect(new Date(afterRecompute!.due_at!).getTime()).toBe(
      new Date('2099-01-01T00:00:00.000Z').getTime(),
    );
  });
});
