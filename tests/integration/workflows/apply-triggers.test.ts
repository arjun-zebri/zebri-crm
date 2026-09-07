import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The three DB triggers behind the apply rules, plus the default-instance
 * invariant.
 *
 * These run inside the couple's own transaction, so they are the part of
 * the engine that cannot be retried or repaired application-side. Their
 * edge cases (no-op updates, clearing a value, a date moving) are the
 * ones worth pinning.
 */
describe('workflow apply-rule triggers', () => {
  const admin = serviceClient();
  let user: TestUser;
  let packageAId: string;
  let packageBId: string;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    const { data: pkgs, error } = await user.client
      .from('packages')
      .insert([
        { user_id: user.id, name: 'Gold' },
        { user_id: user.id, name: 'Silver' },
      ])
      .select('id, name');
    expect(error).toBeNull();
    packageAId = pkgs!.find((p) => p.name === 'Gold')!.id;
    packageBId = pkgs!.find((p) => p.name === 'Silver')!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  async function newCouple(name: string): Promise<string> {
    const { data, error } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  async function packageEvents(coupleId: string) {
    const { data } = await admin
      .from('automation_events')
      .select('event_type, payload')
      .eq('couple_id', coupleId)
      .eq('event_type', 'package_applied');
    return data ?? [];
  }

  it('creates exactly one default instance when a couple is inserted', async () => {
    const coupleId = await newCouple('Default Instance');
    const { data } = await admin
      .from('workflow_instances')
      .select('name, is_default, template_id, couple_id')
      .eq('couple_id', coupleId);
    expect(data).toHaveLength(1);
    expect(data![0]!.is_default).toBe(true);
    expect(data![0]!.name).toBe('General');
    expect(data![0]!.template_id).toBeNull();
  });

  it('still emits new_enquiry on couple insert, and adds no duplicate event', async () => {
    // on_couple_created matches the EXISTING new_enquiry slug. Emitting a
    // second couple-created event would double-fire anything listening.
    const coupleId = await newCouple('Enquiry Emit');
    const { data } = await admin
      .from('automation_events')
      .select('event_type')
      .eq('couple_id', coupleId);
    const types = (data ?? []).map((e) => e.event_type);
    expect(types.filter((t) => t === 'new_enquiry')).toHaveLength(1);
    expect(types).not.toContain('couple_created');
  });

  it('emits package_applied when selected_package_id goes null to set', async () => {
    const coupleId = await newCouple('Package Null To Set');
    await user.client
      .from('couples')
      .update({ selected_package_id: packageAId })
      .eq('id', coupleId);

    const events = await packageEvents(coupleId);
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as Record<string, unknown>).package_id).toBe(packageAId);
  });

  it('emits again when the package changes to a different one', async () => {
    const coupleId = await newCouple('Package Change');
    await user.client.from('couples').update({ selected_package_id: packageAId }).eq('id', coupleId);
    await user.client.from('couples').update({ selected_package_id: packageBId }).eq('id', coupleId);

    const events = await packageEvents(coupleId);
    expect(events).toHaveLength(2);
    expect(
      events.map((e) => (e.payload as Record<string, unknown>).package_id).sort(),
    ).toEqual([packageAId, packageBId].sort());
  });

  it('does not re-emit when the package is set to the same value', async () => {
    // `is distinct from` is what makes a no-op update silent. Without it
    // every save on the couple profile would re-fire the workflow.
    const coupleId = await newCouple('Package No-op');
    await user.client.from('couples').update({ selected_package_id: packageAId }).eq('id', coupleId);
    await user.client.from('couples').update({ selected_package_id: packageAId }).eq('id', coupleId);

    expect(await packageEvents(coupleId)).toHaveLength(1);
  });

  it('does not emit when the package is cleared back to null', async () => {
    const coupleId = await newCouple('Package Cleared');
    await user.client.from('couples').update({ selected_package_id: packageAId }).eq('id', coupleId);
    await user.client.from('couples').update({ selected_package_id: null }).eq('id', coupleId);

    expect(await packageEvents(coupleId)).toHaveLength(1);
  });

  it('recomputes wedding_relative steps when the event date moves, and leaves the others alone', async () => {
    const coupleId = await newCouple('Date Move');
    const { data: evt, error: evtErr } = await user.client
      .from('events')
      .insert({ user_id: user.id, couple_id: coupleId, date: '2026-11-14', title: 'Wedding' })
      .select('id')
      .single();
    expect(evtErr).toBeNull();

    const { data: inst } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', coupleId)
      .single();

    const { error: stepErr } = await admin.from('workflow_steps').insert([
      {
        instance_id: inst!.id, position: 0, type: 'todo', title: 'Wedding anchored',
        timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
        due_at: '2026-10-30T13:00:00.000Z', status: 'pending',
      },
      {
        instance_id: inst!.id, position: 1, type: 'todo', title: 'Apply anchored',
        timing: { mode: 'apply_relative', amount: 3, unit: 'days' },
        due_at: '2026-09-07T14:00:00.000Z', status: 'pending',
      },
      {
        instance_id: inst!.id, position: 2, type: 'todo', title: 'Already done',
        timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'weeks' },
        due_at: '2026-11-06T13:00:00.000Z', status: 'done',
      },
    ]);
    expect(stepErr).toBeNull();

    // Move the wedding back a week.
    await user.client.from('events').update({ date: '2026-11-21' }).eq('id', evt!.id);

    const { data: after } = await admin
      .from('workflow_steps')
      .select('title, due_at')
      .eq('instance_id', inst!.id);
    const byTitle = Object.fromEntries(after!.map((s) => [s.title, s.due_at]));

    // 2026-11-07 00:00 Sydney (AEDT, UTC+11) = 2026-11-06T13:00Z.
    expect(byTitle['Wedding anchored']).toBe('2026-11-06T13:00:00+00:00');
    // apply_relative is not anchored to the wedding, so it must not move.
    expect(byTitle['Apply anchored']).toBe('2026-09-07T14:00:00+00:00');
    // A done step's due_at is history and must not be rewritten.
    expect(byTitle['Already done']).toBe('2026-11-06T13:00:00+00:00');
  });

  it('recomputes when an earlier event is added, because that moves the anchor', async () => {
    const coupleId = await newCouple('Earlier Event');
    const { error: firstEvtErr } = await user.client
      .from('events')
      .insert({ user_id: user.id, couple_id: coupleId, date: '2026-12-01', title: 'Wedding' });
    expect(firstEvtErr).toBeNull();

    const { data: inst } = await admin
      .from('workflow_instances').select('id').eq('couple_id', coupleId).single();
    await admin.from('workflow_steps').insert({
      instance_id: inst!.id, position: 0, type: 'todo', title: 'Anchored',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'weeks' },
      status: 'pending',
    });

    // Adding an EARLIER event changes which row is the primary event.
    const { error: secondEvtErr } = await user.client
      .from('events')
      .insert({ user_id: user.id, couple_id: coupleId, date: '2026-11-01', title: 'Rehearsal' });
    expect(secondEvtErr).toBeNull();

    const { data: after } = await admin
      .from('workflow_steps').select('due_at').eq('instance_id', inst!.id).single();
    // 2026-10-25 00:00 Sydney (AEDT) = 2026-10-24T13:00Z.
    expect(after!.due_at).toBe('2026-10-24T13:00:00+00:00');
  });

  it('ensure_default_workflow is idempotent', async () => {
    const coupleId = await newCouple('Ensure Default');
    const { data: first } = await user.client.rpc('ensure_default_workflow', {
      p_couple_id: coupleId,
    });
    const { data: second } = await user.client.rpc('ensure_default_workflow', {
      p_couple_id: coupleId,
    });
    expect(first).toBe(second);
    const { data } = await admin
      .from('workflow_instances').select('id').eq('couple_id', coupleId);
    expect(data).toHaveLength(1);
  });

  it('ensure_default_workflow returns null for another tenant’s couple', async () => {
    // security invoker means the caller's RLS hides the couple, so no
    // instance can be conjured on it.
    const coupleId = await newCouple('Victim');
    const attacker = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    try {
      const { data } = await attacker.client.rpc('ensure_default_workflow', {
        p_couple_id: coupleId,
      });
      expect(data).toBeNull();
    } finally {
      await attacker.cleanup();
    }
  });
});
