/**
 * ZEB-2 - submit route behavior. Drives the POST handler directly with a
 * NextRequest, against local Supabase. The server Supabase client is mocked to
 * the anon client (the RPC is SECURITY DEFINER + granted to anon, exactly as a
 * public visitor hits it), and email dispatch is stubbed so the test asserts
 * routing decisions, not Resend delivery.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => anonClient()),
}));

vi.mock('@/lib/email', () => ({
  sendLeadNotificationEmail: vi.fn(async () => ({ ok: true })),
}));

// eslint-disable-next-line import/order
import { POST } from '@/app/api/lead/submit/route';
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

async function makeForm(): Promise<{ user: TestUser; token: string }> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();
  await admin
    .from('couple_statuses')
    .insert({ user_id: user.id, name: 'New', slug: 'new', position: 0 });
  const form = await admin
    .from('lead_capture_forms')
    .insert({ user_id: user.id, enabled: true })
    .select('capture_token')
    .single();
  return { user, token: form.data!.capture_token as string };
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/lead/submit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: JSON.stringify(body),
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

  it('rejects a malformed body with 400', async () => {
    const res = await POST(req({ token: 'nope', name: '', rendered_at: 0 }));
    expect(res.status).toBe(400);
  });
});
