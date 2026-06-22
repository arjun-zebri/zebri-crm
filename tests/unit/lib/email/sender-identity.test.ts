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
vi.mock('@/lib/oauth/tokens', () => ({ refreshAccessToken: (...a: unknown[]) => refreshMock(...a) }));

// Fixed test key, set before the module-level encryptSecret calls below.
process.env.EMAIL_CRED_KEY = Buffer.alloc(32, 9).toString('base64');

import { encryptSecret } from '@/lib/crypto/secret-box';
import { DEFAULT_FROM, resolveSender } from '@/lib/email/sender-identity';
import type { Database } from '@/types/database';

/** Supabase stub: `.select().eq().maybeSingle()` returns `row`; `.update().eq()` records. */
function fakeClient(
  row: { data: unknown; error: unknown },
  onUpdate?: (vals: Record<string, unknown>) => void,
): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => row }) }),
      update: (vals: Record<string, unknown>) => {
        onUpdate?.(vals);
        return { eq: async () => ({ error: null }) };
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

beforeEach(() => refreshMock.mockReset());

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
