/**
 * Integration test for the vows feature (P3) against the local Supabase
 * stack: the token-gated `save_portal_vow` RPC inserts a vow, the DB
 * trigger emits `couple_completed_vows`, the dispatcher opens a run, and
 * the `vows` table enforces owner-scoped RLS.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { dispatchPendingEvents } from '@/lib/automations/dispatcher'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

/**
 * Seed a couple with the portal enabled; return id + both partner tokens.
 * `token` is the primary partner's link (`portal_token`, viewer 'primary');
 * `secondaryToken` is the secondary partner's link (viewer 'spouse').
 */
async function seedCouple(
  user: TestUser,
): Promise<{ id: string; token: string; secondaryToken: string }> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: user.id, name: 'Couple', email: 'c@zebri.test', primary_name: 'Alex', secondary_name: 'Sam', status: 'booked', portal_token_enabled: true } as never)
    .select('id, portal_token, secondary_portal_token')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  const row = data as { id: string; portal_token: string; secondary_portal_token: string }
  return { id: row.id, token: row.portal_token, secondaryToken: row.secondary_portal_token }
}

async function seedAutomation(user: TestUser, who?: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: 'couple_completed_vows',
      trigger_type: 'couple_completed_vows',
      trigger_config: who ? { who } : {},
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

async function vowEventsFor(vowId: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, payload, couple_id')
    .eq('source_table', 'vows')
    .eq('source_id', vowId)
    .eq('event_type', 'couple_completed_vows')
  return (data ?? []) as Array<{ id: string; payload: Record<string, unknown>; couple_id: string | null }>
}

describe('vows feature (P3)', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('save_portal_vow inserts a vow and emits couple_completed_vows', async () => {
    const couple = await seedCouple(user)
    const automationId = await seedAutomation(user)

    const vowId = crypto.randomUUID()
    // No `p_who` — the RPC derives it from the token. The primary
    // partner's `portal_token` yields who='primary'.
    const { error } = await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.token,
      p_id: vowId,
      p_content: 'I promise to always pick the restaurant.',
    } as never)
    expect(error).toBeNull()

    // Vow row persisted under the right owner.
    const { data: vow } = await serviceClient()
      .from('vows' as never)
      .select('id, user_id, couple_id, who, content')
      .eq('id', vowId)
      .single()
    const v = vow as unknown as { user_id: string; couple_id: string; who: string; content: string }
    expect(v.user_id).toBe(user.id)
    expect(v.couple_id).toBe(couple.id)
    expect(v.who).toBe('primary')

    // Automation event emitted by the trigger.
    const events = await vowEventsFor(vowId)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.who).toBe('primary')
    expect(events[0]!.couple_id).toBe(couple.id)

    // Dispatcher opens a run.
    await dispatchPendingEvents(serviceClient())
    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('the `who` filter narrows which automations fire', async () => {
    const couple = await seedCouple(user)
    const spouseOnly = await seedAutomation(user, 'spouse')

    const vowId = crypto.randomUUID()
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.token, p_id: vowId, p_content: 'x',
    } as never)
    await dispatchPendingEvents(serviceClient())

    // A 'primary' vow must not open a run on a 'spouse'-filtered automation.
    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id')
      .eq('automation_id', spouseOnly)
    expect(runs ?? []).toHaveLength(0)
  })

  it('rejects an invalid portal token', async () => {
    const { error } = await serviceClient().rpc('save_portal_vow' as never, {
      p_token: crypto.randomUUID(), p_id: crypto.randomUUID(), p_content: 'x',
    } as never)
    expect(error).not.toBeNull()
  })

  it('enforces owner-scoped RLS on the vows table', async () => {
    const couple = await seedCouple(user)
    const vowId = crypto.randomUUID()
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.token, p_id: vowId, p_content: 'secret',
    } as never)

    const otherUser = await createTestUser({}, { account_type: 'vendor' })
    try {
      const { data } = await otherUser.client
        .from('vows' as never)
        .select('id')
        .eq('id', vowId)
      expect(data ?? []).toEqual([])
    } finally {
      await otherUser.cleanup()
    }
  })

  it('logs a couple revision per portal save; revisions are owner-scoped', async () => {
    const couple = await seedCouple(user)
    const vowId = crypto.randomUUID()
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.token, p_id: vowId, p_content: 'v1',
    } as never)
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.token, p_id: vowId, p_content: 'v2',
    } as never)

    const { data: revs } = await serviceClient()
      .from('vow_revisions' as never)
      .select('content, author')
      .eq('vow_id', vowId)
      .order('created_at', { ascending: true })
    const list = (revs ?? []) as Array<{ content: string; author: string }>
    expect(list).toHaveLength(2)
    expect(list[0]!.content).toBe('v1')
    expect(list.every((r) => r.author === 'couple')).toBe(true)

    const otherUser = await createTestUser({}, { account_type: 'vendor' })
    try {
      const { data } = await otherUser.client
        .from('vow_revisions' as never)
        .select('id')
        .eq('vow_id', vowId)
      expect(data ?? []).toEqual([])
    } finally {
      await otherUser.cleanup()
    }
  })

  it('derives `who` from the token: each partner writes their own vow', async () => {
    const couple = await seedCouple(user)

    // Primary link → who='primary'; secondary link → who='spouse'.
    const primaryId = crypto.randomUUID()
    const spouseId = crypto.randomUUID()
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.token, p_id: primaryId, p_content: 'PRIMARY VOW',
    } as never)
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.secondaryToken, p_id: spouseId, p_content: 'SPOUSE VOW',
    } as never)

    const { data: rows } = await serviceClient()
      .from('vows' as never)
      .select('who, content')
      .eq('couple_id', couple.id)
    const byWho = Object.fromEntries(
      ((rows ?? []) as Array<{ who: string; content: string }>).map((r) => [r.who, r.content]),
    )
    expect(byWho.primary).toBe('PRIMARY VOW')
    expect(byWho.spouse).toBe('SPOUSE VOW')
  })

  it('get_portal_data returns ONLY the viewer\'s own vow (privacy)', async () => {
    const couple = await seedCouple(user)
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.token, p_id: crypto.randomUUID(), p_content: 'PRIMARY VOW',
    } as never)
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.secondaryToken, p_id: crypto.randomUUID(), p_content: 'SPOUSE VOW',
    } as never)

    // Primary's link: viewer='primary', sees only the primary vow.
    const { data: primaryData } = await serviceClient()
      .rpc('get_portal_data' as never, { token: couple.token } as never)
    const pd = primaryData as unknown as { viewer: string; primary_name: string; secondary_name: string; vows: Array<{ who: string; content: string }> }
    expect(pd.viewer).toBe('primary')
    expect(pd.primary_name).toBe('Alex')
    expect(pd.secondary_name).toBe('Sam')
    expect(pd.vows).toHaveLength(1)
    expect(pd.vows[0]!.who).toBe('primary')
    expect(JSON.stringify(pd.vows)).not.toContain('SPOUSE VOW')

    // Secondary's link: viewer='spouse', sees only the spouse vow.
    const { data: spouseData } = await serviceClient()
      .rpc('get_portal_data' as never, { token: couple.secondaryToken } as never)
    const sd = spouseData as unknown as { viewer: string; vows: Array<{ who: string; content: string }> }
    expect(sd.viewer).toBe('spouse')
    expect(sd.vows).toHaveLength(1)
    expect(sd.vows[0]!.who).toBe('spouse')
    expect(JSON.stringify(sd.vows)).not.toContain('PRIMARY VOW')
  })

  it('a partner cannot delete the other partner\'s vow', async () => {
    const couple = await seedCouple(user)
    const spouseId = crypto.randomUUID()
    await serviceClient().rpc('save_portal_vow' as never, {
      p_token: couple.secondaryToken, p_id: spouseId, p_content: 'SPOUSE VOW',
    } as never)

    // Primary tries to delete the spouse's vow via their own token → no-op.
    await serviceClient().rpc('delete_portal_vow' as never, {
      p_token: couple.token, p_id: spouseId,
    } as never)

    const { data: still } = await serviceClient()
      .from('vows' as never)
      .select('id')
      .eq('id', spouseId)
    expect((still ?? []).length).toBe(1)
  })
})
