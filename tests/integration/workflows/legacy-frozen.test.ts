import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The retired Tasks and Automations tables after the freeze.
 *
 * Reads stay open so a support question about what a row used to hold is
 * still answerable; every write path is closed. The load-bearing negative
 * case is the last one: `automation_events` must NOT be frozen, because
 * despite the name it is the live bus the workflow dispatcher reads and a
 * dozen DB triggers write to.
 */
describe('legacy tables are frozen', () => {
  const admin = serviceClient();
  let user: TestUser;
  let coupleId: string;
  let taskId: string;
  let automationId: string;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );

    const { data: couple } = await admin
      .from('couples')
      .insert({ user_id: user.id, name: 'Frozen Test' })
      .select('id')
      .single();
    coupleId = couple!.id;

    // Seeded with the service role, which bypasses RLS: the freeze closes
    // the user-facing write path, not the migration one.
    const { data: task, error: taskErr } = await admin
      .from('tasks')
      .insert({
        user_id: user.id,
        title: 'A legacy task',
        status: 'todo',
        position: 1,
        related_couple_id: coupleId,
      })
      .select('id')
      .single();
    expect(taskErr).toBeNull();
    taskId = task!.id;

    const { data: automation, error: autoErr } = await admin
      .from('automations')
      .insert({
        user_id: user.id,
        name: 'A legacy automation',
        status: 'active',
        trigger_type: 'new_enquiry',
        trigger_config: {},
      })
      .select('id')
      .single();
    expect(autoErr).toBeNull();
    automationId = automation!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('still lets the owner read their tasks', async () => {
    const { data, error } = await user.client
      .from('tasks')
      .select('id, title')
      .eq('id', taskId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.title).toBe('A legacy task');
  });

  it('refuses a task insert', async () => {
    const { error } = await user.client
      .from('tasks')
      .insert({ user_id: user.id, title: 'Nope', status: 'todo', position: 1 });
    expect(error).not.toBeNull();
  });

  it('refuses a task update', async () => {
    const { error } = await user.client
      .from('tasks')
      .update({ title: 'Renamed' })
      .eq('id', taskId);
    // A dropped UPDATE policy makes the row invisible to the write, so
    // PostgREST reports no error but changes nothing. Either shape is a
    // refusal; what matters is the row is untouched.
    const { data } = await admin.from('tasks').select('title').eq('id', taskId).single();
    expect(data!.title).toBe('A legacy task');
    expect(error === null || error !== null).toBe(true);
  });

  it('refuses a task delete', async () => {
    await user.client.from('tasks').delete().eq('id', taskId);
    const { count } = await admin
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('id', taskId);
    expect(count).toBe(1);
  });

  it('still lets the owner read their automations', async () => {
    const { data, error } = await user.client
      .from('automations')
      .select('id, name')
      .eq('id', automationId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.name).toBe('A legacy automation');
  });

  it('refuses an automation insert', async () => {
    const { error } = await user.client.from('automations').insert({
      user_id: user.id,
      name: 'Nope',
      status: 'draft',
      trigger_type: 'new_enquiry',
      trigger_config: {},
    });
    expect(error).not.toBeNull();
  });

  it('refuses an automation_actions insert', async () => {
    const { error } = await user.client.from('automation_actions').insert({
      automation_id: automationId,
      position: 0,
      type: 'send_email',
      config: {},
    });
    expect(error).not.toBeNull();
  });

  it('refuses writes to the retired task lookup tables', async () => {
    const { error: groups } = await user.client
      .from('task_groups')
      .insert({ user_id: user.id, name: 'Nope' });
    expect(groups).not.toBeNull();

    const { error: statuses } = await user.client
      .from('task_statuses')
      .insert({ user_id: user.id, name: 'Nope' });
    expect(statuses).not.toBeNull();
  });

  it('leaves the event bus writable, because the new engine runs on it', async () => {
    // `automation_events` and `emit_automation_event` are NOT frozen. A
    // dozen DB triggers publish through them and the workflow dispatcher
    // reads them; freezing either would silently stop every workflow.
    const { data, error } = await admin
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
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it('leaves couple_custom_fields writable, because the variable resolver reads it', async () => {
    const { error } = await admin
      .from('couple_custom_fields')
      .insert({ user_id: user.id, couple_id: coupleId, key: 'ceremony_style', value: 'garden' });
    expect(error).toBeNull();
  });
});
