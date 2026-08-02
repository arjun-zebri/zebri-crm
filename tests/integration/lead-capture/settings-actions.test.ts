/**
 * ZEB-2 - Lead Capture settings-action integration tests against local
 * Supabase. The server Supabase client is mocked to the active test user's
 * RLS-scoped client, so the actions run exactly as they would for a signed-in
 * MC.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser)
      throw new Error('No active test user - set `activeUser` before calling');
    return activeUser.client;
  }),
}));

// eslint-disable-next-line import/order
import {
  ensureLeadForm,
  saveLeadCaptureSettings,
} from '@/app/(dashboard)/settings/lead-capture/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

const cleanup: Array<() => Promise<void>> = [];
afterEach(() => {
  activeUser = null;
});

describe('ensureLeadForm', () => {
  it('creates exactly one row and returns its token', async () => {
    const user = await createTestUser({}, pro);
    cleanup.push(user.cleanup);
    activeUser = user;

    const state = await ensureLeadForm();
    expect(state.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.enabled).toBe(true);

    const { count } = await serviceClient()
      .from('lead_capture_forms')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(1);
  });

  it('is idempotent - a second call returns the same token', async () => {
    const user = await createTestUser({}, pro);
    cleanup.push(user.cleanup);
    activeUser = user;

    const first = await ensureLeadForm();
    const second = await ensureLeadForm();
    expect(second.token).toBe(first.token);

    const { count } = await serviceClient()
      .from('lead_capture_forms')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(1);
  });
});

describe('saveLeadCaptureSettings', () => {
  it('persists the enable toggle and target status', async () => {
    const user = await createTestUser({}, pro);
    cleanup.push(user.cleanup);
    activeUser = user;
    await ensureLeadForm();

    const res = await saveLeadCaptureSettings({
      enabled: false,
      targetStatusSlug: 'booked',
    });
    expect(res.ok).toBe(true);

    const { data } = await serviceClient()
      .from('lead_capture_forms')
      .select('enabled, target_status_slug')
      .eq('user_id', user.id)
      .single();
    expect(data?.enabled).toBe(false);
    expect(data?.target_status_slug).toBe('booked');
  });
});

// Registered here so afterEach clears activeUser before teardown runs.
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((f) => f().catch(() => undefined)));
});
