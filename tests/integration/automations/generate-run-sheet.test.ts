/**
 * Integration test for `generate_run_sheet_pdf` (AC1) — wired as a
 * run-sheet *link* share, against the local Supabase stack. Emailing is
 * best-effort and skipped without RESEND_API_KEY, so we assert the link
 * + share-token enablement rather than a real send.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import type { AutomationEventRow, RunContext } from '@/types/automations'

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

async function seedEvent(user: TestUser, coupleId: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('events' as never)
    .insert({ user_id: user.id, couple_id: coupleId, title: 'Wedding', date: '2030-01-01', event_type: 'ceremony', status: 'upcoming' } as never)
    .select('id, share_token, share_token_enabled')
    .single()
  if (error || !data) throw new Error(`seed event: ${error?.message}`)
  return (data as { id: string }).id
}

function makeCtx(user: TestUser, coupleId: string): RunContext {
  const triggerEvent = {
    id: 'evt', user_id: user.id, source_table: 'events', source_id: 'e',
    event_type: 'time_before_event', payload: {} as never, couple_id: coupleId,
    created_at: new Date().toISOString(), processed_at: null, error_message: null,
  } satisfies AutomationEventRow
  return {
    userId: user.id,
    automationId: '00000000-0000-0000-0000-000000000001',
    runId: '00000000-0000-0000-0000-000000000002',
    coupleId,
    triggerEvent,
    couple: {
      id: coupleId, name: 'Couple', email: 'c@zebri.test', phone: null, eventDate: null,
      venue: null, status: 'booked', primaryName: 'Couple', spouseName: null,
      spouseEmail: null, spousePhone: null, timezone: 'Australia/Sydney',
    },
    mc: {
      userId: user.id, businessName: 'Test MC', contactName: 'MC', email: 'mc@zebri.test',
      phone: null, brandColor: null, logoUrl: null, quietHoursStart: null, quietHoursEnd: null,
    } as RunContext['mc'],
    actionResults: {},
  }
}

describe('generate_run_sheet_pdf action (run-sheet link)', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('returns the run-sheet link and enables the event share token', async () => {
    const coupleId = await seedCouple(user)
    const eventId = await seedEvent(user, coupleId)

    const spec = getActionSpec('generate_run_sheet_pdf')
    expect(spec).not.toBeNull()
    const result = await spec!.handler(makeCtx(user, coupleId), { eventId })

    expect(result.kind).toBe('ok')
    const output = (result as unknown as { output: { run_sheet_link: string; event_id: string } }).output
    expect(output.run_sheet_link).toContain('/timeline/')
    expect(output.event_id).toBe(eventId)

    const { data: ev } = await serviceClient()
      .from('events' as never)
      .select('share_token, share_token_enabled')
      .eq('id', eventId)
      .single()
    const e = ev as unknown as { share_token: string; share_token_enabled: boolean }
    expect(e.share_token_enabled).toBe(true)
    expect(output.run_sheet_link).toContain(e.share_token)
  })

  it('resolves the couple event when no eventId is given', async () => {
    const coupleId = await seedCouple(user)
    const eventId = await seedEvent(user, coupleId)
    const spec = getActionSpec('generate_run_sheet_pdf')
    const result = await spec!.handler(makeCtx(user, coupleId), {})
    expect(result.kind).toBe('ok')
    expect((result as unknown as { output: { event_id: string } }).output.event_id).toBe(eventId)
  })
})
