import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyTemplate } from '@/lib/workflows/instantiate';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Two bus events for one couple used to produce two enrolments, and so
 * two of every email in the workflow.
 */
describe('applyTemplate dedupe', () => {
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

  async function fixture(): Promise<{ coupleId: string; templateId: string }> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Dedupe Test', status: 'Enquiry' })
      .select('id')
      .single();
    // A draft through the MC's client, switched on with the service role:
    // a client role cannot make a template active (activation lock,
    // 20261023600000).
    const { data: template } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Welcome', status: 'draft', apply_rule_type: 'manual' })
      .select('id')
      .single();
    const { error: onErr } = await admin
      .from('workflow_templates')
      .update({ status: 'active' })
      .eq('id', template!.id);
    expect(onErr).toBeNull();
    return { coupleId: couple!.id, templateId: template!.id };
  }

  it('creates one instance when many applies race', async () => {
    const { coupleId, templateId } = await fixture();

    // Eight racers, not two. Two calls only actually overlap about four
    // times in five, so a regression in the dedupe key or the unique
    // violation handling had a real chance of going green in CI. More
    // racers drives the odds of no overlap at all close to zero without
    // teaching the test anything about how the fix works.
    await Promise.all(
      Array.from({ length: 8 }, () =>
        applyTemplate(admin, { userId: user.id, coupleId, templateId, dedupe: true }),
      ),
    );

    const { data: instances } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('template_id', templateId)
      .neq('status', 'cancelled');
    expect(instances ?? []).toHaveLength(1);
  });

  it('allows a second enrolment after the first is cancelled', async () => {
    const { coupleId, templateId } = await fixture();

    const first = await applyTemplate(admin, {
      userId: user.id, coupleId, templateId, dedupe: true,
    });
    expect('instanceId' in first).toBe(true);

    await admin
      .from('workflow_instances')
      .update({ status: 'cancelled' })
      .eq('couple_id', coupleId)
      .eq('template_id', templateId);

    const second = await applyTemplate(admin, {
      userId: user.id, coupleId, templateId, dedupe: true,
    });
    expect('instanceId' in second).toBe(true);
  });
});
