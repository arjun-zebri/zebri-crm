/**
 * ZEB-2 - submit route behavior. Drives the POST handler directly with a
 * NextRequest, against local Supabase. The server Supabase client is mocked to
 * the anon client (the RPC is SECURITY DEFINER + granted to anon, exactly as a
 * public visitor hits it), and email dispatch is stubbed so the test asserts
 * routing decisions, not Resend delivery.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

import type { Json } from '@/types/database';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => anonClient()),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}));

vi.mock('@/lib/email', () => ({
  sendLeadNotificationEmail: vi.fn(async () => ({ ok: true })),
}));

// eslint-disable-next-line import/order
import { OPTIONS, POST } from '@/app/api/lead/submit/route';
// eslint-disable-next-line import/order
import { sendLeadNotificationEmail } from '@/lib/email';
// eslint-disable-next-line import/order
import { NextRequest } from 'next/server';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};
const cleanup: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)));
});

async function makeForm(
  extra: { enabled?: boolean; allowed_origins?: string[]; blocks?: Json[] } = {},
): Promise<{ user: TestUser; token: string }> {
  const { blocks, ...formExtra } = extra;
  const user = await createTestUser({}, pro);
  const admin = serviceClient();
  await admin
    .from('couple_statuses')
    .insert({ user_id: user.id, name: 'New', slug: 'new', position: 0 });
  const form = await admin
    .from('lead_capture_forms')
    .insert({ user_id: user.id, enabled: true, ...formExtra })
    .select('capture_token')
    .single();
  if (blocks) {
    await admin
      .from('user_branding')
      .upsert({ user_id: user.id, branding_blocks: { lead: blocks } });
  }
  return { user, token: form.data!.capture_token as string };
}

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/lead/submit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function preflight(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/lead/submit', {
    method: 'OPTIONS',
    headers: { 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 250) + 1}`, ...headers },
  });
}

const goodBody = (token: string) => ({
  token,
  name: 'Jamie',
  email: 'jamie@example.test',
  rendered_at: Date.now() - 5000, // well past the min-fill gate
});

describe('POST /api/lead/submit', () => {
  it('creates a couple and notifies the MC on a valid submission', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token)));
    expect(res.status).toBe(200);
    const { count } = await serviceClient()
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(1);
    expect(sendLeadNotificationEmail).toHaveBeenCalled();
  });

  it('silently accepts a honeypot hit without creating a couple', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const res = await POST(req({ ...goodBody(token), hp: 'gotcha' }));
    expect(res.status).toBe(200);
    const { count } = await serviceClient()
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(0);
  });

  // NOTE: under the new error contract (task 5) a non-UUID token folds into
  // form_not_found (404), the same as any other unrecognised token, rather
  // than a distinct 400. This assertion is updated from 400 to 404 to match;
  // see task-5-report.md for the full conflict writeup.
  it('rejects a malformed body with 404', async () => {
    const res = await POST(req({ token: 'nope', name: '', rendered_at: 0 }));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/lead/submit contract', () => {
  it('404 form_not_found for an unknown or malformed token', async () => {
    const unknown = await POST(req({ ...goodBody('00000000-0000-0000-0000-000000000000') }));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: 'form_not_found' });
    const malformed = await POST(req({ ...goodBody('not-a-uuid') }));
    expect(malformed.status).toBe(404);
  });

  it('409 form_disabled when the form is switched off', async () => {
    const { user, token } = await makeForm({ enabled: false });
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token)));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'form_disabled' });
  });

  it('403 origin_not_allowed with no CORS headers for an unlisted browser origin', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token), { origin: 'https://other.example' }));
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(await res.json()).toMatchObject({ error: 'origin_not_allowed' });
  });

  it('403 for any browser origin when the allowlist is empty, but no-Origin posts still land', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    expect((await POST(req(goodBody(token), { origin: 'https://other.example' }))).status).toBe(403);
    expect((await POST(req(goodBody(token)))).status).toBe(200);
  });

  it('200 with echoed CORS headers and source_origin for a listed origin', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token), { origin: 'https://listed.example' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://listed.example');
    expect(res.headers.get('vary')).toBe('origin');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    const couple = await serviceClient().from('couples').select('source_origin').eq('user_id', user.id).single();
    expect(couple.data?.source_origin).toBe('https://listed.example');
  });

  it('same-origin posts are always allowed and record the embed referrer origin', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const res = await POST(
      req({ ...goodBody(token), referrer: 'https://mc-site.example/contact?utm=1' }, { origin: 'http://localhost', host: 'localhost' }),
    );
    expect(res.status).toBe(200);
    const couple = await serviceClient().from('couples').select('source_origin').eq('user_id', user.id).single();
    expect(couple.data?.source_origin).toBe('https://mc-site.example');
  });

  it('ignores referrer on a cross-origin post', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    await POST(req({ ...goodBody(token), referrer: 'https://spoof.example/x' }, { origin: 'https://listed.example' }));
    const couple = await serviceClient().from('couples').select('source_origin').eq('user_id', user.id).single();
    expect(couple.data?.source_origin).toBe('https://listed.example');
  });

  it('400 validation_failed names missing required fields from the form config', async () => {
    const { user, token } = await makeForm({
      blocks: [
        { id: 'a', type: 'formField', role: 'name', inputType: 'text', label: 'Name', required: true },
        { id: 'b', type: 'formField', role: 'phone', inputType: 'tel', label: 'Phone', required: true },
        { id: 'c', type: 'formField', role: 'custom', inputType: 'text', label: 'Ceremony type', required: true },
      ],
    });
    cleanup.push(user.cleanup);
    const res = await POST(req({ token, name: 'Jamie', rendered_at: Date.now() - 5000 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'validation_failed',
      fields: { phone: 'Required', 'custom.Ceremony type': 'Required' },
    });
  });

  it('400 validation_failed with a fields map for a malformed email, readable cross-origin', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    const res = await POST(req({ ...goodBody(token), email: 'nope' }, { origin: 'https://listed.example' }));
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://listed.example');
    const body = await res.json();
    expect(body.error).toBe('validation_failed');
    expect(Object.keys(body.fields)).toContain('email');
    expect(JSON.stringify(body)).not.toContain('nope');
  });

  it('a block form with no email field accepts a submission without one', async () => {
    const { user, token } = await makeForm({
      blocks: [{ id: 'a', type: 'formField', role: 'name', inputType: 'text', label: 'Name', required: true }],
    });
    cleanup.push(user.cleanup);
    const res = await POST(req({ token, name: 'Jamie', rendered_at: Date.now() - 5000 }));
    expect(res.status).toBe(200);
  });

  it('429 returns the contract body and Retry-After', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const ip = '10.9.9.9';
    let last: Response | null = null;
    for (let i = 0; i < 6; i++) last = await POST(req(goodBody(token), { 'x-forwarded-for': ip }));
    expect(last!.status).toBe(429);
    expect(last!.headers.get('Retry-After')).toMatch(/^\d+$/);
    expect(await last!.json()).toMatchObject({ error: 'rate_limited' });
  });

  it('honeypot and fast submissions are still acknowledged with 200 and not stored', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    expect((await POST(req({ ...goodBody(token), hp: 'spam' }))).status).toBe(200);
    expect((await POST(req({ ...goodBody(token), rendered_at: Date.now() }))).status).toBe(200);
    const { count } = await serviceClient().from('couples').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    expect(count).toBe(0);
  });
});

describe('OPTIONS /api/lead/submit', () => {
  it('echoes a registered origin, stays silent for an unregistered one, and is a plain 204 with no Origin', async () => {
    const { user } = await makeForm({ allowed_origins: ['https://registered.example'] });
    cleanup.push(user.cleanup);

    const yes = await OPTIONS(preflight({ origin: 'https://registered.example' }));
    expect(yes.status).toBe(204);
    expect(yes.headers.get('access-control-allow-origin')).toBe('https://registered.example');
    expect(yes.headers.get('access-control-allow-credentials')).toBeNull();

    const no = await OPTIONS(preflight({ origin: 'https://unregistered.example' }));
    expect(no.status).toBe(204);
    expect(no.headers.get('access-control-allow-origin')).toBeNull();

    const same = await OPTIONS(preflight({ origin: 'http://localhost', host: 'localhost' }));
    expect(same.headers.get('access-control-allow-origin')).toBe('http://localhost');

    const none = await OPTIONS(preflight());
    expect(none.status).toBe(204);
    expect(none.headers.get('access-control-allow-origin')).toBeNull();
  });
});
