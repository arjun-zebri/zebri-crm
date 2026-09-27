/**
 * Unit tests for `resolveSender` (`lib/email/sender-identity`): the
 * per-MC transport resolver. The critical invariant is fail-safe
 * behaviour — anything other than a connected mailbox with usable tokens
 * falls back to the shared Zebri (Resend) address, and a lookup / decrypt
 * / refresh error never throws into the send path.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshMock = vi.fn();
vi.mock('@/lib/oauth/tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/oauth/tokens')>();
  return { ...actual, refreshAccessToken: (...a: unknown[]) => refreshMock(...a) };
});
const alertMock = vi.fn(async () => undefined);
vi.mock('@/lib/alerts', () => ({ sendAlert: (...a: unknown[]) => alertMock(...(a as [])) }));

// Fixed test key, set before the module-level encryptSecret calls below.
process.env.EMAIL_CRED_KEY = Buffer.alloc(32, 9).toString('base64');

import { encryptSecret } from '@/lib/crypto/secret-box';
import {
  DEFAULT_FROM,
  describeSender,
  resolveSender,
  resolveSenderForSend,
} from '@/lib/email/sender-identity';
import { OAuthTokenError } from '@/lib/oauth/tokens';
import type { Database } from '@/types/database';

/**
 * Supabase stub: `.select().eq().maybeSingle()` returns `row`;
 * `.update()` records its values, and its chain (any number of `.eq()`,
 * then an optional `.select()`) resolves to `updated` rows.
 */
function fakeClient(
  row: { data: unknown; error: unknown } | 'throw',
  onUpdate?: (vals: Record<string, unknown>) => void,
  updated: unknown[] = [{ user_id: 'u1' }],
): SupabaseClient<Database> {
  const chain = (): Record<string, unknown> => {
    const result = { data: updated, error: null };
    return {
      eq: () => chain(),
      select: async () => result,
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
  };
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (row === 'throw') throw new Error('socket hang up');
            return row;
          },
        }),
      }),
      update: (vals: Record<string, unknown>) => {
        onUpdate?.(vals);
        return chain();
      },
    }),
  } as unknown as SupabaseClient<Database>;
}

const future = () => new Date(Date.now() + 3_600_000).toISOString();
const past = () => new Date(Date.now() - 1_000).toISOString();

function connectedRow(overrides: Record<string, unknown> = {}) {
  return {
    email_mode: 'oauth',
    oauth_status: 'connected',
    oauth_provider: 'google',
    oauth_email: 'jane@gmail.com',
    oauth_from_name: 'Janes Weddings',
    oauth_refresh_token_encrypted: encryptSecret('refresh-tok'),
    oauth_access_token_encrypted: encryptSecret('cached-tok'),
    oauth_token_expires_at: future(),
    ...overrides,
  };
}

beforeEach(() => {
  refreshMock.mockReset();
  alertMock.mockClear();
});

describe('resolveSender', () => {
  it('uses the cached access token when still valid (no refresh)', async () => {
    const sender = await resolveSender(fakeClient({ data: connectedRow(), error: null }), 'u1', 'Biz');
    expect(sender).toEqual({
      transport: 'oauth',
      from: '"Janes Weddings" <jane@gmail.com>',
      oauth: { provider: 'google', accessToken: 'cached-tok' },
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('refreshes + persists when the access token is expired', async () => {
    refreshMock.mockResolvedValue({ accessToken: 'fresh-tok', expiresIn: 3600 });
    const updates: Record<string, unknown>[] = [];
    const row = connectedRow({ oauth_access_token_encrypted: null, oauth_token_expires_at: past() });
    const sender = await resolveSender(fakeClient({ data: row, error: null }, (v) => updates.push(v)), 'u1', 'Biz');
    expect(sender.transport).toBe('oauth');
    if (sender.transport === 'oauth') expect(sender.oauth.accessToken).toBe('fresh-tok');
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(updates[0]).toHaveProperty('oauth_access_token_encrypted');
  });

  it('falls back to Resend when not connected', async () => {
    const sender = await resolveSender(fakeClient({ data: connectedRow({ oauth_status: 'failed' }), error: null }), 'u1', 'Biz');
    expect(sender).toEqual({ transport: 'resend', from: DEFAULT_FROM });
  });

  it('falls back to Resend when email_mode is zebri', async () => {
    const sender = await resolveSender(fakeClient({ data: connectedRow({ email_mode: 'zebri' }), error: null }), 'u1', 'Biz');
    expect(sender.transport).toBe('resend');
  });

  it('falls back to Resend when no row exists', async () => {
    const sender = await resolveSender(fakeClient({ data: null, error: null }), 'u1', 'Biz');
    expect(sender.transport).toBe('resend');
  });

  it('falls back to Resend (never throws) when a token cannot be decrypted', async () => {
    const row = connectedRow({ oauth_refresh_token_encrypted: 'corrupt', oauth_access_token_encrypted: null, oauth_token_expires_at: past() });
    const sender = await resolveSender(fakeClient({ data: row, error: null }), 'u1', 'Biz');
    expect(sender.transport).toBe('resend');
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

/**
 * The step envelope's sender line (Task 29). It must name the same
 * transport and From the send would pick, from the same row, and it must
 * never refresh a token or write anything: it runs on every preview.
 */
describe('describeSender', () => {
  it('names the connected mailbox exactly as the send would, without a refresh', async () => {
    const updates: Record<string, unknown>[] = [];
    const row = connectedRow({ oauth_access_token_encrypted: null, oauth_token_expires_at: past() });
    const choice = await describeSender(fakeClient({ data: row, error: null }, (v) => updates.push(v)), 'u1', 'Biz');
    expect(choice).toEqual({ transport: 'oauth', provider: 'google', from: '"Janes Weddings" <jane@gmail.com>' });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it('agrees with resolveSender on the From header for a connected mailbox', async () => {
    const client = fakeClient({ data: connectedRow({ oauth_from_name: '' }), error: null });
    const sent = await resolveSender(client, 'u1', 'Biz Name');
    const described = await describeSender(client, 'u1', 'Biz Name');
    expect(described.from).toBe(sent.from);
    expect(described.from).toBe('"Biz Name" <jane@gmail.com>');
  });

  it('falls back to the shared Zebri address in every case the send does', async () => {
    for (const data of [
      null,
      connectedRow({ oauth_status: 'failed' }),
      connectedRow({ email_mode: 'zebri' }),
      connectedRow({ oauth_refresh_token_encrypted: null }),
    ]) {
      const choice = await describeSender(fakeClient({ data, error: null }), 'u1', 'Biz');
      expect(choice).toEqual({ transport: 'resend', from: DEFAULT_FROM });
    }
    const errored = await describeSender(fakeClient({ data: null, error: { message: 'x' } }), 'u1', 'Biz');
    expect(errored.transport).toBe('resend');
  });
});

/**
 * The send path's resolver (Phase 5 fix wave, M7). A failure to reach the
 * MC's own mailbox must never quietly become a send from the shared Zebri
 * address while the step's envelope named their mailbox:
 *
 * - transient (the settings read failed, a refresh failed for any reason
 *   but a revoked grant): `unavailable`, so the step errors;
 * - permanent (a revoked or expired grant, a token that cannot be
 *   decrypted): the connection is marked failed and alerted once, then
 *   the shared address is used, which is also what the envelope and every
 *   later send now say.
 */
describe('resolveSenderForSend', () => {
  it('is unavailable when the settings read errors', async () => {
    const res = await resolveSenderForSend(fakeClient({ data: null, error: { message: 'timeout', code: '57014' } }), 'u1', 'Biz');
    expect(res).toEqual({ status: 'unavailable', reason: 'settings_unreadable' });
  });

  it('is unavailable when the settings read throws', async () => {
    const res = await resolveSenderForSend(fakeClient('throw'), 'u1', 'Biz');
    expect(res).toEqual({ status: 'unavailable', reason: 'settings_unreadable' });
  });

  it('is unavailable, and marks nothing, when a refresh fails transiently', async () => {
    refreshMock.mockRejectedValue(new Error('fetch failed'));
    const updates: Record<string, unknown>[] = [];
    const row = connectedRow({ oauth_access_token_encrypted: null, oauth_token_expires_at: past() });
    const res = await resolveSenderForSend(fakeClient({ data: row, error: null }, (v) => updates.push(v)), 'u1', 'Biz');
    expect(res).toEqual({ status: 'unavailable', reason: 'token_refresh_failed' });
    expect(updates).toEqual([]);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('marks the mailbox failed, alerts, and uses the shared address when the grant is revoked', async () => {
    refreshMock.mockRejectedValue(new OAuthTokenError('Token has been expired or revoked.', 'invalid_grant', 400));
    const updates: Record<string, unknown>[] = [];
    const row = connectedRow({ oauth_access_token_encrypted: null, oauth_token_expires_at: past() });
    const res = await resolveSenderForSend(fakeClient({ data: row, error: null }, (v) => updates.push(v)), 'u1', 'Biz');
    expect(res).toEqual({ status: 'ok', sender: { transport: 'resend', from: DEFAULT_FROM } });
    expect(updates).toEqual([expect.objectContaining({ oauth_status: 'failed' })]);
    expect(alertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mailbox_disconnected', userId: 'u1', provider: 'google', reason: 'grant_revoked' }),
    );
  });

  it('treats a token that cannot be decrypted as permanent', async () => {
    const updates: Record<string, unknown>[] = [];
    const row = connectedRow({ oauth_access_token_encrypted: 'corrupt', oauth_token_expires_at: future() });
    const res = await resolveSenderForSend(fakeClient({ data: row, error: null }, (v) => updates.push(v)), 'u1', 'Biz');
    expect(res.status).toBe('ok');
    expect(updates).toEqual([expect.objectContaining({ oauth_status: 'failed' })]);
    expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'mailbox_disconnected', reason: 'token_unreadable' }));
  });

  it('alerts once: a mailbox another send already marked failed raises nothing more', async () => {
    const row = connectedRow({ oauth_access_token_encrypted: 'corrupt', oauth_token_expires_at: future() });
    await resolveSenderForSend(fakeClient({ data: row, error: null }, undefined, []), 'u1', 'Biz');
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('answers the connected mailbox when everything is healthy', async () => {
    const res = await resolveSenderForSend(fakeClient({ data: connectedRow(), error: null }), 'u1', 'Biz');
    expect(res.status === 'ok' && res.sender.transport).toBe('oauth');
  });

  it('keeps the old fallback for the MC-present paths (resolveSender)', async () => {
    const sender = await resolveSender(fakeClient('throw'), 'u1', 'Biz');
    expect(sender).toEqual({ transport: 'resend', from: DEFAULT_FROM });
  });
});
