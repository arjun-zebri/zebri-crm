import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { dispatchPendingEvents } from '@/lib/workflows/dispatcher';
import type { Json } from '@/types/database';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Matching bus events against apply rules.
 *
 * Each case seeds the state, ticks the dispatcher, and asserts which
 * instances exist. The dispatcher reads the whole bus, so cases scope
 * their assertions to their own couple.
 */
describe('dispatchPendingEvents', () => {
  const admin = serviceClient();
  let user: TestUser;
  let other: TestUser;

  const pro = {
    account_type: 'vendor',
    subscription_status: 'active',
    subscription_plan: 'pro',
  };

  beforeAll(async () => {
    user = await createTestUser({}, pro);
    other = await createTestUser({}, pro);
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  beforeEach(async () => {
    // Drain the bus so each case starts from a known point: other cases
    // (and other suites) leave events behind.
    await dispatchPendingEvents(admin, 5000);
  });

  afterEach(async () => {
    // Templates are per-user and active ones apply to EVERY subsequent
    // couple. Without this, case N's couple picks up cases 1..N-1's
    // templates and every count assertion drifts.
    await admin
      .from('workflow_templates')
      .update({ status: 'archived' })
      .in('user_id', [user.id, other.id]);
  });

  async function template(
    owner: TestUser,
    applyRuleType: string,
    applyRuleConfig: Json,
    status = 'active',
  ): Promise<string> {
    const { data, error } = await owner.client
      .from('workflow_templates')
      .insert({
        user_id: owner.id,
        name: `${applyRuleType} template`,
        status,
        apply_rule_type: applyRuleType,
        apply_rule_config: applyRuleConfig,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    // One step so an instance has something to snapshot.
    await owner.client.from('workflow_template_steps').insert({
      template_id: data!.id,
      position: 0,
      type: 'todo',
      title: 'Say hello',
      config: {},
    });
    return data!.id;
  }

  async function newCouple(owner: TestUser, name: string): Promise<string> {
    const { data, error } = await owner.client
      .from('couples')
      .insert({ user_id: owner.id, name })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  /** Instances for a couple that came from a template (not the default). */
  async function appliedInstances(coupleId: string) {
    const { data } = await admin
      .from('workflow_instances')
      .select('id, template_id')
      .eq('couple_id', coupleId)
      .not('template_id', 'is', null);
    return data ?? [];
  }

  it('applies an active on_couple_created template to a new couple', async () => {
    const templateId = await template(user, 'on_couple_created', {});
    const coupleId = await newCouple(user, 'Dispatch Basic');

    await dispatchPendingEvents(admin);

    const instances = await appliedInstances(coupleId);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.template_id).toBe(templateId);
  });

  it('does not apply a draft template', async () => {
    await template(user, 'on_couple_created', {}, 'draft');
    const coupleId = await newCouple(user, 'Dispatch Draft');
    await dispatchPendingEvents(admin);
    expect(await appliedInstances(coupleId)).toHaveLength(0);
  });

  it('does not apply an archived template', async () => {
    await template(user, 'on_couple_created', {}, 'archived');
    const coupleId = await newCouple(user, 'Dispatch Archived');
    await dispatchPendingEvents(admin);
    expect(await appliedInstances(coupleId)).toHaveLength(0);
  });

  it('does not apply a manual template, whatever happens on the bus', async () => {
    await template(user, 'manual', {});
    const coupleId = await newCouple(user, 'Dispatch Manual');
    await dispatchPendingEvents(admin);
    expect(await appliedInstances(coupleId)).toHaveLength(0);
  });

  it('applies every matching template, not just the first', async () => {
    const a = await template(user, 'on_couple_created', {});
    const b = await template(user, 'on_couple_created', {});
    const coupleId = await newCouple(user, 'Dispatch Two');

    await dispatchPendingEvents(admin);

    const ids = (await appliedInstances(coupleId)).map((i) => i.template_id).sort();
    expect(ids).toEqual([a, b].sort());
  });

  it('narrows on_stage_changed to the configured destination status', async () => {
    const templateId = await template(user, 'on_stage_changed', { toStatus: 'Booked' });
    const coupleId = await newCouple(user, 'Dispatch Stage');
    await dispatchPendingEvents(admin);

    await user.client.from('couples').update({ status: 'Enquiry' }).eq('id', coupleId);
    await dispatchPendingEvents(admin);
    expect(await appliedInstances(coupleId)).toHaveLength(0);

    await user.client.from('couples').update({ status: 'Booked' }).eq('id', coupleId);
    await dispatchPendingEvents(admin);
    const instances = await appliedInstances(coupleId);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.template_id).toBe(templateId);
  });

  it('is idempotent: a second tick over the same event opens no second instance', async () => {
    await template(user, 'on_couple_created', {});
    const coupleId = await newCouple(user, 'Dispatch Idempotent');

    await dispatchPendingEvents(admin);
    await dispatchPendingEvents(admin);
    await dispatchPendingEvents(admin);

    expect(await appliedInstances(coupleId)).toHaveLength(1);
  });

  it('never matches another tenant’s templates against this tenant’s events', async () => {
    await template(other, 'on_couple_created', {});
    const coupleId = await newCouple(user, 'Dispatch Cross Tenant');

    await dispatchPendingEvents(admin);

    expect(await appliedInstances(coupleId)).toHaveLength(0);
  });

  it('skips a template whose apply-rule config does not parse, and keeps going', async () => {
    // A config the rule's schema rejects must not throw: it should simply
    // not match, leaving the rest of the batch to be dispatched.
    const { data: broken } = await user.client
      .from('workflow_templates')
      .insert({
        user_id: user.id,
        name: 'Broken config',
        status: 'active',
        apply_rule_type: 'on_package_applied',
        apply_rule_config: { packageId: 'not-a-uuid' },
      })
      .select('id')
      .single();
    expect(broken).not.toBeNull();

    const good = await template(user, 'on_couple_created', {});
    const coupleId = await newCouple(user, 'Dispatch Broken Config');

    const result = await dispatchPendingEvents(admin);
    expect(result.processedEvents).toBeGreaterThan(0);

    const instances = await appliedInstances(coupleId);
    expect(instances.map((i) => i.template_id)).toEqual([good]);
  });

  it('marks the events it has handled, so a later tick does not re-run them', async () => {
    // The dual-run window is over: this engine owns `processed_at`
    // again. Without the mark, every tick would re-apply the same
    // templates and the couple would get the same emails repeatedly.
    await template(user, 'on_couple_created', {});
    const coupleId = await newCouple(user, 'Dispatch Processed At');

    await dispatchPendingEvents(admin);

    const { data } = await admin
      .from('automation_events')
      .select('processed_at')
      .eq('couple_id', coupleId);
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((e) => e.processed_at !== null)).toBe(true);
  });

  it('does not apply the same template twice across ticks', async () => {
    const templateId = await template(user, 'on_couple_created', {});
    const coupleId = await newCouple(user, 'Dispatch Twice');

    await dispatchPendingEvents(admin);
    await dispatchPendingEvents(admin);

    const instances = await appliedInstances(coupleId);
    expect(instances.filter((i) => i.template_id === templateId)).toHaveLength(1);
  });

});
