import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { sendAlert } from '@/lib/alerts/send-alert';
import { stepOverdueEmitter } from '@/lib/workflows/emitters/step-overdue';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

// Mocked so the truncation test below can assert on which alerts fired
// and with what payload, not just that the app didn't throw. Every
// other test in this file only exercises code paths where sendAlert is
// never called, so the swap changes nothing for them; sendAlert's own
// local-run suppression already turns every real call in this suite
// into a no-op.
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

/**
 * The `step_overdue` emitter, which replaces the retired `task_overdue`.
 *
 * The property that matters most is the day-bucket dedupe: without it the
 * emitter re-fires on every tick, which on a minute-grain cron would mean
 * 1440 events a day per overdue step.
 */
describe('stepOverdueEmitter', () => {
  const admin = serviceClient();
  let user: TestUser;
  let coupleId: string;
  let instanceId: string;

  const PAST = '2026-01-01T00:00:00.000Z';
  const FUTURE = '2099-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Overdue Couple' })
      .select('id')
      .single();
    coupleId = couple!.id;
    const { data: inst } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', coupleId)
      .single();
    instanceId = inst!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  async function addStep(over: Record<string, unknown>): Promise<string> {
    const { data, error } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instanceId,
        position: 0,
        type: 'todo',
        title: 'Overdue thing',
        config: {},
        status: 'pending',
        ...over,
      } as never)
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  async function eventsFor(stepId: string) {
    const { data } = await admin
      .from('automation_events')
      .select('payload')
      .eq('event_type', 'step_overdue')
      .eq('source_id', stepId);
    return data ?? [];
  }

  it('emits once for an overdue pending to-do, with a useful payload', async () => {
    const stepId = await addStep({ due_at: PAST });
    await stepOverdueEmitter.run(admin);

    const events = await eventsFor(stepId);
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.step_id).toBe(stepId);
    expect(payload.instance_id).toBe(instanceId);
    expect(payload.couple_id).toBe(coupleId);
    expect(payload.step_type).toBe('todo');
    expect(Number(payload.days_overdue)).toBeGreaterThan(0);
  });

  it('does not re-emit on a second run the same day', async () => {
    const stepId = await addStep({ due_at: PAST });
    await stepOverdueEmitter.run(admin);
    await stepOverdueEmitter.run(admin);
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(stepId)).toHaveLength(1);
  });

  it('ignores a step that is not yet due', async () => {
    const stepId = await addStep({ due_at: FUTURE });
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(stepId)).toHaveLength(0);
  });

  it('ignores a step that is already done or skipped', async () => {
    const doneId = await addStep({ due_at: PAST, status: 'done' });
    const skippedId = await addStep({ due_at: PAST, status: 'skipped' });
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(doneId)).toHaveLength(0);
    expect(await eventsFor(skippedId)).toHaveLength(0);
  });

  it('ignores automated steps, which are the engine’s problem not the MC’s', async () => {
    const stepId = await addStep({ due_at: PAST, type: 'action', config: { actionType: 'add_note' } });
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(stepId)).toHaveLength(0);
  });

  it('processes every overdue step past the page size, not an arbitrary slice', async () => {
    // Mirrors PAGE_SIZE in lib/workflows/emitters/step-overdue.ts. Not
    // imported: this task adds no new exports, so a page size that moves
    // later must be kept in step here by hand.
    const EMITTER_PAGE_SIZE = 500;
    const total = EMITTER_PAGE_SIZE + 10;
    const rows = Array.from({ length: total }, (_, i) => ({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: `Overflow thing ${i}`,
      config: {},
      status: 'pending',
      due_at: PAST,
    }));
    const { data, error } = await admin.from('workflow_steps').insert(rows as never).select('id');
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.id);
    expect(ids).toHaveLength(total);

    await stepOverdueEmitter.run(admin);

    // A single capped read returns an arbitrary 500 of these, so neither
    // "first inserted" nor "last inserted" is guaranteed a spot in it.
    // Both must have an event once the emitter pages through the lot.
    expect(await eventsFor(ids[0]!)).toHaveLength(1);
    expect(await eventsFor(ids[ids.length - 1]!)).toHaveLength(1);
  });

  it('does not double-emit across two runs when a full page needs deduping', async () => {
    // Mirrors PAGE_SIZE in lib/workflows/emitters/step-overdue.ts. Not
    // imported: this task adds no new exports, so a page size that moves
    // later must be kept in step here by hand.
    const EMITTER_PAGE_SIZE = 500;
    // Mirrors DEDUPE_BATCH_SIZE. Verification below batches by this same
    // amount, for the same reason the emitter does: a single `.in(...)`
    // over all 500 ids would hit the same URL-length wall being tested.
    const VERIFY_BATCH_SIZE = 100;
    const rows = Array.from({ length: EMITTER_PAGE_SIZE }, (_, i) => ({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: `Dedupe page thing ${i}`,
      config: {},
      status: 'pending',
      due_at: PAST,
    }));
    const { data: inserted, error } = await admin
      .from('workflow_steps')
      .insert(rows as never)
      .select('id');
    expect(error).toBeNull();
    const ids = (inserted ?? []).map((row) => row.id);
    expect(ids).toHaveLength(EMITTER_PAGE_SIZE);

    // The bug under test: a full page's dedupe read passes every id from
    // the page in one `.in('source_id', ids)` filter. At page size 500
    // that URL is rejected outright (414, proven separately against the
    // running local Supabase), and the swallowed error made the second
    // run believe nothing had fired yet, so every step in the page fired
    // a second `step_overdue` event.
    await stepOverdueEmitter.run(admin);
    await stepOverdueEmitter.run(admin);

    // Scoped strictly to this test's own step ids (batched, not one
    // `.in()` over all 500) rather than a global time-window count: the
    // emitter scans every tenant's overdue steps, and the shared local
    // Supabase this suite runs against can carry other tests' or other
    // sessions' pending overdue rows at the same moment.
    let total = 0;
    for (let i = 0; i < ids.length; i += VERIFY_BATCH_SIZE) {
      const batch = ids.slice(i, i + VERIFY_BATCH_SIZE);
      const { data: events, error: countError } = await admin
        .from('automation_events')
        .select('source_id')
        .eq('event_type', 'step_overdue')
        .in('source_id', batch);
      expect(countError).toBeNull();
      total += (events ?? []).length;
    }
    expect(total).toBe(EMITTER_PAGE_SIZE);
  });

  it('narrows a truncated dedupe batch instead of abandoning it', async () => {
    // Mirrors DEDUPE_BATCH_SIZE and DEDUPE_READ_LIMIT in
    // lib/workflows/emitters/step-overdue.ts. Not imported: this task adds
    // no new exports, so a value that moves later must be kept in step
    // here by hand, the same convention as the paging tests above.
    const BATCH_SIZE = 100;
    const READ_LIMIT = 500;

    // Crafted ids, not gen_random_uuid() ones. Every uuid Postgres's
    // gen_random_uuid() produces is version 4, which always stamps '4' as
    // the first hex digit of the third group. An id whose third group
    // starts with '0' therefore sorts before every real row in the
    // table, no matter how many other overdue steps this shared local
    // database already holds. That pins this test's own ids to a
    // single, predictable dedupe batch instead of leaving batch
    // membership to chance.
    const stepId = (i: number) => `00000000-0000-0000-0000-${i.toString(16).padStart(12, '0')}`;

    // One id carries hundreds of its own events today, so its own
    // dedupe read stays over READ_LIMIT no matter how small a batch it
    // ends up sharing, all the way down to a batch of just itself. That
    // is what makes it genuinely pathological rather than merely caught
    // up in a noisy batch: splitting can rescue a neighbour, it cannot
    // rescue this one.
    const pathologicalId = stepId(0);
    const ordinaryIds = Array.from({ length: BATCH_SIZE - 1 }, (_, i) => stepId(i + 1));
    const allIds = [pathologicalId, ...ordinaryIds];
    expect(allIds).toHaveLength(BATCH_SIZE);

    const stepRows = allIds.map((id) => ({
      id,
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Overdue thing',
      config: {},
      status: 'pending',
      due_at: PAST,
    }));
    const { error: stepError } = await admin.from('workflow_steps').insert(stepRows as never);
    expect(stepError).toBeNull();

    const fillerCount = READ_LIMIT + 10;
    const fillerRows = Array.from({ length: fillerCount }, () => ({
      user_id: user.id,
      source_table: 'workflow_steps',
      source_id: pathologicalId,
      event_type: 'step_overdue',
      payload: {},
    }));
    const { error: fillerError } = await admin.from('automation_events').insert(fillerRows as never);
    expect(fillerError).toBeNull();

    vi.mocked(sendAlert).mockClear();
    await stepOverdueEmitter.run(admin);

    // Before this fix, a truncated read abandoned the whole batch: the
    // 99 ordinary ids sharing it with the pathological one got no event
    // at all today, purely for being adjacent to it. After the fix each
    // is judged on its own narrowed sub-batch and fires exactly once,
    // same as any other fresh overdue step.
    for (const id of ordinaryIds) {
      expect(await eventsFor(id)).toHaveLength(1);
    }

    // The pathological step keeps exactly the events it started with:
    // its own dedupe read is still, correctly, never trusted, so it is
    // still protected from a duplicate.
    expect(await eventsFor(pathologicalId)).toHaveLength(fillerCount);

    // The alert fires for the narrowed failure, the single pathological
    // id, never for the original batch of 100: abandoning the whole
    // batch on one noisy id is the behaviour this fix removes.
    const truncatedCalls = vi
      .mocked(sendAlert)
      .mock.calls.map(([event]) => event)
      .filter(
        (event) => event.type === 'automation_overdue_read_failed' && event.stage === 'dedupe_truncated',
      );
    expect(truncatedCalls).toHaveLength(1);
    expect(truncatedCalls[0]).toMatchObject({ count: 1 });
  });

  /**
   * The per-run ceiling is 5000 rows, each emitted by its own RPC, in a
   * pass that only starts once the executor has had its slice. Without a
   * deadline it respects, a real backlog runs the function past the
   * platform's limit and the whole tick is killed mid-pass: no
   * heartbeat, no lease released, the watchdog woken. The emitter is
   * day-granular and runs four times an hour, so stopping and picking
   * the rest up next pass costs nothing.
   */
  it('stops on the pass deadline instead of walking the whole backlog', async () => {
    const stepId = await addStep({ due_at: PAST, title: 'Deadline thing' });

    // Already past: the emitter should not start any work at all.
    const emitted = await stepOverdueEmitter.run(admin, { deadline: Date.now() - 1 });

    expect(emitted).toBe(0);
    expect(await eventsFor(stepId)).toHaveLength(0);

    // And it says so rather than returning a quiet zero, which is how a
    // workflow gated on step_overdue would silently never fire.
    const capped = vi
      .mocked(sendAlert)
      .mock.calls.map((call) => call[0])
      .filter((event) => event.type === 'automation_overdue_scan_capped');
    expect(capped).toHaveLength(1);
    expect(capped[0]).toMatchObject({ reason: 'deadline' });

    // With time to work in, the same step emits as usual.
    expect(await stepOverdueEmitter.run(admin)).toBeGreaterThanOrEqual(1);
    expect(await eventsFor(stepId)).toHaveLength(1);
  });

  it('ignores steps in a cancelled instance', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Cancelled Couple' })
      .select('id').single();
    const { data: inst } = await admin
      .from('workflow_instances').select('id').eq('couple_id', couple!.id).single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: inst!.id, position: 0, type: 'todo', title: 'Nagging',
        config: {}, status: 'pending', due_at: PAST,
      } as never)
      .select('id').single();
    await admin.from('workflow_instances').update({ status: 'cancelled' }).eq('id', inst!.id);

    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(step!.id)).toHaveLength(0);
  });
});
