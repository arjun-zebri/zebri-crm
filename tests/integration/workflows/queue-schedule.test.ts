/**
 * Upcoming, read from real rows through the MC's own client.
 *
 * The projection rules are unit tested. What only the database can prove
 * is that the loader reads a whole instance (finished steps included) so
 * the send behind a sleeping Wait gets the Wait's end as its time, that
 * Waits are not rows, and that RLS keeps another MC's steps out.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { flattenQueue } from '@/app/(dashboard)/workflows/queue-buckets';
import { loadQueue } from '@/lib/workflows/queue';
import { loadScheduledItems } from '@/lib/workflows/queue-schedule';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };
const CHAINED = { mode: 'after_previous', delayAmount: 0, unit: 'days' };
const admin = serviceClient();

let owner: TestUser;
let other: TestUser;

beforeAll(async () => {
  owner = await createTestUser({}, PRO);
  other = await createTestUser({}, PRO);
});

afterAll(async () => {
  await owner?.cleanup();
  await other?.cleanup();
});

/** Send, wait 5 minutes (asleep), send: the owner's report, seeded. */
async function seedSendWaitSend(user: TestUser, wake: Date): Promise<string> {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name: 'Queue Couple', status: 'Enquiry' } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const { data: instance, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: (couple as { id: string }).id,
      name: 'Test flow',
      status: 'active',
    } as never)
    .select('id')
    .single();
  if (instErr) throw new Error(instErr.message);
  const instanceId = (instance as { id: string }).id;
  const base = { instance_id: instanceId, title: '', timing: CHAINED };
  const { error: stepsErr } = await admin.from('workflow_steps').insert([
    {
      ...base,
      position: 100,
      type: 'action',
      status: 'done',
      config: { actionType: 'send_email', subject: 'Email 1' },
      due_at: new Date(wake.getTime() - 300_000).toISOString(),
      completed_at: new Date(wake.getTime() - 300_000).toISOString(),
    },
    {
      ...base,
      position: 200,
      type: 'wait',
      status: 'waiting',
      config: { mode: 'duration', durationMinutes: 5 },
      due_at: wake.toISOString(),
      completed_at: null,
    },
    {
      ...base,
      position: 300,
      type: 'action',
      status: 'pending',
      config: { actionType: 'send_email', subject: 'Email 2' },
      due_at: null,
      completed_at: null,
    },
  ] as never);
  if (stepsErr) throw new Error(stepsErr.message);
  return instanceId;
}

describe('loadQueue projects sends behind a Wait', () => {
  it('shows the second email at the Wait end, and no Wait row', async () => {
    const wake = new Date(Date.now() + 5 * 60_000);
    const instanceId = await seedSendWaitSend(owner, wake);

    const all = flattenQueue(await loadQueue(owner.client, owner.id)).filter(
      (item) => item.instanceId === instanceId,
    );
    expect(all).toHaveLength(1);
    expect(all[0]?.title).toContain('Email 2');
    expect(all[0]?.dueAt).toBe(wake.toISOString());
    expect(all[0]?.gate ?? null).toBeNull();
  });

  it("never shows another MC's steps, even when asked for them by id", async () => {
    const instanceId = await seedSendWaitSend(other, new Date(Date.now() + 60_000));
    // Asked for the other MC by id, through the owner's own session: only
    // RLS stands between the owner and those rows.
    const asked = flattenQueue(await loadQueue(owner.client, other.id));
    expect(asked).toHaveLength(0);
    const own = flattenQueue(await loadQueue(owner.client, owner.id));
    expect(own.some((item) => item.instanceId === instanceId)).toBe(false);
  });

  it('holds the send behind a Wait that ends inside the template quiet hours', async () => {
    // Stored the way Postgres returns a `time` column, `HH:MM:SS`.
    const { data: tpl, error } = await admin
      .from('workflow_templates')
      .insert({
        user_id: owner.id,
        name: 'Quiet flow',
        status: 'active',
        apply_rule_type: 'manual',
        quiet_hours_start: '00:00:00',
        quiet_hours_end: '23:59:00',
      } as never)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const wake = new Date(Date.now() + 5 * 60_000);
    const instanceId = await seedSendWaitSend(owner, wake);
    await admin
      .from('workflow_instances')
      .update({ template_id: (tpl as { id: string }).id } as never)
      .eq('id', instanceId);

    // No MC quiet hours passed (the digest's case): the template's apply.
    const row = flattenQueue(await loadQueue(owner.client, owner.id)).find(
      (item) => item.instanceId === instanceId,
    );
    expect(row?.dueAt).not.toBe(wake.toISOString());
    expect(new Date(row?.dueAt ?? 0).getTime()).toBeGreaterThan(wake.getTime());
  });
});

describe('loadScheduledItems reads past the per-request row cap', () => {
  it('lists every step of an instance with more than 1000 of them', async () => {
    const { data: instance, error } = await admin
      .from('workflow_instances')
      .insert({
        user_id: owner.id,
        name: 'Huge list',
        status: 'active',
        is_personal: true,
      } as never)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const instanceId = (instance as { id: string }).id;
    const TOTAL = 1_050;
    const rows = Array.from({ length: TOTAL }, (_, i) => ({
      instance_id: instanceId,
      position: i,
      type: 'todo',
      title: `To-do ${i}`,
      config: {},
      status: 'pending',
      timing: CHAINED,
      due_at: new Date(Date.now() + (i + 1) * 60_000).toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: insErr } = await admin
        .from('workflow_steps')
        .insert(rows.slice(i, i + 500) as never);
      if (insErr) throw new Error(insErr.message);
    }

    const items = await loadScheduledItems(
      owner.client,
      owner.id,
      'Australia/Sydney',
      null,
      {},
      new Date(),
    );
    expect(items.filter((item) => item.instanceId === instanceId)).toHaveLength(TOTAL);
  });
});
