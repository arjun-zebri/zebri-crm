/**
 * Portal milestones — what a couple is allowed to see of a workflow.
 *
 * A workflow is the MC's internal list. "Chase the outstanding balance"
 * is a step on it. So the rule under test is not "does the RPC work",
 * it is "does anything the MC did not deliberately share stay
 * invisible", including to somebody holding a different couple's token.
 *
 * Runs through the anon client, with no session, exactly as the public
 * portal page does.
 */
import { describe, expect, it } from 'vitest';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const PRO = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

const admin = serviceClient();

interface Milestone {
  id: string;
  title: string;
  note: string | null;
  status: 'done' | 'upcoming';
  due_at: string | null;
}

/** A couple with a live portal token and an active workflow on it. */
async function arrangeCouple(user: TestUser, name: string) {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Booked', portal_token_enabled: true } as never)
    .select('id, portal_token')
    .single();
  if (error) throw new Error(error.message);
  const row = couple as { id: string; portal_token: string };

  const { data: instance, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: row.id,
      name: 'Booked to wedding day',
      status: 'active',
    } as never)
    .select('id')
    .single();
  if (instErr) throw new Error(instErr.message);

  return {
    coupleId: row.id,
    token: row.portal_token,
    instanceId: (instance as { id: string }).id,
  };
}

/** Insert one step on an instance. */
async function addStep(
  instanceId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'A step',
      config: {},
      status: 'pending',
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      ...fields,
    } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Call the RPC the way the portal page does: anon, token only. */
async function readMilestones(token: string): Promise<Milestone[]> {
  const { data, error } = await anonClient().rpc('get_portal_milestones' as never, {
    token,
  } as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Milestone[];
}

describe('get_portal_milestones', () => {
  it('returns only the steps the MC opted into sharing', async () => {
    const user = await createTestUser({}, PRO);
    const { token, instanceId } = await arrangeCouple(user, 'Shared Couple');

    await addStep(instanceId, {
      title: 'Planning call',
      description: 'About an hour',
      visible_to_couple: true,
      status: 'done',
      position: 0,
    });
    await addStep(instanceId, {
      title: 'Chase the outstanding balance',
      visible_to_couple: false,
      position: 1,
    });

    const milestones = await readMilestones(token);
    expect(milestones).toHaveLength(1);
    expect(milestones[0]).toMatchObject({
      title: 'Planning call',
      note: 'About an hour',
      status: 'done',
    });
  });

  it('shows a skipped step as done and never as skipped', async () => {
    // The MC decided not to do it. Explaining that decision is not this
    // page's job, and "skipped" reads to a couple as something dropped.
    const user = await createTestUser({}, PRO);
    const { token, instanceId } = await arrangeCouple(user, 'Skipped Couple');
    await addStep(instanceId, {
      title: 'Rehearsal',
      visible_to_couple: true,
      status: 'skipped',
    });

    expect((await readMilestones(token))[0]).toMatchObject({ status: 'done' });
  });

  it('never shows a failure to the couple', async () => {
    // A send that broke is the MC's problem to fix, and reads as alarming
    // on the couple's own page.
    const user = await createTestUser({}, PRO);
    const { token, instanceId } = await arrangeCouple(user, 'Errored Couple');
    await addStep(instanceId, {
      title: 'Send the run sheet',
      visible_to_couple: true,
      status: 'errored',
      error_message: 'mailbox full',
    });

    const milestones = await readMilestones(token);
    expect(milestones[0]?.status).toBe('upcoming');
    expect(JSON.stringify(milestones)).not.toContain('mailbox full');
  });

  it('hides steps on a cancelled workflow', async () => {
    const user = await createTestUser({}, PRO);
    const { token, instanceId } = await arrangeCouple(user, 'Cancelled Couple');
    await addStep(instanceId, { title: 'Old plan', visible_to_couple: true });
    await admin
      .from('workflow_instances')
      .update({ status: 'cancelled' })
      .eq('id', instanceId);

    expect(await readMilestones(token)).toEqual([]);
  });

  it('gives one couple nothing of another couple’s workflow', async () => {
    const victim = await createTestUser({}, PRO);
    const other = await createTestUser({}, PRO);
    const victimCouple = await arrangeCouple(victim, 'Victim Couple');
    const otherCouple = await arrangeCouple(other, 'Other Couple');

    await addStep(victimCouple.instanceId, {
      title: 'Victim milestone',
      visible_to_couple: true,
    });

    expect(await readMilestones(otherCouple.token)).toEqual([]);
  });

  it('returns nothing for a token that was never issued', async () => {
    expect(await readMilestones('00000000-0000-4000-8000-000000000000')).toEqual([]);
  });

  it('returns nothing once sharing is switched off', async () => {
    const user = await createTestUser({}, PRO);
    const { token, coupleId, instanceId } = await arrangeCouple(user, 'Revoked Couple');
    await addStep(instanceId, { title: 'Planning call', visible_to_couple: true });
    expect(await readMilestones(token)).toHaveLength(1);

    await admin
      .from('couples')
      .update({ portal_token_enabled: false })
      .eq('id', coupleId);

    expect(await readMilestones(token)).toEqual([]);
  });
});

describe('workflow_steps RLS', () => {
  it('does not let one MC read another’s visible steps directly', async () => {
    // The RPC is the only door. The table itself stays owner-only, so a
    // signed-in MC cannot read a shared step by querying around it.
    const victim = await createTestUser({}, PRO);
    const attacker = await createTestUser({}, PRO);
    const { instanceId } = await arrangeCouple(victim, 'RLS Victim');
    const stepId = await addStep(instanceId, {
      title: 'Visible but private',
      visible_to_couple: true,
    });

    const { data } = await attacker.client
      .from('workflow_steps')
      .select('id')
      .eq('id', stepId);
    expect(data).toEqual([]);
  });
});
