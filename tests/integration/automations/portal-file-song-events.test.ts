/**
 * Integration test for the portal DB-trigger emitters (P1/P2):
 * `couple_uploaded_file` + `couple_added_song_to_playlist`. Inserting a
 * portal_files / portal_songs row should emit the dedicated automation
 * event (alongside the existing section_completed) and the dispatcher
 * should open a run. Runs against the local Supabase stack (real RLS).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { dispatchPendingEvents } from '@/lib/automations/dispatcher'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

async function seedCouple(user: TestUser): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: user.id, name: 'Couple', email: 'c@zebri.test', status: 'booked' } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedAutomation(user: TestUser, triggerType: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: triggerType,
      trigger_type: triggerType,
      trigger_config: {},
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

async function eventsFor(sourceTable: string, sourceId: string, eventType: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, payload, couple_id')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .eq('event_type', eventType)
  return (data ?? []) as Array<{ id: string; payload: Record<string, unknown>; couple_id: string | null }>
}

describe('portal file/song automation events (P1/P2)', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits couple_uploaded_file on a portal_files insert + opens a run', async () => {
    const coupleId = await seedCouple(user)
    const automationId = await seedAutomation(user, 'couple_uploaded_file')

    const { data: file, error } = await serviceClient()
      .from('portal_files' as never)
      .insert({ user_id: user.id, couple_id: coupleId, name: 'contract.pdf', file_url: 'https://x/y.pdf', file_size: 1234 } as never)
      .select('id')
      .single()
    if (error || !file) throw new Error(`seed file: ${error?.message}`)
    const fileId = (file as { id: string }).id

    const events = await eventsFor('portal_files', fileId, 'couple_uploaded_file')
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.name).toBe('contract.pdf')
    expect(events[0]!.couple_id).toBe(coupleId)

    await dispatchPendingEvents(serviceClient())
    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('emits couple_added_song_to_playlist on a portal_songs insert', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 'couple_added_song_to_playlist')

    const { data: song, error } = await serviceClient()
      .from('portal_songs' as never)
      .insert({ user_id: user.id, couple_id: coupleId, title: 'Our Song', artist: 'The Band', category: 'first_dance', position: 0 } as never)
      .select('id')
      .single()
    if (error || !song) throw new Error(`seed song: ${error?.message}`)
    const songId = (song as { id: string }).id

    const events = await eventsFor('portal_songs', songId, 'couple_added_song_to_playlist')
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.title).toBe('Our Song')
    expect(events[0]!.payload.artist).toBe('The Band')
  })

  it('respects tenant isolation for emitted events', async () => {
    const coupleId = await seedCouple(user)
    const { data: file } = await serviceClient()
      .from('portal_files' as never)
      .insert({ user_id: user.id, couple_id: coupleId, name: 'x.pdf', file_url: 'https://x/x.pdf', file_size: 1 } as never)
      .select('id')
      .single()
    const fileId = (file as unknown as { id: string }).id

    const otherUser = await createTestUser({}, { account_type: 'vendor' })
    try {
      const { data } = await otherUser.client
        .from('automation_events' as never)
        .select('id')
        .eq('source_id', fileId)
      expect(data ?? []).toEqual([])
    } finally {
      await otherUser.cleanup()
    }
  })
})
