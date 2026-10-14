import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerError = vi.fn();
vi.mock('@/lib/alerts/logger', () => ({ logger: { error: (...args: unknown[]) => loggerError(...args) } }));
vi.mock('@/lib/crypto/secret-box', () => ({ decryptSecret: (s: string) => `plain:${s}` }));
vi.mock('@/lib/outreach/gmail/client', () => ({ refreshOutreachToken: vi.fn() }));

import { disconnectMailbox, revokeGoogleGrant } from '@/lib/outreach/services/settings';
import type { AdminDb } from '@/lib/outreach/types';

/** A stand-in for the admin client: just the calls disconnect makes, in order. */
function fakeDb(row: { refresh_token_enc: string } | null, deleteError: string | null, calls: string[]): AdminDb {
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.push(`${table}.read`);
            return { data: row, error: null };
          },
        }),
      }),
      delete: () => ({
        eq: async () => {
          calls.push(`${table}.delete`);
          return { error: deleteError ? { message: deleteError } : null };
        },
      }),
      update: () => ({
        eq: async () => {
          calls.push(`${table}.update`);
          return { error: null };
        },
      }),
    }),
  };
  return db as unknown as AdminDb;
}

describe('disconnectMailbox', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    loggerError.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('revokes the Google grant before deleting the token row', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const calls: string[] = [];
    await disconnectMailbox(fakeDb({ refresh_token_enc: 'enc' }, null, calls));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/revoke');
    expect(String(init.body)).toContain('token=plain%3Aenc');
    expect(calls).toEqual(['outreach_mailbox.read', 'outreach_mailbox.delete', 'outreach_settings.update']);
  });

  it('still disconnects, and logs, when Google cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const calls: string[] = [];
    await expect(disconnectMailbox(fakeDb({ refresh_token_enc: 'enc' }, null, calls))).resolves.toBeUndefined();
    expect(calls).toContain('outreach_mailbox.delete');
    expect(loggerError).toHaveBeenCalledOnce();
  });

  it('skips the revoke when no mailbox is connected', async () => {
    const calls: string[] = [];
    await disconnectMailbox(fakeDb(null, null, calls));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('revokeGoogleGrant', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('treats 400 (already revoked) as success', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
    await expect(revokeGoogleGrant('t')).resolves.toBeUndefined();
  });

  it('throws on a server error so the caller can log it', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(revokeGoogleGrant('t')).rejects.toThrow('HTTP 500');
  });
});
