/**
 * `listUsersWithSubscription` last-seen merge (`lib/admin/admin-analytics`).
 *
 * The contract: the admin Users table's "Last seen" value is the newest of
 * the user's `auth.sessions` activity (via the `admin_user_last_seen()` RPC)
 * and their `auth.users.last_sign_in_at`.
 *
 * Both halves matter. Session activity is the only thing that moves for a
 * permanently-logged-in user, because GoTrue stamps `last_sign_in_at` solely
 * on a real credential exchange. But signing out DELETES the session rows,
 * so `last_sign_in_at` is the only surviving evidence for a logged-out user.
 * Taking the newest of the two is correct in both directions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let authUsers: Array<Record<string, unknown>> = []
let rpcRows: Array<{ user_id: string; last_seen: string | null }> = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { listUsers: () => Promise.resolve({ data: { users: authUsers }, error: null }) } },
    rpc: () => Promise.resolve({ data: rpcRows, error: null }),
  }),
}))

import { listUsersWithSubscription } from '@/lib/admin/admin-analytics'

function authUser(id: string, lastSignIn: string | null) {
  return {
    id,
    email: `${id}@example.com`,
    app_metadata: { account_type: 'vendor' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    last_sign_in_at: lastSignIn,
  }
}

const seen = async (id: string) =>
  (await listUsersWithSubscription()).find((u) => u.id === id)?.last_seen_at

beforeEach(() => {
  authUsers = []
  rpcRows = []
})

describe('listUsersWithSubscription -> last_seen_at', () => {
  it('uses session activity when it is newer than the sign-in', async () => {
    // The bug that started this: signed in weeks ago, on the app yesterday.
    authUsers = [authUser('sarah', '2026-07-23T00:16:35.000Z')]
    rpcRows = [{ user_id: 'sarah', last_seen: '2026-08-20T09:55:13.000Z' }]
    expect(await seen('sarah')).toBe('2026-08-20T09:55:13.000Z')
  })

  it('falls back to the sign-in when the user signed out (sessions deleted)', async () => {
    authUsers = [authUser('loggedout', '2026-06-01T00:00:00.000Z')]
    rpcRows = []
    expect(await seen('loggedout')).toBe('2026-06-01T00:00:00.000Z')
  })

  it('never reports older than the sign-in, even with a stale session row', async () => {
    authUsers = [authUser('mixed', '2026-08-10T00:00:00.000Z')]
    rpcRows = [{ user_id: 'mixed', last_seen: '2026-07-01T00:00:00.000Z' }]
    expect(await seen('mixed')).toBe('2026-08-10T00:00:00.000Z')
  })

  it('is null only when the user has neither a session nor a sign-in', async () => {
    authUsers = [authUser('ghost', null)]
    rpcRows = []
    expect(await seen('ghost')).toBeNull()
  })

  it('still reports session activity for a user who never signed in', async () => {
    authUsers = [authUser('nosignin', null)]
    rpcRows = [{ user_id: 'nosignin', last_seen: '2026-08-19T02:22:13.000Z' }]
    expect(await seen('nosignin')).toBe('2026-08-19T02:22:13.000Z')
  })

  it('keeps each user matched to their own session row', async () => {
    authUsers = [authUser('a', null), authUser('b', null)]
    rpcRows = [
      { user_id: 'b', last_seen: '2026-08-02T00:00:00.000Z' },
      { user_id: 'a', last_seen: '2026-08-01T00:00:00.000Z' },
    ]
    expect(await seen('a')).toBe('2026-08-01T00:00:00.000Z')
    expect(await seen('b')).toBe('2026-08-02T00:00:00.000Z')
  })

  it('ignores a null last_seen from the RPC', async () => {
    authUsers = [authUser('nullrow', '2026-05-05T00:00:00.000Z')]
    rpcRows = [{ user_id: 'nullrow', last_seen: null }]
    expect(await seen('nullrow')).toBe('2026-05-05T00:00:00.000Z')
  })
})
