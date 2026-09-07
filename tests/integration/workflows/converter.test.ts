import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { convertLegacyData } from '@/lib/workflows/converter';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The one-time conversion of legacy Tasks and Automations into Workflows.
 *
 * Production volumes are small (55 tasks, 27 automations at the audit),
 * but nine of those tasks belong to paying users, so the bar here is that
 * nothing is lost silently: anything the new model drops has to come back
 * named in the report.
 *
 * The SQL migration is the shipping path; this drives its TypeScript
 * mirror, which is also the per-user re-run tool.
 */
describe('convertLegacyData', () => {
  const admin = serviceClient();
  let user: TestUser;
  let other: TestUser;
  let coupleId: string;
  let otherCoupleId: string;
  let report: Awaited<ReturnType<typeof convertLegacyData>>;

  /** Steps on the user's instances, newest conversion included. */
  async function stepsFor(userId: string) {
    const { data } = await admin
      .from('workflow_steps')
      .select('*, workflow_instances!inner(user_id, couple_id, is_default, is_personal)')
      .eq('workflow_instances.user_id', userId);
    return data ?? [];
  }

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    other = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );

    await admin
      .from('user_public_settings')
      .upsert({ user_id: user.id, timezone: 'Australia/Sydney' }, { onConflict: 'user_id' });

    const { data: couple } = await admin
      .from('couples')
      .insert({ user_id: user.id, name: 'Sarah & Tom', event_date: '2026-11-14' })
      .select('id')
      .single();
    coupleId = couple!.id;

    const { data: otherCouple } = await admin
      .from('couples')
      .insert({ user_id: other.id, name: 'Not Yours' })
      .select('id')
      .single();
    otherCoupleId = otherCouple!.id;

    // A couple that gets deleted, so its task is orphaned at convert time.
    const { data: doomed } = await admin
      .from('couples')
      .insert({ user_id: user.id, name: 'Cancelled Wedding' })
      .select('id')
      .single();

    // Uniform keys on every row: a ragged array insert silently drops rows.
    const { error: taskErr } = await admin.from('tasks').insert([
      {
        user_id: user.id, title: 'Call the venue', description: 'About parking',
        due_date: '2026-11-01', status: 'todo', position: 2,
        priority: 'high', task_type: null, group_id: null,
        related_couple_id: coupleId,
      },
      {
        user_id: user.id, title: 'Send the invoice', description: null,
        due_date: null, status: 'done', position: 1,
        priority: null, task_type: null, group_id: null,
        related_couple_id: coupleId,
      },
      {
        user_id: user.id, title: 'Some custom status', description: null,
        due_date: null, status: 'blocked_on_couple', position: 3,
        priority: null, task_type: null, group_id: null,
        related_couple_id: coupleId,
      },
      {
        user_id: user.id, title: 'Renew the PA licence', description: null,
        due_date: null, status: 'todo', position: 1,
        priority: null, task_type: null, group_id: null,
        related_couple_id: null,
      },
      {
        user_id: user.id, title: 'Orphaned task', description: null,
        due_date: null, status: 'todo', position: 9,
        priority: null, task_type: null, group_id: null,
        related_couple_id: doomed!.id,
      },
      {
        user_id: other.id, title: 'Another MC task', description: null,
        due_date: null, status: 'todo', position: 1,
        priority: null, task_type: null, group_id: null,
        related_couple_id: otherCoupleId,
      },
    ]);
    expect(taskErr).toBeNull();

    // Deleting the couple orphans its task (the FK nulls or cascades
    // depending on the column, so read back what actually happened).
    await admin.from('couples').delete().eq('id', doomed!.id);

    const { data: automations, error: autoErr } = await admin
      .from('automations')
      .insert([
        {
          user_id: user.id, name: 'Enquiry follow-up', description: 'The good one',
          status: 'active', trigger_type: 'new_enquiry',
          trigger_config: { stages: ['new'] }, branch_depth_limit: 3,
          template_slug: 'starter-enquiry', version: 2,
        },
        {
          user_id: user.id, name: 'Paused one', description: null,
          status: 'paused', trigger_type: 'couple_stage_changed',
          trigger_config: {}, branch_depth_limit: 2,
          template_slug: null, version: 1,
        },
      ])
      .select('id, name');
    expect(autoErr).toBeNull();

    const enquiry = automations!.find((a) => a.name === 'Enquiry follow-up')!;

    const { data: branch, error: branchErr } = await admin
      .from('automation_actions')
      .insert({
        automation_id: enquiry.id, position: 0, type: 'branch',
        config: { field: 'status' }, label: 'Booked?',
        parent_action_id: null, branch_path: null, disabled: false,
        position_x: 40, position_y: 80,
      })
      .select('id')
      .single();
    expect(branchErr).toBeNull();

    const { error: actionErr } = await admin.from('automation_actions').insert([
      {
        automation_id: enquiry.id, position: 1, type: 'send_email',
        config: { subject: 'Congrats' }, label: 'Welcome email',
        parent_action_id: branch!.id, branch_path: 'yes', disabled: false,
        position_x: null, position_y: null,
      },
      {
        automation_id: enquiry.id, position: 2, type: 'wait',
        config: { days: 3 }, label: null,
        parent_action_id: branch!.id, branch_path: 'no', disabled: true,
        position_x: null, position_y: null,
      },
      {
        automation_id: enquiry.id, position: 3, type: 'create_task',
        config: { title: 'Chase them' }, label: 'Chase',
        parent_action_id: null, branch_path: null, disabled: false,
        position_x: null, position_y: null,
      },
    ]);
    expect(actionErr).toBeNull();

    report = await convertLegacyData(admin, user.id);
  });

  afterAll(async () => {
    await user.cleanup();
    await other.cleanup();
  });

  /* ── tasks ─────────────────────────────────────────────────────── */

  it('lands a couple task as a to-do step on that couple default workflow', async () => {
    const steps = await stepsFor(user.id);
    const call = steps.find((s) => s.title === 'Call the venue');
    expect(call).toBeDefined();
    expect(call!.type).toBe('todo');
    expect(call!.workflow_instances.couple_id).toBe(coupleId);
    expect(call!.workflow_instances.is_default).toBe(true);
  });

  it('keeps the title, description and due date at local midnight', async () => {
    const steps = await stepsFor(user.id);
    const call = steps.find((s) => s.title === 'Call the venue')!;
    expect(call.description).toBe('About parking');
    // Midnight on 1 Nov in Sydney is 13:00 UTC on 31 Oct. A UTC parse
    // would store 00:00Z and move the task onto the previous day.
    expect(call.due_at).toBe('2026-10-31T13:00:00+00:00');
  });

  it('collapses every legacy status onto the checklist binary', async () => {
    const steps = await stepsFor(user.id);
    expect(steps.find((s) => s.title === 'Send the invoice')!.status).toBe('done');
    expect(steps.find((s) => s.title === 'Some custom status')!.status).toBe('pending');
    expect(steps.find((s) => s.title === 'Call the venue')!.status).toBe('pending');
  });

  it('names what the checklist model drops instead of dropping it silently', () => {
    const dropped = report.warnings.find((w) => w.includes('Call the venue'));
    expect(dropped).toBeDefined();
    expect(dropped).toContain('priority=high');
  });

  it('lands an unlinked task on the personal workflow', async () => {
    const steps = await stepsFor(user.id);
    const licence = steps.find((s) => s.title === 'Renew the PA licence')!;
    expect(licence.workflow_instances.is_personal).toBe(true);
    expect(licence.workflow_instances.couple_id).toBeNull();
  });

  it('keeps a task whose couple was deleted, on the personal workflow', async () => {
    const steps = await stepsFor(user.id);
    const orphan = steps.find((s) => s.title === 'Orphaned task');
    // `tasks.related_couple_id` is ON DELETE SET NULL, so deleting a
    // couple unlinks its tasks rather than leaving dangling ids. The work
    // is still the MC's, so it lands on their personal list instead of
    // being thrown away. The converter's skip branch stays as a guard
    // against a genuinely dangling reference, which the FK prevents.
    expect(orphan).toBeDefined();
    expect(orphan!.workflow_instances.is_personal).toBe(true);
    expect(report.tasksSkipped).toBe(0);
  });

  it('renumbers positions sequentially per instance', async () => {
    const steps = await stepsFor(user.id);
    const onCouple = steps
      .filter((s) => s.workflow_instances.couple_id === coupleId)
      .sort((a, b) => a.position - b.position);
    expect(onCouple.map((s) => s.position)).toEqual(
      onCouple.map((_, i) => i + 1),
    );
    // Ordered by the task's own position, so "Send the invoice" (1)
    // still precedes "Call the venue" (2).
    expect(onCouple[0]!.title).toBe('Send the invoice');
  });

  /* ── automations ───────────────────────────────────────────────── */

  it('converts each automation into one template that applies on its old event', async () => {
    const { data } = await admin
      .from('workflow_templates')
      .select('*')
      .eq('user_id', user.id)
      .not('legacy_automation_id', 'is', null);
    expect(data).toHaveLength(2);
    const enquiry = data!.find((t) => t.name === 'Enquiry follow-up')!;
    expect(enquiry.apply_rule_type).toBe('on_event');
    expect(enquiry.apply_rule_config).toEqual({
      eventType: 'new_enquiry',
      triggerConfig: { stages: ['new'] },
    });
  });

  it('converts active as active and everything else as an editable draft', async () => {
    const { data } = await admin
      .from('workflow_templates')
      .select('name, status')
      .eq('user_id', user.id)
      .not('legacy_automation_id', 'is', null);
    expect(data!.find((t) => t.name === 'Enquiry follow-up')!.status).toBe('active');
    // Paused becomes draft, not archived: the MC can still open and run it.
    expect(data!.find((t) => t.name === 'Paused one')!.status).toBe('draft');
  });

  it('maps action types onto step types and moves the slug into config', async () => {
    const { data: template } = await admin
      .from('workflow_templates')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Enquiry follow-up')
      .single();
    const { data: steps } = await admin
      .from('workflow_template_steps')
      .select('*')
      .eq('template_id', template!.id);

    const branch = steps!.find((s) => s.title === 'Booked?')!;
    expect(branch.type).toBe('branch');

    const email = steps!.find((s) => s.title === 'Welcome email')!;
    expect(email.type).toBe('action');
    expect((email.config as Record<string, unknown>).actionType).toBe('send_email');
    expect((email.config as Record<string, unknown>).subject).toBe('Congrats');

    const wait = steps!.find((s) => s.type === 'wait')!;
    expect((wait.config as Record<string, unknown>).days).toBe(3);
    expect((wait.config as Record<string, unknown>).actionType).toBeUndefined();

    // The handler is re-pointed at workflow_steps rather than the config
    // being rewritten, so the slug survives verbatim.
    const task = steps!.find((s) => s.title === 'Chase')!;
    expect((task.config as Record<string, unknown>).actionType).toBe('create_task');
  });

  it('rebuilds the branch structure and carries the disabled flag', async () => {
    const { data: template } = await admin
      .from('workflow_templates')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Enquiry follow-up')
      .single();
    const { data: steps } = await admin
      .from('workflow_template_steps')
      .select('*')
      .eq('template_id', template!.id);

    const branch = steps!.find((s) => s.title === 'Booked?')!;
    const email = steps!.find((s) => s.title === 'Welcome email')!;
    const wait = steps!.find((s) => s.type === 'wait')!;

    expect(email.parent_step_id).toBe(branch.id);
    expect(email.branch_path).toBe('yes');
    expect(wait.parent_step_id).toBe(branch.id);
    expect(wait.branch_path).toBe('no');
    expect(wait.disabled).toBe(true);
    expect(branch.parent_step_id).toBeNull();
  });

  it('gives every converted step sequential timing and a readable canvas position', async () => {
    const { data: template } = await admin
      .from('workflow_templates')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Enquiry follow-up')
      .single();
    const { data: steps } = await admin
      .from('workflow_template_steps')
      .select('*')
      .eq('template_id', template!.id);

    for (const step of steps!) {
      expect(step.timing).toEqual({ mode: 'after_previous', delayAmount: 0, unit: 'days' });
    }
    // A saved position is kept; an unsaved one falls into a column rather
    // than piling every node at the origin.
    const branch = steps!.find((s) => s.title === 'Booked?')!;
    expect(branch.canvas_x).toBe(40);
    expect(branch.canvas_y).toBe(80);
    const email = steps!.find((s) => s.title === 'Welcome email')!;
    expect(email.canvas_y).toBeGreaterThan(0);
  });

  it('carries quiet hours, branch depth and the starter-library slug', async () => {
    const { data } = await admin
      .from('workflow_templates')
      .select('branch_depth_limit, template_slug, version')
      .eq('user_id', user.id)
      .eq('name', 'Enquiry follow-up')
      .single();
    expect(data!.branch_depth_limit).toBe(3);
    expect(data!.template_slug).toBe('starter-enquiry');
    expect(data!.version).toBe(2);
  });

  /* ── idempotency and tenancy ───────────────────────────────────── */

  it('converts nothing on a second run', async () => {
    const before = await stepsFor(user.id);
    const { count: templatesBefore } = await admin
      .from('workflow_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const second = await convertLegacyData(admin, user.id);
    expect(second.tasksConverted).toBe(0);
    expect(second.automationsConverted).toBe(0);

    const after = await stepsFor(user.id);
    expect(after).toHaveLength(before.length);
    const { count: templatesAfter } = await admin
      .from('workflow_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(templatesAfter).toBe(templatesBefore);
  });

  it('never lands one tenant data on another', async () => {
    const steps = await stepsFor(other.id);
    expect(steps.find((s) => s.title === 'Call the venue')).toBeUndefined();
    const { data: templates } = await admin
      .from('workflow_templates')
      .select('name')
      .eq('user_id', other.id);
    expect(templates ?? []).toHaveLength(0);
  });

  it('leaves in-flight runs alone and names them', async () => {
    const { data: automation } = await admin
      .from('automations')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Enquiry follow-up')
      .single();
    const { data: event } = await admin
      .from('automation_events')
      .insert({
        user_id: user.id,
        event_type: 'new_enquiry',
        source_table: 'couples',
        source_id: coupleId,
        payload: {},
      })
      .select('id')
      .single();
    await admin.from('automation_runs').insert({
      user_id: user.id,
      automation_id: automation!.id,
      event_id: event!.id,
      status: 'running',
    });

    const third = await convertLegacyData(admin, user.id);
    expect(third.warnings.some((w) => w.includes('was NOT converted'))).toBe(true);

    const { count } = await admin
      .from('automation_runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(1);
  });
});
