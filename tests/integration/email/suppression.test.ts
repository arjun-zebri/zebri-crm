import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * RLS coverage for `email_suppression` and the `couples.do_not_email`
 * opt-out flag (Phase 2, Task 10).
 *
 * `email_suppression` is owner-scoped and keyed on `(user_id, lower(email),
 * reason)`, independent of any couple row; see the migration comment in
 * `supabase/migrations/20261004000000_email_optout_and_suppression.sql` for
 * why. These tests prove:
 *
 *   1. An MC can record a suppression and read it back.
 *   2. Another MC cannot see it, delete it, or forge one under someone
 *      else's `user_id`, the security-matrix requirement for every new
 *      owned table.
 *   3. The unique key is case-insensitive on the address and per-reason,
 *      so a case-variant duplicate (a repeat webhook delivery, say) is
 *      rejected rather than silently duplicated, and clearing one reason
 *      leaves another reason for the same address untouched.
 *   4. `couples.do_not_email` defaults to false and round-trips for its
 *      owner (full couples RLS is covered by `tests/integration/rls/couples.test.ts`;
 *      this only checks the new column).
 */
describe('RLS: email_suppression tenant isolation', () => {
  let owner: TestUser
  let other: TestUser
  let rowId: string

  const activeVendor = {
    account_type: 'vendor',
    subscription_status: 'active',
    subscription_plan: 'pro',
  }

  beforeAll(async () => {
    owner = await createTestUser({}, activeVendor)
    other = await createTestUser({}, activeVendor)

    const { data, error } = await owner.client
      .from('email_suppression')
      .insert({ user_id: owner.id, email: 'couple@example.com', reason: 'unsubscribed' })
      .select('id')
      .single()
    expect(error).toBeNull()
    rowId = data!.id
  })

  afterAll(async () => {
    await owner?.cleanup()
    await other?.cleanup()
  })

  it('the owner can read their own suppression row back', async () => {
    const { data, error } = await owner.client
      .from('email_suppression')
      .select('id, email, reason')
      .eq('id', rowId)
      .single()
    expect(error).toBeNull()
    expect(data?.email).toBe('couple@example.com')
    expect(data?.reason).toBe('unsubscribed')
  })

  it('another MC cannot see it', async () => {
    const { data, error } = await other.client.from('email_suppression').select('id')
    // RLS makes rows invisible rather than erroring.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('another MC cannot delete it', async () => {
    const { data, error } = await other.client
      .from('email_suppression')
      .delete()
      .eq('id', rowId)
      .select('id')
    expect(error).toBeNull()
    // The row is outside their policy, so the delete matches nothing.
    expect(data).toEqual([])

    const { data: still } = await owner.client
      .from('email_suppression')
      .select('id')
      .eq('id', rowId)
      .single()
    expect(still?.id).toBe(rowId)
  })

  it('an MC cannot record a suppression as somebody else', async () => {
    const { error } = await other.client
      .from('email_suppression')
      .insert({ user_id: owner.id, email: 'forged@example.com', reason: 'bounced' })
    expect(error).not.toBeNull()
  })

  it('anonymous clients can neither read nor write', async () => {
    const anon = anonClient()

    const { data, error: readError } = await anon.from('email_suppression').select('id')
    expect(readError).toBeNull()
    expect(data).toEqual([])

    const { error: writeError } = await anon
      .from('email_suppression')
      .insert({ user_id: owner.id, email: 'anon@example.com', reason: 'complained' })
    expect(writeError).not.toBeNull()
  })

  it('the owner can clear their own suppression', async () => {
    const { error } = await owner.client.from('email_suppression').delete().eq('id', rowId)
    expect(error).toBeNull()

    const { data } = await owner.client.from('email_suppression').select('id').eq('id', rowId)
    expect(data).toEqual([])
  })

  it('the unique index is case-insensitive on the address, so a case-variant duplicate is rejected', async () => {
    const service = serviceClient()
    const first = await service
      .from('email_suppression')
      .insert({ user_id: owner.id, email: 'Bounce@Example.com', reason: 'bounced' })
      .select('id')
      .single()
    expect(first.error).toBeNull()

    // Same address (different case), same reason: the unique index on
    // (user_id, lower(email), reason) rejects the duplicate as a unique
    // violation, which is what lets a write path turn a repeat webhook
    // delivery or a case-variant address into a no-op instead of a second
    // row.
    const dup = await service
      .from('email_suppression')
      .insert({ user_id: owner.id, email: 'bounce@example.com', reason: 'bounced' })
    expect(dup.error?.code).toBe('23505')
  })

  it('a distinct reason for the same address is a separate row, clearable independently', async () => {
    const service = serviceClient()
    const bounced = await service
      .from('email_suppression')
      .insert({ user_id: owner.id, email: 'both-reasons@example.com', reason: 'bounced' })
      .select('id')
      .single()
    expect(bounced.error).toBeNull()
    const complained = await service
      .from('email_suppression')
      .insert({ user_id: owner.id, email: 'both-reasons@example.com', reason: 'complained' })
      .select('id')
      .single()
    expect(complained.error).toBeNull()

    // Clearing the 'bounced' row must not touch the 'complained' one for
    // the same address, since an MC clearing a stale bounce must not also
    // re-open a spam complaint.
    await service
      .from('email_suppression')
      .delete()
      .eq('user_id', owner.id)
      .eq('email', 'both-reasons@example.com')
      .eq('reason', 'bounced')

    const { data } = await service
      .from('email_suppression')
      .select('id, reason')
      .eq('user_id', owner.id)
      .eq('email', 'both-reasons@example.com')
    expect(data).toEqual([{ id: complained.data!.id, reason: 'complained' }])
  })
})

describe('couples.do_not_email', () => {
  let owner: TestUser

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    owner = await createTestUser({}, pro)
  })

  afterAll(async () => {
    await owner?.cleanup()
  })

  it('defaults to false with a null timestamp on a new couple', async () => {
    const { data, error } = await owner.client
      .from('couples')
      .insert({ user_id: owner.id, name: 'New Couple', status: 'new' })
      .select('do_not_email, do_not_email_at')
      .single()
    expect(error).toBeNull()
    expect(data?.do_not_email).toBe(false)
    expect(data?.do_not_email_at).toBeNull()
  })

  it('the owner can flip it on and read it back', async () => {
    const now = new Date().toISOString()
    const { data: inserted } = await owner.client
      .from('couples')
      .insert({ user_id: owner.id, name: 'Opted Out Couple', status: 'new' })
      .select('id')
      .single()

    const { data, error } = await owner.client
      .from('couples')
      .update({ do_not_email: true, do_not_email_at: now })
      .eq('id', inserted!.id)
      .select('do_not_email, do_not_email_at')
      .single()
    expect(error).toBeNull()
    expect(data?.do_not_email).toBe(true)
    // Postgres echoes timestamptz with a +00:00 offset rather than a
    // trailing Z, so compare as Dates rather than raw strings.
    expect(new Date(data?.do_not_email_at ?? '').getTime()).toBe(new Date(now).getTime())
  })
})

/**
 * `is_email_suppressed` folds surrounding whitespace on both sides as well
 * as case (Phase 2 fix wave, M4). The token trims at mint time, but a
 * couple row or a provider-reported address can carry a stray space, and
 * the send path must not read that as "a different address, not
 * suppressed".
 */
describe('is_email_suppressed folds whitespace as well as case', () => {
  let owner: TestUser

  beforeAll(async () => {
    owner = await createTestUser()
    const { error } = await serviceClient()
      .from('email_suppression')
      .insert([
        { user_id: owner.id, email: ' Stored.Spaced@example.com ', reason: 'unsubscribed' },
        { user_id: owner.id, email: 'clean@example.com', reason: 'unsubscribed' },
      ])
    expect(error).toBeNull()
  })

  afterAll(async () => {
    await owner?.cleanup()
  })

  it('matches a clean send address against a stored row with surrounding space', async () => {
    const { data, error } = await serviceClient().rpc('is_email_suppressed', {
      p_user_id: owner.id,
      p_email: 'stored.spaced@example.com',
    })
    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('matches a send address with surrounding space against a clean stored row', async () => {
    const { data, error } = await serviceClient().rpc('is_email_suppressed', {
      p_user_id: owner.id,
      p_email: '  Clean@Example.com\t',
    })
    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('still answers false for an address that is not stored', async () => {
    const { data, error } = await serviceClient().rpc('is_email_suppressed', {
      p_user_id: owner.id,
      p_email: 'someone-else@example.com',
    })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})
