// @vitest-environment node
/**
 * Middleware's shadow request log (Task 25 fix round 1). Server actions
 * that write with the service role are invisible to the database's
 * shadow trigger, so every non-GET request made under a verified shadow
 * grant leaves one `shadow_request` row. Reads, a missing grant, and a
 * grant for someone else leave none.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SHADOW_GRANT_TTL_MS, signShadowGrant } from '@/lib/auth/shadow-grant';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const MC = '22222222-2222-4222-8222-222222222222';
const SID = '44444444-4444-4444-8444-444444444444';
const SECRET = 'unit-test-service-role-key';

const insert = vi.fn();

function token(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: MC, app_metadata: { account_type: 'vendor', subscription_status: 'active' } } },
      }),
      getSession: async () => ({ data: { session: { access_token: token({ sub: MC, session_id: SID }) } } }),
    },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

async function run(method: string, path: string, cookies: Record<string, string>, headers: Record<string, string> = {}) {
  const { middleware } = await import('@/middleware');
  const request = new NextRequest(`https://app.zebri.test${path}`, { method, headers });
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return middleware(request);
}

async function grantFor(target: string): Promise<string> {
  return signShadowGrant({ adminId: ADMIN, targetUserId: target, expiresAt: Date.now() + SHADOW_GRANT_TTL_MS }, SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  insert.mockResolvedValue({ error: null });
});

describe('middleware shadow request log', () => {
  it('logs a server-action POST under a verified grant, with ids and the path only', async () => {
    await run(
      'POST',
      '/workflows?couple=Jane%20Doe',
      { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: await grantFor(MC) },
      { 'next-action': 'action-hash-1' },
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      actor_id: ADMIN,
      target_user_id: MC,
      action: 'shadow_request',
      details: { method: 'POST', path: '/workflows', next_action: 'action-hash-1', shadow_session_id: SID },
    });
  });

  it('logs a post to a public prefix too (portal upload)', async () => {
    await run('POST', '/api/portal/upload', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: await grantFor(MC) });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('does not log a GET', async () => {
    await run('GET', '/workflows', { zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: await grantFor(MC) });
    expect(insert).not.toHaveBeenCalled();
  });

  it('does not log without a grant, or with a grant for another user', async () => {
    await run('POST', '/workflows', { zebri_shadow_admin_id: ADMIN });
    await run('POST', '/workflows', {
      zebri_shadow_admin_id: ADMIN,
      zebri_shadow_grant: await grantFor('33333333-3333-4333-8333-333333333333'),
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('continues within the bound when the log write hangs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { SHADOW_REQUEST_LOG_TIMEOUT_MS } = await import('@/lib/admin/shadow-sessions');
    insert.mockReturnValue(new Promise(() => {}));
    const started = Date.now();
    const response = await run('POST', '/workflows', {
      zebri_shadow_admin_id: ADMIN,
      zebri_shadow_grant: await grantFor(MC),
    });
    const elapsed = Date.now() - started;
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(SHADOW_REQUEST_LOG_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(SHADOW_REQUEST_LOG_TIMEOUT_MS + 1000);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/timed out/));
    spy.mockRestore();
  }, 10_000);

  it('never blocks the request when the log write fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    insert.mockResolvedValue({ error: { message: 'db down' } });
    const response = await run('POST', '/workflows', {
      zebri_shadow_admin_id: ADMIN,
      zebri_shadow_grant: await grantFor(MC),
    });
    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
