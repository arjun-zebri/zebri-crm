/**
 * A send still behind an earlier step cannot be sent or dated early.
 *
 * Upcoming lists every send, including the one behind a sleeping Wait.
 * Send & complete on it ran it at once, and a snooze gave it a date the
 * engine runs on sight: the email went before the Wait ended. Both
 * server paths now refuse in words, and `runStepNow` refuses as a
 * backstop. Real schema, real RLS, through the MC's own client.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  approveStepAction,
  loadStepDetailAction,
  rescheduleStepAction,
  retryStepAction,
} from '@/app/(dashboard)/workflows/instance-actions';
import { runStepNow } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

// Hoisted above the imports by vitest, so the actions see these.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user');
    return activeUser.client;
  }),
}));

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };
const CHAINED = { mode: 'after_previous', delayAmount: 0, unit: 'days' };
const admin = serviceClient();
let owner: TestUser;

beforeAll(async () => {
  owner = await createTestUser({}, PRO);
});
afterEach(() => {
  activeUser = null;
});
afterAll(async () => {
  await owner?.cleanup();
});

/** Wait 5 minutes (asleep), then a send with no date yet. */
async function seedBehindWait(): Promise<{ sendId: string; waitId: string }> {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: owner.id, name: 'Order Couple', status: 'Enquiry' } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const { data: instance, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: owner.id,
      couple_id: (couple as { id: string }).id,
      name: 'Order flow',
      status: 'active',
    } as never)
    .select('id')
    .single();
  if (instErr) throw new Error(instErr.message);
  const instanceId = (instance as { id: string }).id;
  const { data: steps, error: stepErr } = await admin
    .from('workflow_steps')
    .insert([
      {
        instance_id: instanceId,
        position: 100,
        type: 'wait',
        title: 'Wait',
        status: 'waiting',
        timing: CHAINED,
        config: { mode: 'duration', durationMinutes: 5 },
        due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      },
      {
        instance_id: instanceId,
        position: 200,
        type: 'action',
        title: '',
        status: 'pending',
        timing: CHAINED,
        config: { actionType: 'send_email', subject: 'Email 2' },
        due_at: null,
      },
    ] as never)
    .select('id, type');
  if (stepErr) throw new Error(stepErr.message);
  const rows = steps as { id: string; type: string }[];
  return {
    waitId: rows.find((r) => r.type === 'wait')!.id,
    sendId: rows.find((r) => r.type === 'action')!.id,
  };
}

async function readSend(id: string) {
  const { data } = await admin
    .from('workflow_steps')
    .select('status, due_at, due_held_at')
    .eq('id', id)
    .single();
  return data as { status: string; due_at: string | null; due_held_at: string | null };
}

const REASON = 'This step waits for "Wait" to finish first.';

describe('a send behind a sleeping Wait', () => {
  it('Send & complete is refused in words, and nothing changes', async () => {
    const { sendId } = await seedBehindWait();
    activeUser = owner;
    expect(await approveStepAction({ stepId: sendId })).toEqual({ ok: false, error: REASON });
    expect(await readSend(sendId)).toEqual({ status: 'pending', due_at: null, due_held_at: null });
  });

  it('snoozing it to a date is refused; taking the date off is not', async () => {
    const { sendId } = await seedBehindWait();
    activeUser = owner;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(await rescheduleStepAction({ stepId: sendId, dueAt: tomorrow })).toEqual({
      ok: false,
      error: REASON,
    });
    expect((await readSend(sendId)).due_at).toBeNull();
    // A hold never sends, so it stays the MC's to make.
    expect((await rescheduleStepAction({ stepId: sendId, dueAt: null })).ok).toBe(true);
    expect((await readSend(sendId)).due_held_at).not.toBeNull();
  });

  it('the detail modal is told why, so it offers neither', async () => {
    const { sendId } = await seedBehindWait();
    activeUser = owner;
    const res = await loadStepDetailAction({ stepId: sendId });
    expect(res.ok && res.data.blockedReason).toBe(REASON);
  });

  it('Try again on a failed send behind it is refused, and the failure stays', async () => {
    const { sendId } = await seedBehindWait()
    await admin
      .from('workflow_steps')
      .update({ status: 'errored', error_message: 'boom', due_at: new Date().toISOString() } as never)
      .eq('id', sendId)
    activeUser = owner
    expect(await retryStepAction({ stepId: sendId })).toEqual({ ok: false, error: REASON })
    expect((await readSend(sendId)).status).toBe('errored')
  })

  it('runStepNow refuses it as a backstop', async () => {
    const { sendId } = await seedBehindWait();
    expect(await runStepNow(admin, sendId)).toBe(false);
    expect((await readSend(sendId)).status).toBe('pending');
  });

  it('once the Wait is done, the send can be dated again', async () => {
    const { sendId, waitId } = await seedBehindWait();
    await admin
      .from('workflow_steps')
      .update({ status: 'done', completed_at: new Date().toISOString() } as never)
      .eq('id', waitId);
    activeUser = owner;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect((await rescheduleStepAction({ stepId: sendId, dueAt: tomorrow })).ok).toBe(true);
    const res = await loadStepDetailAction({ stepId: sendId });
    expect(res.ok && res.data.blockedReason).toBeNull();
  });
});
