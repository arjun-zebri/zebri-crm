/**
 * Public form-config endpoint. Asserts the exact key set of the response so a
 * later change cannot leak account data by accident.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

import type { Json } from '@/types/database';

import { createTestUser, serviceClient } from '../helpers/supabase';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}));

// eslint-disable-next-line import/order
import { GET, OPTIONS } from '@/app/api/lead/config/route';
// eslint-disable-next-line import/order
import { NextRequest } from 'next/server';

const cleanup: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)));
});

async function makeForm(extra: { enabled?: boolean; blocks?: Json[] } = {}) {
  const user = await createTestUser({}, { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' });
  cleanup.push(user.cleanup);
  const admin = serviceClient();
  const form = await admin
    .from('lead_capture_forms')
    .insert({ user_id: user.id, enabled: extra.enabled ?? true, allowed_origins: ['https://secret.example'] })
    .select('capture_token')
    .single();
  if (extra.blocks) await admin.from('user_branding').upsert({ user_id: user.id, branding_blocks: { lead: extra.blocks } });
  return { user, token: form.data!.capture_token as string };
}

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/lead/config${query}`, { headers: { 'x-forwarded-for': `10.2.0.${Math.floor(Math.random() * 250) + 1}` } }));

describe('GET /api/lead/config', () => {
  it('returns only enabled + fields, with wildcard CORS and a short cache', async () => {
    const { token } = await makeForm({
      blocks: [
        { id: 'a', type: 'formField', role: 'name', inputType: 'text', label: 'Name', required: true },
        { id: 'h', type: 'formField', role: 'phone', inputType: 'tel', label: 'Phone', required: false, hidden: true },
      ],
    });
    const res = await get(`?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['enabled', 'fields']);
    expect(body.fields).toEqual([
      { id: 'a', key: 'name', role: 'name', label: 'Name', required: true, inputType: 'text', placeholder: '', options: [] },
    ]);
    expect(JSON.stringify(body)).not.toContain('secret.example');
  });

  it('returns the fixed field set when the MC has not customised the form', async () => {
    const { token } = await makeForm();
    const body = await (await get(`?token=${token}`)).json();
    expect(body.fields.map((f: { key: string }) => f.key)).toContain('partner_name');
  });

  it('reports a disabled form with no fields', async () => {
    const { token } = await makeForm({ enabled: false });
    const res = await get(`?token=${token}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false, fields: [] });
  });

  it('404s for an unknown, malformed or missing token', async () => {
    expect((await get('?token=00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await get('?token=nope')).status).toBe(404);
    expect((await get('')).status).toBe(404);
    expect(await (await get('')).json()).toMatchObject({ error: 'form_not_found' });
  });

  it('answers preflights with wildcard CORS', async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
