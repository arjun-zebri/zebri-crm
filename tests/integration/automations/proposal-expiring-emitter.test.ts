/**
 * Integration test for the `proposal_expiring` emitter against local
 * Supabase: reads the right proposals, fires at the configured lead time
 * only, dedupes across ticks, opens a workflow instance through the
 * dispatcher, and stays tenant-isolated.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { runTimeEmitters } from '@/lib/automations/time-emitters'
import { dispatchPendingEvents } from '@/lib/workflows/dispatcher'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'
import { instancesFor, seedEventTemplate } from '../helpers/workflows'

function isoDateOffset(days: number): string {
  const today = new Date()
  const target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

let seq = 0

async function seedCouple(user: TestUser): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: user.id, name: 'Test Couple', email: 'couple@zebri.test', status: 'quoted' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return data.id
}

async function seedProposal(
  user: TestUser,
  coupleId: string,
  expiresAt: string | null,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  seq += 1
  const { data, error } = await serviceClient()
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      proposal_number: `PR-X${seq}`,
      title: 'Wedding MC',
      status: 'sent',
      share_token_enabled: true,
      expires_at: expiresAt,
      ...overrides,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed proposal: ${error?.message}`)
  return data.id
}

async function expiringEventsFor(proposalId: string) {
  const { data } = await serviceClient()
    .from('automation_events')
    .select('id, payload, couple_id')
    .eq('source_table', 'proposals')
    .eq('source_id', proposalId)
    .eq('event_type', 'proposal_expiring')
  return (data ?? []) as Array<{ id: string; payload: Record<string, unknown>; couple_id: string | null }>
}

describe('proposal_expiring time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser()
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits nothing when no workflow listens', async () => {
    const coupleId = await seedCouple(user)
    const id = await seedProposal(user, coupleId, isoDateOffset(3))
    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.proposal_expiring).toBe(0)
    expect(await expiringEventsFor(id)).toHaveLength(0)
  })

  it('fires at the default 3-day lead time and stamps the payload', async () => {
    const coupleId = await seedCouple(user)
    await seedEventTemplate(user.id, 'proposal_expiring')
    const hit = await seedProposal(user, coupleId, isoDateOffset(3))
    const miss = await seedProposal(user, coupleId, isoDateOffset(2))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.proposal_expiring).toBe(1)
    const events = await expiringEventsFor(hit)
    expect(events).toHaveLength(1)
    expect(events[0]!.couple_id).toBe(coupleId)
    expect(events[0]!.payload).toMatchObject({
      proposal_id: hit,
      days_until_expiry: 3,
      expires_at: isoDateOffset(3),
    })
    expect(typeof events[0]!.payload.share_token).toBe('string')
    expect(await expiringEventsFor(miss)).toHaveLength(0)
  })

  it('does not emit twice on a second tick the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedEventTemplate(user.id, 'proposal_expiring', { days: 0 })
    const id = await seedProposal(user, coupleId, isoDateOffset(0))
    await runTimeEmitters(serviceClient())
    const second = await runTimeEmitters(serviceClient())
    expect(second.emitted.proposal_expiring).toBe(0)
    expect(await expiringEventsFor(id)).toHaveLength(1)
  })

  it('skips draft, accepted, declined and undated proposals', async () => {
    const coupleId = await seedCouple(user)
    await seedEventTemplate(user.id, 'proposal_expiring', { days: 0 })
    const draft = await seedProposal(user, coupleId, isoDateOffset(0), { status: 'draft', share_token_enabled: false })
    const accepted = await seedProposal(user, coupleId, isoDateOffset(0), {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    const declined = await seedProposal(user, coupleId, isoDateOffset(0), {
      status: 'declined',
      declined_at: new Date().toISOString(),
    })
    const undated = await seedProposal(user, coupleId, null)
    const viewed = await seedProposal(user, coupleId, isoDateOffset(0), { status: 'viewed' })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.proposal_expiring).toBe(1)
    for (const id of [draft, accepted, declined, undated]) {
      expect(await expiringEventsFor(id)).toHaveLength(0)
    }
    expect(await expiringEventsFor(viewed)).toHaveLength(1)
  })

  it('opens a workflow instance through the dispatcher', async () => {
    const coupleId = await seedCouple(user)
    const templateId = await seedEventTemplate(user.id, 'proposal_expiring', { days: 3 })
    await seedProposal(user, coupleId, isoDateOffset(3))
    await runTimeEmitters(serviceClient())
    await dispatchPendingEvents(serviceClient(), 500, { userId: user.id })
    expect(await instancesFor(templateId)).toHaveLength(1)
  })

  it('never fires another tenant\'s proposals', async () => {
    const other = await createTestUser()
    try {
      const coupleId = await seedCouple(other)
      await seedEventTemplate(user.id, 'proposal_expiring', { days: 0 })
      const id = await seedProposal(other, coupleId, isoDateOffset(0))
      await runTimeEmitters(serviceClient())
      expect(await expiringEventsFor(id)).toHaveLength(0)
    } finally {
      await other.cleanup()
    }
  })
})
