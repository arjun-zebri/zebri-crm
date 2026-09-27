// @vitest-environment node
/**
 * Middleware ends a shadow session once its grant has gone (Phase 4 fix
 * wave, review I1). The grant, admin-id and banner cookies expire at 8
 * hours; the target session does not. `zebri_shadow_session` names that
 * session: when it matches this request's JWT session_id and no grant
 * for this user verifies, middleware signs this browser out (scope
 * local), clears every shadow cookie and sends it to /login. A marker
 * naming another session does nothing, and a request without one pays
 * for no session read at all.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SHADOW_GRANT_TTL_MS, signShadowGrant, signShadowMarker } from '@/lib/auth/shadow-grant';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const MC = '22222222-2222-4222-8222-222222222222';
const SID = '44444444-4444-4444-8444-444444444444';
const OTHER_SID = '55555555-5555-4555-8555-555555555555';
const SECRET = 'unit-test-service-role-key';

const signOut = vi.fn();
const getSession = vi.fn();
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
      getSession: (...a: unknown[]) => getSession(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
  }),
}));

const sendAlert = vi.fn();
vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: (...a: unknown[]) => sendAlert(...a) }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

async function run(cookies: Record<string, string>, method = 'GET', path = '/couples') {
  const { middleware } = await import('@/middleware');
  const request = new NextRequest(`https://app.zebri.test${path}`, { method });
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return middleware(request);
}

/** The marker enterShadow sets: signed with this server's key. */
async function mark(sessionId = SID, target = MC, secret = SECRET): Promise<string> {
  return signShadowMarker({ sessionId, targetUserId: target }, secret);
}

async function grant(expiresAt = Date.now() + SHADOW_GRANT_TTL_MS, target = MC): Promise<string> {
  return signShadowGrant({ adminId: ADMIN, targetUserId: target, expiresAt }, SECRET);
}

/** Cookie names the response expires (Set-Cookie with an empty value / past date). */
function cleared(res: Response): string[] {
  return res.headers
    .getSetCookie()
    .filter((c) => /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c))
    .map((c) => c.split('=')[0]!);
}

const SHADOW_COOKIES = ['zebri_shadow_admin_id', 'zebri_is_shadowing', 'zebri_shadow_grant', 'zebri_shadow_session'];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  getSession.mockResolvedValue({ data: { session: { access_token: token({ sub: MC, session_id: SID }) } } });
  signOut.mockResolvedValue({ error: null });
  insert.mockResolvedValue({ error: null });
  sendAlert.mockResolvedValue(undefined);
});

describe('middleware shadow expiry', () => {
  it('marker for this session and no grant: local sign-out, shadow cookies cleared, /login', async () => {
    const res = await run({ zebri_shadow_session: await mark() });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    expect(cleared(res)).toEqual(expect.arrayContaining(SHADOW_COOKIES));
  });

  it('marker for this session and an expired grant: same', async () => {
    const res = await run({
      zebri_shadow_session: await mark(),
      zebri_shadow_admin_id: ADMIN,
      zebri_shadow_grant: await grant(Date.now() - 1),
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('marker for this session and a grant for someone else: same', async () => {
    const res = await run({
      zebri_shadow_session: await mark(),
      zebri_shadow_grant: await grant(undefined, '33333333-3333-4333-8333-333333333333'),
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('marker for this session and a live grant: the visit carries on', async () => {
    const res = await run({ zebri_shadow_session: await mark(), zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: await grant() });
    expect(signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  // Review N1: only a marker this server signed counts. The session id is
  // readable by whoever holds the session, so a bare or forged one is inert.
  it('an unsigned marker equal to this session id does nothing', async () => {
    const res = await run({ zebri_shadow_session: SID });
    expect(signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(cleared(res)).toEqual([]);
  });

  it('a marker with a tampered signature does nothing', async () => {
    const good = await mark();
    const tampered = `${good.slice(0, -1)}${good.endsWith('0') ? '1' : '0'}`;
    const res = await run({ zebri_shadow_session: tampered });
    expect(signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('a marker signed with another key, or for another target, does nothing', async () => {
    await run({ zebri_shadow_session: await mark(SID, MC, 'another-servers-key') });
    await run({ zebri_shadow_session: await mark(SID, '33333333-3333-4333-8333-333333333333') });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('a marker naming another session does nothing', async () => {
    const res = await run({ zebri_shadow_session: await mark(OTHER_SID) });
    expect(signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(cleared(res)).toEqual([]);
  });

  it('no marker: no session read and no sign-out (normal users pay nothing)', async () => {
    const res = await run({});
    expect(getSession).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('also ends it on a public route and on a POST', async () => {
    const res = await run({ zebri_shadow_session: await mark() }, 'POST', '/api/portal/upload');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    // No grant, so nothing is logged as the admin.
    expect(insert).not.toHaveBeenCalled();
  });

  it('when Auth cannot revoke, it still drops the session cookies so the browser leaves', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    signOut.mockResolvedValue({ error: { message: 'auth down' } });
    const res = await run({ zebri_shadow_session: await mark(), 'sb-127-auth-token': 'base64-x', unrelated: '1' });

    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    expect(cleared(res)).toEqual(expect.arrayContaining([...SHADOW_COOKIES, 'sb-127-auth-token']));
    expect(cleared(res)).not.toContain('unrelated');
    expect(spy).toHaveBeenCalled();
    // Review N3: the session is still live on the server, so Slack hears
    // about it, with ids only.
    expect(sendAlert).toHaveBeenCalledWith({
      type: 'app_error',
      severity: 'error',
      source: 'middleware.shadowExpiry',
      message: `expired shadow session ${SID} of user ${MC} not revoked; the tick sweep will retry`,
    });
    spy.mockRestore();
  });

  it('alerts a failed revoke once per session per hour', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    signOut.mockResolvedValue({ error: { message: 'auth down' } });
    const sid = '66666666-6666-4666-8666-666666666666';
    getSession.mockResolvedValue({ data: { session: { access_token: token({ sub: MC, session_id: sid }) } } });
    await run({ zebri_shadow_session: await mark(sid) });
    await run({ zebri_shadow_session: await mark(sid) });
    expect(sendAlert).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('does not alert when the revoke succeeds', async () => {
    await run({ zebri_shadow_session: await mark() });
    expect(sendAlert).not.toHaveBeenCalled();
  });
});

// Review M1: the request log is bound to the session when a marker is present.
describe('middleware shadow request log and the marker', () => {
  it('logs under a live grant when the marker matches', async () => {
    await run({ zebri_shadow_session: await mark(), zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: await grant() }, 'POST', '/workflows');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('does not log when the marker names another session', async () => {
    await run(
      { zebri_shadow_session: await mark(OTHER_SID), zebri_shadow_admin_id: ADMIN, zebri_shadow_grant: await grant() },
      'POST',
      '/workflows',
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
