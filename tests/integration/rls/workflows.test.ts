import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, type TestUser } from '../helpers/supabase';

/**
 * RLS tenant isolation for the Workflows tables.
 *
 * Every table is owner-scoped. Child tables (`workflow_template_steps`,
 * `workflow_steps`, `workflow_template_tags`) scope through their parent,
 * so a cross-tenant read must return zero rows even when the attacker
 * knows the parent id.
 *
 * The cross-tenant WRITE cases matter as much as the reads: foreign keys
 * are checked with elevated privileges and ignore RLS, so an owner-only
 * `with check (auth.uid() = user_id)` still lets user B insert an
 * instance pointing at user A's couple or template unless the policy
 * carries an explicit ownership clause.
 */
describe('RLS: workflows tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let templateAId: string;
  let coupleAId: string;
  let instanceAId: string;
  let stepAId: string;

  beforeAll(async () => {
    const pro = {
      account_type: 'vendor',
      subscription_status: 'active',
      subscription_plan: 'pro',
    };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data: tpl, error: tplErr } = await userA.client
      .from('workflow_templates')
      .insert({ user_id: userA.id, name: 'Gold package' })
      .select('id')
      .single();
    expect(tplErr).toBeNull();
    templateAId = tpl!.id;

    const { data: couple, error: coupleErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sarah & Tom' })
      .select('id')
      .single();
    expect(coupleErr).toBeNull();
    coupleAId = couple!.id;

    const { data: inst, error: instErr } = await userA.client
      .from('workflow_instances')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        template_id: templateAId,
        name: 'Gold package',
      })
      .select('id')
      .single();
    expect(instErr).toBeNull();
    instanceAId = inst!.id;

    const { data: step, error: stepErr } = await userA.client
      .from('workflow_steps')
      .insert({
        instance_id: instanceAId,
        position: 0,
        type: 'todo',
        title: 'Call the venue',
      })
      .select('id')
      .single();
    expect(stepErr).toBeNull();
    stepAId = step!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner reads their own template', async () => {
    const { data } = await userA.client
      .from('workflow_templates')
      .select('id')
      .eq('id', templateAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT the template', async () => {
    const { data, error } = await userB.client
      .from('workflow_templates')
      .select('*')
      .eq('id', templateAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE or DELETE the template', async () => {
    await userB.client
      .from('workflow_templates')
      .update({ name: 'hijacked' })
      .eq('id', templateAId);
    await userB.client.from('workflow_templates').delete().eq('id', templateAId);
    const { data } = await userA.client
      .from('workflow_templates')
      .select('name')
      .eq('id', templateAId)
      .single();
    expect(data!.name).toBe('Gold package');
  });

  it('another tenant cannot SELECT the instance or its steps', async () => {
    const { data: inst } = await userB.client
      .from('workflow_instances')
      .select('*')
      .eq('id', instanceAId);
    expect(inst).toEqual([]);
    const { data: steps } = await userB.client
      .from('workflow_steps')
      .select('*')
      .eq('id', stepAId);
    expect(steps).toEqual([]);
  });

  it('another tenant cannot INSERT a step into the instance', async () => {
    const { error } = await userB.client
      .from('workflow_steps')
      .insert({
        instance_id: instanceAId,
        position: 99,
        type: 'todo',
        title: 'injected',
      });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot create an instance against the victim couple', async () => {
    const { error } = await userB.client
      .from('workflow_instances')
      .insert({ user_id: userB.id, couple_id: coupleAId, name: 'cross tenant' });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot create an instance against the victim template', async () => {
    const { error } = await userB.client
      .from('workflow_instances')
      .insert({ user_id: userB.id, template_id: templateAId, name: 'cross tenant' });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot tag the victim template', async () => {
    const { data: tag, error: tagErr } = await userB.client
      .from('workflow_tags')
      .insert({ user_id: userB.id, name: 'mine', color: 'blue' })
      .select('id')
      .single();
    expect(tagErr).toBeNull();
    const { error } = await userB.client
      .from('workflow_template_tags')
      .insert({ template_id: templateAId, tag_id: tag!.id });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot read the audit log of the victim instance', async () => {
    const { data } = await userB.client
      .from('workflow_audit_log')
      .select('*')
      .eq('instance_id', instanceAId);
    expect(data).toEqual([]);
  });

  it('a personal instance cannot carry a couple, and a default must', async () => {
    // The two CHECK constraints that keep the "every couple has a default,
    // every user has one personal" invariant meaningful.
    const { error: personalErr } = await userA.client
      .from('workflow_instances')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        name: 'bad personal',
        is_personal: true,
      });
    expect(personalErr).not.toBeNull();

    const { error: defaultErr } = await userA.client
      .from('workflow_instances')
      .insert({ user_id: userA.id, name: 'bad default', is_default: true });
    expect(defaultErr).not.toBeNull();
  });
});
