import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  jwtSessionId,
  revokeExpiredShadowSessions,
  revokeShadowTargetSession,
} from '@/lib/admin/shadow-sessions';
import { signShadowMarker } from '@/lib/auth/shadow-grant';
import { middleware } from '@/middleware';
import type { Database } from '@/types/database';

import { runSql } from '../helpers/sql';
import { createTestUser, localSupabaseEnv, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Revoking the shadow target session (Phase 4 fix wave, review I1 and
 * I2), against the real local Auth server.
 *
 * - On exit: `exitShadow` calls `revokeShadowTargetSession` with the
 *   service role. The target's refresh token must stop working, and the
 *   MC's own sessions elsewhere must not be touched (scope local).
 * - At expiry: middleware sees the `zebri_shadow_session` marker naming
 *   this very session with no live grant, signs it out locally and sends
 *   the browser to /login. A marker naming another session does nothing.
 */
describe('shadow target session revocation', () => {
  const svc = serviceClient();
  const PASSWORD = 'test-password-12345';
  let mc: TestUser;

  /** A fresh sign-in as the MC: its own session_id and refresh token. */
  async function signIn() {
    const { url, anonKey } = localSupabaseEnv();
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: mc.email, password: PASSWORD });
    expect(error).toBeNull();
    const session = data.session!;
    return { client, session, sid: jwtSessionId(session.access_token)! };
  }

  /** Whether a refresh token still mints a new session. */
  async function refreshes(refreshToken: string): Promise<boolean> {
    const { url, anonKey } = localSupabaseEnv();
    const fresh = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await fresh.auth.refreshSession({ refresh_token: refreshToken });
    return !error && !!data.session;
  }

  function sessionRowExists(sid: string): boolean {
    return runSql(`select count(*) from auth.sessions where id = '${sid}';`) === '1';
  }

  /**
   * Sign in through @supabase/ssr so the cookies are exactly what the
   * browser would send middleware, then return them.
   */
  async function browserCookies(): Promise<{ cookies: Map<string, string>; sid: string; refreshToken: string }> {
    const { url, anonKey } = localSupabaseEnv();
    const jar = new Map<string, string>();
    const ssr = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
      },
    });
    const { data, error } = await ssr.auth.signInWithPassword({ email: mc.email, password: PASSWORD });
    expect(error).toBeNull();
    return {
      cookies: jar,
      sid: jwtSessionId(data.session!.access_token)!,
      refreshToken: data.session!.refresh_token,
    };
  }

  async function runMiddleware(cookies: Map<string, string>) {
    const request = new NextRequest('http://127.0.0.1:3000/couples');
    for (const [name, value] of cookies) request.cookies.set(name, value);
    return middleware(request);
  }

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= localSupabaseEnv().anonKey;
    mc = await createTestUser({}, { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' });
  });

  afterAll(async () => {
    await mc?.cleanup();
  });

  describe('on exit', () => {
    it('the target refresh token no longer refreshes, and the MC stays signed in elsewhere', async () => {
      const shadow = await signIn();
      const mcPhone = await signIn();

      expect(await revokeShadowTargetSession(svc, shadow.session.access_token)).toBeNull();

      expect(sessionRowExists(shadow.sid)).toBe(false);
      expect(await refreshes(shadow.session.refresh_token)).toBe(false);
      // Scope local: the MC's own session on another device is untouched.
      expect(sessionRowExists(mcPhone.sid)).toBe(true);
      expect(await refreshes(mcPhone.session.refresh_token)).toBe(true);
    });

    it('a global sign-out sent with the revoked token cannot end the MC\'s other sessions', async () => {
      const shadow = await signIn();
      const mcPhone = await signIn();
      expect(await revokeShadowTargetSession(svc, shadow.session.access_token)).toBeNull();

      await shadow.client.auth.signOut({ scope: 'global' });

      expect(await refreshes(mcPhone.session.refresh_token)).toBe(true);
    });

    it('reports a missing token instead of throwing', async () => {
      expect(await revokeShadowTargetSession(svc, null)).toBe('no target access token');
    });
  });

  // Review N2: a closed or idle shadow browser never reaches middleware
  // again, so the tick sweeps finished shadow sessions server side.
  describe('server-side sweep', () => {
    let admin: TestUser;
    beforeAll(async () => {
      admin = await createTestUser({}, { account_type: 'admin' });
    });
    afterAll(async () => {
      await svc.from('admin_audit_log').delete().eq('target_user_id', mc.id);
      await svc.from('admin_shadow_sessions').delete().eq('target_user_id', mc.id);
      await admin?.cleanup();
    });

    async function record(sid: string, state: 'expired' | 'ended' | 'open') {
      const now = Date.now();
      const H = 3600_000;
      const { error } = await svc.from('admin_shadow_sessions').insert({
        session_id: sid,
        admin_id: admin.id,
        target_user_id: mc.id,
        ...(state === 'expired'
          ? { started_at: new Date(now - 9 * H).toISOString(), expires_at: new Date(now - H).toISOString() }
          : {}),
        ...(state === 'ended' ? { ended_at: new Date(now - 60_000).toISOString() } : {}),
      });
      expect(error).toBeNull();
    }

    it('revokes an expired shadow session, stamps it, and leaves the MC\'s other session alone', async () => {
      const shadow = await signIn();
      const mcPhone = await signIn();
      await record(shadow.sid, 'expired');

      expect(await revokeExpiredShadowSessions(svc)).toBeGreaterThanOrEqual(1);

      expect(sessionRowExists(shadow.sid)).toBe(false);
      expect(await refreshes(shadow.session.refresh_token)).toBe(false);
      expect(sessionRowExists(mcPhone.sid)).toBe(true);
      expect(await refreshes(mcPhone.session.refresh_token)).toBe(true);

      const { data } = await svc
        .from('admin_shadow_sessions')
        .select('ended_at, expires_at, revoked_at')
        .eq('session_id', shadow.sid)
        .single();
      expect(data!.revoked_at).not.toBeNull();
      // The visit ended when the grant did, not when the sweep ran.
      expect(Date.parse(data!.ended_at!)).toBe(Date.parse(data!.expires_at));

      // With the session gone, the MC's own account edit is theirs alone.
      // Any account edit will do; bank keys are locked to the RPC (Task 23c).
      const { error } = await svc.auth.admin.updateUserById(mc.id, { user_metadata: { tagline: 'Mine' } });
      expect(error).toBeNull();
      const { data: rows } = await svc
        .from('admin_audit_log')
        .select('id')
        .eq('action', 'shadow_mutation')
        .eq('details->>shadow_session_id', shadow.sid);
      expect(rows).toEqual([]);

      // Idempotent: a second run finds nothing of this row to do.
      await revokeExpiredShadowSessions(svc);
      expect(sessionRowExists(mcPhone.sid)).toBe(true);
    });

    it('also revokes an exited session whose revoke on exit did not happen', async () => {
      const shadow = await signIn();
      await record(shadow.sid, 'ended');
      await revokeExpiredShadowSessions(svc);
      expect(sessionRowExists(shadow.sid)).toBe(false);
    });

    it('never touches an open shadow session', async () => {
      const shadow = await signIn();
      await record(shadow.sid, 'open');
      await revokeExpiredShadowSessions(svc);
      expect(sessionRowExists(shadow.sid)).toBe(true);
      expect(await refreshes(shadow.session.refresh_token)).toBe(true);
    });

    it('a signed-in MC cannot call the sweep', async () => {
      const rpc = mc.client.rpc as unknown as (fn: string) => Promise<{ error: unknown }>;
      expect((await rpc.call(mc.client, 'revoke_expired_shadow_sessions')).error).not.toBeNull();
    });
  });

  describe('at grant expiry (middleware)', () => {
    it('marker for this session and no grant: signed out locally and sent to /login', async () => {
      const browser = await browserCookies();
      const mcPhone = await signIn();
      browser.cookies.set(
        'zebri_shadow_session',
        await signShadowMarker({ sessionId: browser.sid, targetUserId: mc.id }, localSupabaseEnv().serviceRoleKey),
      );

      const res = await runMiddleware(browser.cookies);

      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
      expect(sessionRowExists(browser.sid)).toBe(false);
      expect(await refreshes(browser.refreshToken)).toBe(false);
      expect(await refreshes(mcPhone.session.refresh_token)).toBe(true);
    });

    it('an unsigned marker equal to the session id does nothing (review N1)', async () => {
      const browser = await browserCookies();
      browser.cookies.set('zebri_shadow_session', browser.sid);

      const res = await runMiddleware(browser.cookies);

      expect(res.headers.get('location')).toBeNull();
      expect(sessionRowExists(browser.sid)).toBe(true);
    });

    it('a marker naming another session does nothing', async () => {
      const browser = await browserCookies();
      browser.cookies.set(
        'zebri_shadow_session',
        await signShadowMarker(
          { sessionId: '55555555-5555-4555-8555-555555555555', targetUserId: mc.id },
          localSupabaseEnv().serviceRoleKey,
        ),
      );

      const res = await runMiddleware(browser.cookies);

      expect(res.headers.get('location')).toBeNull();
      expect(sessionRowExists(browser.sid)).toBe(true);
      expect(await refreshes(browser.refreshToken)).toBe(true);
    });
  });
});
