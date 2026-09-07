import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dispatchPendingEvents } from '@/lib/workflows/dispatcher';
import { advanceDueSteps, completeStep } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The whole engine loop, with no UI.
 *
 * Build a template, create a couple, let the dispatcher apply it, tick,
 * tick the manual gate, tick again. If this passes, Phase A works.
 */
describe('workflows engine end to end', () => {
  const admin = serviceClient();
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('applies a template on couple creation and gates the automated step behind the to-do', async () => {
    const { data: tpl, error: tplErr } = await user.client
      .from('workflow_templates')
      .insert({
        user_id: user.id,
        name: 'New enquiry process',
        status: 'active',
        apply_rule_type: 'on_couple_created',
        apply_rule_config: {},
      })
      .select('id')
      .single();
    expect(tplErr).toBeNull();

    const { error: stepErr } = await user.client.from('workflow_template_steps').insert([
      {
        template_id: tpl!.id, position: 0, type: 'todo', title: 'Ring them back',
        timing: { mode: 'apply_relative', amount: 0, unit: 'days' },
        parent_step_id: null, branch_path: null, config: {}, canvas_x: 0, canvas_y: 0,
      },
      {
        template_id: tpl!.id, position: 1, type: 'action', title: 'Move them to Booked',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
        parent_step_id: null, branch_path: null,
        config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
        canvas_x: 0, canvas_y: 120,
      },
    ]);
    expect(stepErr).toBeNull();

    // Drain anything other suites left on the bus.
    await dispatchPendingEvents(admin, 5000);

    const { data: couple, error: coupleErr } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Tick & Tock', status: 'Enquiry' })
      .select('id')
      .single();
    expect(coupleErr).toBeNull();

    // ── Tick one: the template applies ────────────────────────────
    await dispatchPendingEvents(admin);
    await advanceDueSteps(admin);

    const { data: instances } = await admin
      .from('workflow_instances')
      .select('id, name')
      .eq('couple_id', couple!.id)
      .eq('template_id', tpl!.id);
    expect(instances).toHaveLength(1);
    const instanceId = instances![0]!.id;

    const readSteps = async () => {
      const { data } = await admin
        .from('workflow_steps')
        .select('id, title, status, due_at')
        .eq('instance_id', instanceId)
        .order('position');
      return data!;
    };

    let steps = await readSteps();
    expect(steps.map((s) => s.title)).toEqual(['Ring them back', 'Move them to Booked']);
    // The to-do is live; the automated step is gated behind it.
    expect(steps[0]!.status).toBe('pending');
    expect(steps[0]!.due_at).not.toBeNull();
    expect(steps[1]!.status).toBe('pending');
    expect(steps[1]!.due_at).toBeNull();

    // The couple has not moved, because the gate has not opened.
    const { data: before } = await admin
      .from('couples').select('status').eq('id', couple!.id).single();
    expect(before!.status).toBe('Enquiry');

    // ── The MC ticks the to-do ────────────────────────────────────
    await completeStep(admin, steps[0]!.id);

    steps = await readSteps();
    expect(steps[0]!.status).toBe('done');
    expect(steps[1]!.due_at).not.toBeNull();

    // ── Tick two: the automated step runs ─────────────────────────
    await advanceDueSteps(admin);

    steps = await readSteps();
    expect(steps[1]!.status).toBe('done');

    const { data: after } = await admin
      .from('couples').select('status').eq('id', couple!.id).single();
    expect(after!.status).toBe('Booked');

    // The instance is finished and says so.
    const { data: inst } = await admin
      .from('workflow_instances').select('status').eq('id', instanceId).single();
    expect(inst!.status).toBe('completed');
  });
});
