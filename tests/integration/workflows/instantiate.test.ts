import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyTemplate, ensureDefaultInstance, ensurePersonalInstance } from '@/lib/workflows/instantiate';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Snapshotting a template into an applied instance.
 *
 * The property under test throughout is isolation: once applied, an
 * instance is independent of the template it came from. Editing or
 * deleting a template step must never touch a couple's live progress.
 */
describe('applyTemplate', () => {
  const admin = serviceClient();
  let user: TestUser;
  let coupleId: string;
  let templateId: string;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );

    const { data: couple, error: coupleErr } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Sarah & Tom', event_date: '2026-11-14' })
      .select('id')
      .single();
    expect(coupleErr).toBeNull();
    coupleId = couple!.id;

    const { data: tpl, error: tplErr } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Gold package', status: 'active', version: 3 })
      .select('id')
      .single();
    expect(tplErr).toBeNull();
    templateId = tpl!.id;

    // Uniform keys on every row: a supabase-js array insert whose rows
    // have differing key sets silently drops rows.
    const { error } = await user.client.from('workflow_template_steps').insert([
      {
        template_id: templateId, position: 0, type: 'todo', title: 'Call the venue',
        timing: { mode: 'apply_relative', amount: 3, unit: 'days' },
        parent_step_id: null, branch_path: null, config: {}, canvas_x: 0, canvas_y: 0,
      },
      {
        template_id: templateId, position: 1, type: 'action', title: 'Send welcome email',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
        parent_step_id: null, branch_path: null,
        config: { actionType: 'send_email', subject: 'Hi', body: 'Hello' },
        canvas_x: 0, canvas_y: 120,
      },
      {
        template_id: templateId, position: 2, type: 'todo', title: 'Final details call',
        timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
        parent_step_id: null, branch_path: null, config: {}, canvas_x: 0, canvas_y: 240,
      },
    ]);
    expect(error).toBeNull();
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('creates an instance carrying the template name and version', async () => {
    const result = await applyTemplate(admin, {
      userId: user.id, templateId, coupleId,
    });
    expect(result).toHaveProperty('instanceId');
    const instanceId = (result as { instanceId: string }).instanceId;

    const { data: inst } = await admin
      .from('workflow_instances').select('*').eq('id', instanceId).single();
    expect(inst!.name).toBe('Gold package');
    expect(inst!.template_version).toBe(3);
    expect(inst!.status).toBe('active');
    expect(inst!.is_default).toBe(false);

    const { data: steps } = await admin
      .from('workflow_steps').select('*').eq('instance_id', instanceId).order('position');
    expect(steps).toHaveLength(3);
    expect(steps!.map((s) => s.title)).toEqual([
      'Call the venue', 'Send welcome email', 'Final details call',
    ]);
    // Every snapshotted step points back at the template step it came from.
    expect(steps!.every((s) => s.template_step_id !== null)).toBe(true);
  });

  it('computes due_at for anchored steps and leaves gated ones null', async () => {
    const result = await applyTemplate(admin, { userId: user.id, templateId, coupleId });
    const instanceId = (result as { instanceId: string }).instanceId;
    const { data: steps } = await admin
      .from('workflow_steps').select('title, due_at').eq('instance_id', instanceId);

    const byTitle = Object.fromEntries(steps!.map((s) => [s.title, s.due_at]));
    expect(byTitle['Call the venue']).not.toBeNull();      // apply_relative
    expect(byTitle['Final details call']).not.toBeNull();  // wedding_relative
    // after_previous behind a pending to-do: this null IS the gate.
    expect(byTitle['Send welcome email']).toBeNull();
  });

  it('editing the template afterwards does not touch the live instance', async () => {
    const result = await applyTemplate(admin, { userId: user.id, templateId, coupleId });
    const instanceId = (result as { instanceId: string }).instanceId;

    await admin
      .from('workflow_template_steps')
      .update({ title: 'RENAMED' })
      .eq('template_id', templateId)
      .eq('position', 0);

    const { data: step } = await admin
      .from('workflow_steps').select('title')
      .eq('instance_id', instanceId).eq('position', 0).single();
    expect(step!.title).toBe('Call the venue');

    // Put it back so later cases see the original fixture.
    await admin
      .from('workflow_template_steps')
      .update({ title: 'Call the venue' })
      .eq('template_id', templateId)
      .eq('position', 0);
  });

  it('deleting a template step does not delete progress on a live instance', async () => {
    const result = await applyTemplate(admin, { userId: user.id, templateId, coupleId });
    const instanceId = (result as { instanceId: string }).instanceId;
    const { data: before } = await admin
      .from('workflow_steps').select('id').eq('instance_id', instanceId);
    const countBefore = before!.length;

    const { data: extra } = await admin
      .from('workflow_template_steps')
      .insert({ template_id: templateId, position: 9, type: 'todo', title: 'temp', config: {} })
      .select('id').single();
    await admin.from('workflow_template_steps').delete().eq('id', extra!.id);

    const { data: after } = await admin
      .from('workflow_steps').select('id').eq('instance_id', instanceId);
    expect(after).toHaveLength(countBefore);
  });

  it('snapshots branch children under their new parent step id', async () => {
    const { data: tpl } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Branchy', status: 'active' })
      .select('id').single();
    const { data: branch } = await user.client
      .from('workflow_template_steps')
      .insert({
        template_id: tpl!.id, position: 0, type: 'branch', title: 'Deposit paid?',
        config: { predicate: { kind: 'has_paid_deposit' } },
      })
      .select('id').single();
    const { error: childErr } = await user.client.from('workflow_template_steps').insert([
      {
        template_id: tpl!.id, position: 0, type: 'todo', title: 'Yes path',
        parent_step_id: branch!.id, branch_path: 'yes', config: {},
      },
      {
        template_id: tpl!.id, position: 0, type: 'todo', title: 'No path',
        parent_step_id: branch!.id, branch_path: 'no', config: {},
      },
    ]);
    expect(childErr).toBeNull();

    const result = await applyTemplate(admin, {
      userId: user.id, templateId: tpl!.id, coupleId,
    });
    const instanceId = (result as { instanceId: string }).instanceId;

    const { data: steps } = await admin
      .from('workflow_steps').select('*').eq('instance_id', instanceId);
    expect(steps).toHaveLength(3);
    const branchStep = steps!.find((s) => s.type === 'branch')!;
    const kids = steps!.filter((s) => s.parent_step_id !== null);
    expect(kids).toHaveLength(2);
    // Remapped to the INSTANCE step id, not left pointing at the template.
    expect(kids.every((k) => k.parent_step_id === branchStep.id)).toBe(true);
    expect(kids.map((k) => k.branch_path).sort()).toEqual(['no', 'yes']);
  });

  it('refuses a duplicate apply when dedupe is on, and allows it when off', async () => {
    const { data: tpl } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Once only', status: 'active' })
      .select('id').single();

    const first = await applyTemplate(admin, {
      userId: user.id, templateId: tpl!.id, coupleId, dedupe: true,
    });
    expect(first).toHaveProperty('instanceId');

    const second = await applyTemplate(admin, {
      userId: user.id, templateId: tpl!.id, coupleId, dedupe: true,
    });
    expect(second).toHaveProperty('error');

    // The manual picker passes dedupe:false, because an MC asking for a
    // second copy is making a deliberate choice.
    const third = await applyTemplate(admin, {
      userId: user.id, templateId: tpl!.id, coupleId, dedupe: false,
    });
    expect(third).toHaveProperty('instanceId');
  });

  it('refuses to apply an archived template', async () => {
    const { data: tpl } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Old', status: 'archived' })
      .select('id').single();
    const result = await applyTemplate(admin, {
      userId: user.id, templateId: tpl!.id, coupleId,
    });
    expect(result).toEqual({ error: 'template is archived' });
  });

  it('refuses to apply another tenant’s template', async () => {
    const other = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    try {
      const result = await applyTemplate(admin, {
        userId: other.id, templateId, coupleId,
      });
      expect(result).toEqual({ error: 'template not found' });
    } finally {
      await other.cleanup();
    }
  });

  it('skips disabled template steps', async () => {
    const { data: tpl } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'With a disabled step', status: 'active' })
      .select('id').single();
    const { error } = await user.client.from('workflow_template_steps').insert([
      { template_id: tpl!.id, position: 0, type: 'todo', title: 'Live', config: {}, disabled: false },
      { template_id: tpl!.id, position: 1, type: 'todo', title: 'Off', config: {}, disabled: true },
    ]);
    expect(error).toBeNull();

    const result = await applyTemplate(admin, {
      userId: user.id, templateId: tpl!.id, coupleId,
    });
    const { data: steps } = await admin
      .from('workflow_steps').select('title')
      .eq('instance_id', (result as { instanceId: string }).instanceId);
    expect(steps!.map((s) => s.title)).toEqual(['Live']);
  });

  it('writes an instance_created audit row', async () => {
    const result = await applyTemplate(admin, { userId: user.id, templateId, coupleId });
    const instanceId = (result as { instanceId: string }).instanceId;
    const { data } = await admin
      .from('workflow_audit_log').select('event').eq('instance_id', instanceId);
    expect(data!.map((r) => r.event)).toContain('instance_created');
  });
});

describe('ensureDefaultInstance / ensurePersonalInstance', () => {
  const admin = serviceClient();
  let user: TestUser;
  let coupleId: string;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Ada & Bo' })
      .select('id').single();
    coupleId = couple!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('is idempotent for the couple default', async () => {
    const a = await ensureDefaultInstance(admin, user.id, coupleId);
    const b = await ensureDefaultInstance(admin, user.id, coupleId);
    expect(a).toBe(b);
    const { data } = await admin
      .from('workflow_instances').select('id')
      .eq('couple_id', coupleId).eq('is_default', true);
    expect(data).toHaveLength(1);
  });

  it('is idempotent for the personal instance', async () => {
    const a = await ensurePersonalInstance(admin, user.id);
    const b = await ensurePersonalInstance(admin, user.id);
    expect(a).toBe(b);
    const { data } = await admin
      .from('workflow_instances').select('id')
      .eq('user_id', user.id).eq('is_personal', true);
    expect(data).toHaveLength(1);
  });
});
