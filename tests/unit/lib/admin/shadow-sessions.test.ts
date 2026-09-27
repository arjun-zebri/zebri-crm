// @vitest-environment node
/**
 * Shadow-session record helpers (Task 25). The trigger-side behaviour is
 * proven against the real database in
 * tests/integration/admin/shadow-mutation-log.test.ts; this covers the
 * token parsing and the exact writes the server actions make.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  endShadowSession,
  jwtSessionId,
  logShadowRequest,
  startShadowSession,
} from '@/lib/admin/shadow-sessions';
import { SHADOW_GRANT_TTL_MS } from '@/lib/auth/shadow-grant';
import type { Database } from '@/types/database';

const SID = '44444444-4444-4444-8444-444444444444';
const jwt = (payload: Record<string, unknown>) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

/** A fluent query-builder stand-in that records every call. */
function fakeClient(error: { message: string } | null = null, data: unknown = [{ id: 'row' }]) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const name of ['insert', 'update', 'eq', 'is', 'select']) {
    builder[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: error ? null : data, error });
  const client = { from: vi.fn(() => builder) };
  return { client: client as unknown as SupabaseClient<Database>, calls, from: client.from };
}

describe('jwtSessionId', () => {
  it('reads a uuid session_id claim', () => {
    expect(jwtSessionId(jwt({ session_id: SID }))).toBe(SID);
  });

  it('returns null for a missing token, a missing claim or a non-uuid claim', () => {
    expect(jwtSessionId(undefined)).toBeNull();
    expect(jwtSessionId('not-a-jwt')).toBeNull();
    expect(jwtSessionId(jwt({ aal: 'aal1' }))).toBeNull();
    expect(jwtSessionId(jwt({ session_id: "x' or 1=1" }))).toBeNull();
  });
});

describe('startShadowSession', () => {
  it('inserts the session with an expiry equal to the grant TTL', async () => {
    const { client, calls, from } = fakeClient();
    const now = new Date('2026-09-25T00:00:00.000Z');

    const err = await startShadowSession(client, { sessionId: SID, adminId: 'a', targetUserId: 't', now });

    expect(err).toBeNull();
    expect(from).toHaveBeenCalledWith('admin_shadow_sessions');
    expect(calls[0]).toEqual([
      'insert',
      [
        {
          session_id: SID,
          admin_id: 'a',
          target_user_id: 't',
          started_at: now.toISOString(),
          expires_at: new Date(now.getTime() + SHADOW_GRANT_TTL_MS).toISOString(),
        },
      ],
    ]);
  });

  it('returns the database error message', async () => {
    const { client } = fakeClient({ message: 'duplicate key' });
    expect(await startShadowSession(client, { sessionId: SID, adminId: 'a', targetUserId: 't' })).toBe(
      'duplicate key',
    );
  });
});

describe('endShadowSession', () => {
  it('closes only the open row of this admin, target and session', async () => {
    const { client, calls } = fakeClient();
    await endShadowSession(client, { sessionId: SID, adminId: 'a', targetUserId: 't' });
    expect(calls.slice(1)).toEqual([
      ['eq', ['admin_id', 'a']],
      ['eq', ['target_user_id', 't']],
      ['is', ['ended_at', null]],
      ['eq', ['session_id', SID]],
      ['select', ['id']],
    ]);
  });

  it('closes every open row of the pair when the session id is unknown', async () => {
    const { client, calls } = fakeClient();
    await endShadowSession(client, { sessionId: null, adminId: 'a', targetUserId: 't' });
    expect(calls.map(([name]) => name)).toEqual(['update', 'eq', 'eq', 'is', 'select']);
  });

  it('reports a close that matched no row, so the caller alerts', async () => {
    const { client } = fakeClient(null, []);
    expect(await endShadowSession(client, { sessionId: SID, adminId: 'a', targetUserId: 't' })).toBe(
      'no open shadow session matched',
    );
  });
});

describe('logShadowRequest', () => {
  it('writes one shadow_request row with ids and the path only', async () => {
    const { client, calls, from } = fakeClient();
    const err = await logShadowRequest(client, {
      adminId: 'a',
      targetUserId: 't',
      method: 'POST',
      path: '/workflows',
      nextAction: 'abc123',
      sessionId: SID,
    });
    expect(err).toBeNull();
    expect(from).toHaveBeenCalledWith('admin_audit_log');
    expect(calls[0]).toEqual([
      'insert',
      [
        {
          actor_id: 'a',
          target_user_id: 't',
          action: 'shadow_request',
          details: { method: 'POST', path: '/workflows', next_action: 'abc123', shadow_session_id: SID },
        },
      ],
    ]);
  });
});
