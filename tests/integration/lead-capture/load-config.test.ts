/**
 * Lead form config loader against local Supabase. The admin client is
 * redirected at the local service-role client.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient } from '../helpers/supabase';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}));

// eslint-disable-next-line import/order
import { isOriginRegistered, loadLeadFormConfig } from '@/lib/lead-capture/load-config';

const cleanup: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)));
});

async function makeForm(extra: { enabled?: boolean; allowed_origins?: string[] } = {}) {
  const user = await createTestUser({}, { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' });
  cleanup.push(user.cleanup);
  const form = await serviceClient()
    .from('lead_capture_forms')
    .insert({ user_id: user.id, enabled: true, ...extra })
    .select('capture_token')
    .single();
  return { user, token: form.data!.capture_token as string };
}

describe('loadLeadFormConfig', () => {
  it('returns not found for an unknown token', async () => {
    expect(await loadLeadFormConfig('00000000-0000-0000-0000-000000000000')).toEqual({ found: false });
  });

  it('returns enabled, allowlist and a null tree when branding has no lead blocks', async () => {
    const { token } = await makeForm({ allowed_origins: ['https://a.com'] });
    const config = await loadLeadFormConfig(token);
    expect(config).toEqual({ found: true, enabled: true, allowedOrigins: ['https://a.com'], blocks: null });
  });

  it('returns the saved lead block tree', async () => {
    const { user, token } = await makeForm();
    const blocks = [{ id: 'f1', type: 'formField', role: 'email', inputType: 'email', label: 'Email', required: true }];
    await serviceClient().from('user_branding').upsert({ user_id: user.id, branding_blocks: { lead: blocks } });
    const config = await loadLeadFormConfig(token);
    expect(config.found && config.blocks).toEqual(blocks);
  });
});

describe('isOriginRegistered', () => {
  it('is true only for an origin saved on some form', async () => {
    await makeForm({ allowed_origins: ['https://registered.example'] });
    expect(await isOriginRegistered('https://registered.example')).toBe(true);
    expect(await isOriginRegistered('https://nobody.example')).toBe(false);
  });
});
