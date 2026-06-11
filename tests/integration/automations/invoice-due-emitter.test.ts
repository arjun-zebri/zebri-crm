/**
 * Integration test for the `invoice_due` time-based emitter (A3).
 *
 * Runs against the LOCAL Supabase stack so the migrations, the
 * `emit_automation_event` RPC, and the RLS policies on
 * `automation_events` all execute for real. The unit spec at
 * `tests/unit/lib/automations/time-emitters/invoice-due.test.ts`
 * covers the match() narrowing; this file proves the emitter reads
 * the right invoices, dedupes across ticks, and stays tenant-isolated.
 * Mirrors the A1 `quote_due` spec, anchored on `invoices.due_date`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { dispatchPendingEvents } from '@/lib/automations/dispatcher'
import { runTimeEmitters } from '@/lib/automations/time-emitters'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

function isoDateOffset(days: number): string {
  const today = new Date()
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

async function seedCouple(user: TestUser): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'Test Couple',
      email: 'couple@zebri.test',
      status: 'booked',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedInvoice(
  user: TestUser,
  coupleId: string,
  dueDate: string,
  status: 'sent' | 'draft' | 'paid' | 'cancelled' = 'sent',
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('invoices')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      title: 'Test invoice',
      invoice_number: `INV-${Math.floor(Math.random() * 1_000_000)}`,
      status,
      subtotal: 2500,
      due_date: dueDate,
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed invoice: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedInvoiceDueAutomation(
  user: TestUser,
  config: Record<string, unknown> = {},
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: `invoice_due ${JSON.stringify(config)}`,
      trigger_type: 'invoice_due',
      trigger_config: config,
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

/**
 * Read just the `invoice_due` events for an invoice — the invoices DB
 * triggers publish `invoice_created` etc. into the same bus.
 */
async function invoiceDueEventsFor(invoiceId: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, user_id, event_type, payload, source_id, couple_id')
    .eq('source_table', 'invoices')
    .eq('source_id', invoiceId)
    .eq('event_type', 'invoice_due')
  return (data ?? []) as Array<{
    id: string
    user_id: string
    event_type: string
    payload: Record<string, unknown>
    source_id: string
    couple_id: string | null
  }>
}

describe('invoice_due time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits no events when there are no active invoice_due automations', async () => {
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_due).toBe(0)
    expect(await invoiceDueEventsFor(invoiceId)).toHaveLength(0)
  })

  it('emits one event for an invoice due today with an empty (days=0) config', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceDueAutomation(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_due).toBe(1)

    const events = await invoiceDueEventsFor(invoiceId)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.days_until_due).toBe(0)
    expect(events[0]!.couple_id).toBe(coupleId)
  })

  it('fires at the configured lead-time and not on other days', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceDueAutomation(user, { days: 3 })
    const matchingId = await seedInvoice(user, coupleId, isoDateOffset(3))
    const wrongDayId = await seedInvoice(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_due).toBe(1)
    expect(await invoiceDueEventsFor(matchingId)).toHaveLength(1)
    expect(await invoiceDueEventsFor(wrongDayId)).toHaveLength(0)
  })

  it('emits separate events when two automations have different lead-times', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceDueAutomation(user)
    await seedInvoiceDueAutomation(user, { days: 7 })

    const dueTodayId = await seedInvoice(user, coupleId, isoDateOffset(0))
    const dueInSevenId = await seedInvoice(user, coupleId, isoDateOffset(7))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_due).toBe(2)

    const today = await invoiceDueEventsFor(dueTodayId)
    const seven = await invoiceDueEventsFor(dueInSevenId)
    expect(today).toHaveLength(1)
    expect(seven).toHaveLength(1)
    expect(today[0]!.payload.days_until_due).toBe(0)
    expect(seven[0]!.payload.days_until_due).toBe(7)
  })

  it('skips invoices whose status is not "sent"', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceDueAutomation(user)
    const draftId = await seedInvoice(user, coupleId, isoDateOffset(0), 'draft')
    const paidId = await seedInvoice(user, coupleId, isoDateOffset(0), 'paid')
    const cancelledId = await seedInvoice(
      user,
      coupleId,
      isoDateOffset(0),
      'cancelled',
    )

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_due).toBe(0)
    expect(await invoiceDueEventsFor(draftId)).toHaveLength(0)
    expect(await invoiceDueEventsFor(paidId)).toHaveLength(0)
    expect(await invoiceDueEventsFor(cancelledId)).toHaveLength(0)
  })

  it('is idempotent across ticks within the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceDueAutomation(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(0))

    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.invoice_due).toBe(1)

    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.invoice_due).toBe(0)

    expect(await invoiceDueEventsFor(invoiceId)).toHaveLength(1)
  })

  it('dispatcher matches and opens a run for an empty-config automation', async () => {
    // End-to-end emitter → dispatcher chain, mirroring the A1
    // regression coverage: empty trigger_config must behave like the
    // schema defaults on both the emit side and the match side.
    const coupleId = await seedCouple(user)
    const automationId = await seedInvoiceDueAutomation(user, {})
    await seedInvoice(user, coupleId, isoDateOffset(0))

    const emit = await runTimeEmitters(serviceClient())
    expect(emit.emitted.invoice_due).toBe(1)

    await dispatchPendingEvents(serviceClient())

    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id, automation_id, status')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('respects tenant isolation — events are RLS-scoped to their owner', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceDueAutomation(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(0))
    await runTimeEmitters(serviceClient())

    const otherUser = await createTestUser({}, { account_type: 'vendor' })
    try {
      const { data } = await otherUser.client
        .from('automation_events' as never)
        .select('id')
        .eq('source_id', invoiceId)
      expect(data ?? []).toEqual([])
    } finally {
      await otherUser.cleanup()
    }
  })
})
