/**
 * Integration test for the `invoice_overdue` time-based emitter (A4).
 *
 * Runs against the LOCAL Supabase stack so the migrations, the
 * `emit_automation_event` RPC, and the RLS policies on
 * `automation_events` all execute for real. The unit spec at
 * `tests/unit/lib/automations/time-emitters/invoice-overdue.test.ts`
 * covers the match() narrowing; this file proves the emitter reads
 * the right invoices, dedupes across ticks, and stays tenant-isolated.
 * Mirrors the A2 `quote_overdue` spec, anchored on `invoices.due_date`.
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
  dueDate: string | null,
  status: 'sent' | 'draft' | 'paid' | 'cancelled' | 'deposit_paid' = 'sent',
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

async function seedStage(
  user: TestUser,
  invoiceId: string,
  position: number,
  dueDate: string | null,
  paidAt: string | null = null,
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('invoice_payment_stages' as never)
    .insert({
      user_id: user.id,
      invoice_id: invoiceId,
      position,
      label: `Stage ${position}`,
      amount_type: 'remainder',
      amount_value: null,
      amount_cents: 1000,
      due_date: dueDate,
      paid_at: paidAt,
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed stage: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedInvoiceOverdueAutomation(
  user: TestUser,
  config: Record<string, unknown> = {},
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: `invoice_overdue ${JSON.stringify(config)}`,
      trigger_type: 'invoice_overdue',
      trigger_config: config,
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

/**
 * Read just the `invoice_overdue` events for an invoice — the
 * invoices DB triggers publish `invoice_created` etc. into the same
 * bus.
 */
async function invoiceOverdueEventsFor(invoiceId: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, user_id, event_type, payload, source_id, couple_id')
    .eq('source_table', 'invoices')
    .eq('source_id', invoiceId)
    .eq('event_type', 'invoice_overdue')
  return (data ?? []) as Array<{
    id: string
    user_id: string
    event_type: string
    payload: Record<string, unknown>
    source_id: string
    couple_id: string | null
  }>
}

describe('invoice_overdue time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits no events when there are no active invoice_overdue automations', async () => {
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(0)
    expect(await invoiceOverdueEventsFor(invoiceId)).toHaveLength(0)
  })

  it('emits one event for an invoice 1 day past due with an empty config', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(1)

    const events = await invoiceOverdueEventsFor(invoiceId)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.days_overdue).toBe(1)
    expect(events[0]!.couple_id).toBe(coupleId)
  })

  it('does not fire for an invoice due today (not yet overdue)', async () => {
    // The due date itself belongs to `invoice_due` (days=0); overdue
    // starts strictly after it.
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(0)
    expect(await invoiceOverdueEventsFor(invoiceId)).toHaveLength(0)
  })

  it('fires at the configured min threshold and not before', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 3 })
    const matchingId = await seedInvoice(user, coupleId, isoDateOffset(-3))
    const tooFreshId = await seedInvoice(user, coupleId, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(1)
    expect(await invoiceOverdueEventsFor(matchingId)).toHaveLength(1)
    expect(await invoiceOverdueEventsFor(tooFreshId)).toHaveLength(0)
  })

  it('clamps a configured min of 0 up to 1 day overdue', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 0 })
    const yesterdayId = await seedInvoice(user, coupleId, isoDateOffset(-1))
    const todayId = await seedInvoice(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(1)
    expect(await invoiceOverdueEventsFor(yesterdayId)).toHaveLength(1)
    expect(await invoiceOverdueEventsFor(todayId)).toHaveLength(0)
  })

  it('emits separate events when two automations have different thresholds', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user)
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 7 })

    const oneDayId = await seedInvoice(user, coupleId, isoDateOffset(-1))
    const sevenDayId = await seedInvoice(user, coupleId, isoDateOffset(-7))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(2)

    const one = await invoiceOverdueEventsFor(oneDayId)
    const seven = await invoiceOverdueEventsFor(sevenDayId)
    expect(one).toHaveLength(1)
    expect(seven).toHaveLength(1)
    expect(one[0]!.payload.days_overdue).toBe(1)
    expect(seven[0]!.payload.days_overdue).toBe(7)
  })

  it('skips invoices whose status is not "sent"', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user)
    const draftId = await seedInvoice(user, coupleId, isoDateOffset(-1), 'draft')
    const paidId = await seedInvoice(user, coupleId, isoDateOffset(-1), 'paid')

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(0)
    expect(await invoiceOverdueEventsFor(draftId)).toHaveLength(0)
    expect(await invoiceOverdueEventsFor(paidId)).toHaveLength(0)
  })

  it('is idempotent across ticks within the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(-1))

    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.invoice_overdue).toBe(1)

    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.invoice_overdue).toBe(0)

    expect(await invoiceOverdueEventsFor(invoiceId)).toHaveLength(1)
  })

  it('dispatcher matches and opens a run for an empty-config automation', async () => {
    const coupleId = await seedCouple(user)
    const automationId = await seedInvoiceOverdueAutomation(user, {})
    await seedInvoice(user, coupleId, isoDateOffset(-1))

    const emit = await runTimeEmitters(serviceClient())
    expect(emit.emitted.invoice_overdue).toBe(1)

    await dispatchPendingEvents(serviceClient())

    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id, automation_id, status')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('respects tenant isolation — events are RLS-scoped to their owner', async () => {
    const coupleId = await seedCouple(user)
    await seedInvoiceOverdueAutomation(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(-1))
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

  it('still emits for later stages after the first is paid', async () => {
    // The live bug: status flips to deposit_paid on first payment and the old
    // emitter's .eq('status','sent') filter stopped matching the invoice at all.
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, null, 'deposit_paid')
    await seedStage(user, invoiceId, 1, isoDateOffset(-30), '2026-07-01T00:00:00Z')
    await seedStage(user, invoiceId, 2, isoDateOffset(-1), null)
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 1 })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(1)

    const events = await invoiceOverdueEventsFor(invoiceId)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.stage_position).toBe(2)
    expect(events[0]!.payload.stage_count).toBe(2)
  })

  it('emits one event per stage when two fall overdue the same day', async () => {
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, null, 'sent')
    await seedStage(user, invoiceId, 1, isoDateOffset(-1), null)
    await seedStage(user, invoiceId, 2, isoDateOffset(-1), null)
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 1 })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(2)
  })

  it('does not emit for a paid stage', async () => {
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, null, 'sent')
    await seedStage(user, invoiceId, 1, isoDateOffset(-1), '2026-07-01T00:00:00Z')
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 1 })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(0)
  })

  it('still emits off the invoice due_date when there are no stages', async () => {
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, isoDateOffset(-1), 'sent')
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 1 })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(1)

    const events = await invoiceOverdueEventsFor(invoiceId)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.stage_id).toBeNull()
  })

  it('does not re-emit the same stage twice in one day', async () => {
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, null, 'sent')
    await seedStage(user, invoiceId, 1, isoDateOffset(-1), null)
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 1 })

    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.invoice_overdue).toBe(1)

    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.invoice_overdue).toBe(0)
  })

  it('correctly identifies the final stage with non-contiguous positions', async () => {
    // Regression: when positions are {1, 3} and count is 2,
    // the old `position === count` logic fails to identify position 3 as final.
    // With the fix, stage_is_final is stamped on the payload based on max position.
    const coupleId = await seedCouple(user)
    const invoiceId = await seedInvoice(user, coupleId, null, 'sent')
    await seedStage(user, invoiceId, 1, isoDateOffset(-1), null)
    await seedStage(user, invoiceId, 3, isoDateOffset(-1), null)
    await seedInvoiceOverdueAutomation(user, { daysOverdueMin: 1 })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.invoice_overdue).toBe(2)

    const events = await invoiceOverdueEventsFor(invoiceId)
    expect(events).toHaveLength(2)

    const stage1Event = events.find((e) => e.payload.stage_position === 1)
    const stage3Event = events.find((e) => e.payload.stage_position === 3)

    expect(stage1Event?.payload.stage_is_final).toBe(false)
    expect(stage3Event?.payload.stage_is_final).toBe(true)
  })
})
