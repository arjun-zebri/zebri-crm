import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The tick takes the 200 oldest due steps. Steps on cancelled
 * workflows are due forever and can never run, so if the query
 * returns them they crowd out every real send, for every tenant.
 */
describe('advanceDueSteps budget', () => {
  const admin = serviceClient();
  let user: TestUser;
  const OLD = '2025-01-01T00:00:00.000Z';
  const NEWER = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('runs a live step behind a wall of cancelled ones', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Budget Test', status: 'Enquiry' })
      .select('id')
      .single();

    const { data: dead } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Cancelled', status: 'cancelled' })
      .select('id')
      .single();

    // 205 older-than-everything steps the engine can never run.
    const junk = Array.from({ length: 205 }, (_, i) => ({
      instance_id: dead!.id,
      position: i,
      type: 'action',
      title: 'Add a note',
      config: { actionType: 'add_note', text: 'dead' },
      status: 'pending',
      due_at: OLD,
    }));
    const { error: junkError } = await admin.from('workflow_steps').insert(junk);
    expect(junkError).toBeNull();

    const { data: live } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Live' })
      .select('id')
      .single();
    const { data: liveStep } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: live!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'real' },
        status: 'pending',
        due_at: NEWER,
      })
      .select('id')
      .single();

    await advanceDueSteps(admin);

    const { data: after } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', liveStep!.id)
      .single();
    expect(after!.status).toBe('done');
  });
});
