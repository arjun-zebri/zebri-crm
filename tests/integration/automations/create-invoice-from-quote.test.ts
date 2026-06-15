/**
 * Integration test for the `create_invoice_from_quote` action (AC2)
 * against the local Supabase stack. Seeds a quote + items, runs the
 * handler, and asserts a draft invoice + copied line items.
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

async function seedQuote(user: TestUser, coupleId: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('quotes')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      title: 'Wedding MC package',
      quote_number: `QT-${Math.floor(Math.random() * 1_000_000)}`,
      status: 'accepted',
      subtotal: 3000,
      tax_rate: 10,
      discount_type: 'percentage',
      discount_value: 5,
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed quote: ${error?.message}`)
  const quoteId = (data as { id: string }).id
  const { error: itErr } = await serviceClient()
    .from('quote_items')
    .insert([
      { quote_id: quoteId, user_id: user.id, description: 'Ceremony MC', amount: 2000, position: 0 },
      { quote_id: quoteId, user_id: user.id, description: 'Reception MC', amount: 1000, position: 1 },
    ] as never)
  if (itErr) throw new Error(`seed quote_items: ${itErr.message}`)
  return quoteId
}

function makeCtx(user: TestUser, coupleId: string): RunContext {
  const triggerEvent = {
    id: 'evt',
    user_id: user.id,
    source_table: 'quotes',
    source_id: 'q',
    event_type: 'quote_accepted',
    payload: {} as never,
    couple_id: coupleId,
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  } satisfies AutomationEventRow
  return {
    userId: user.id,
    automationId: '00000000-0000-0000-0000-000000000001',
    runId: '00000000-0000-0000-0000-000000000002',
    coupleId,
    triggerEvent,
    couple: {
      id: coupleId,
      name: 'Couple',
      email: 'c@zebri.test',
      phone: null,
      eventDate: null,
      venue: null,
      status: 'booked',
      primaryName: 'Couple',
      spouseName: null,
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    mc: {
      userId: user.id,
      businessName: 'Test MC',
      contactName: 'MC',
      email: 'mc@zebri.test',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: null,
      quietHoursEnd: null,
    } as RunContext['mc'],
    actionResults: {},
  }
}

async function invoiceItemsFor(invoiceId: string) {
  const { data } = await serviceClient()
    .from('invoice_items')
    .select('description, amount, quantity, unit_price, position')
    .eq('invoice_id', invoiceId)
    .order('position', { ascending: true })
  return (data ?? []) as Array<{ description: string; amount: number; quantity: number; unit_price: number }>
}

describe('create_invoice_from_quote action', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('drafts an invoice copying the quote financials + line items', async () => {
    const coupleId = await seedCouple(user)
    const quoteId = await seedQuote(user, coupleId)

    const spec = getActionSpec('create_invoice_from_quote')
    expect(spec).not.toBeNull()
    const result = await spec!.handler(makeCtx(user, coupleId), {
      quoteId,
      paymentSchedule: 'deposit_only',
    })

    expect(result.kind).toBe('ok')
    const invoiceId = (result as unknown as { output: { invoice_id: string } }).output.invoice_id
    expect(invoiceId).toBeTruthy()

    const { data: invoice } = await serviceClient()
      .from('invoices')
      .select('status, couple_id, subtotal, tax_rate, discount_type, discount_value, deposit_percent')
      .eq('id', invoiceId)
      .single()
    const inv = invoice as Record<string, unknown>
    expect(inv.status).toBe('draft')
    expect(inv.couple_id).toBe(coupleId)
    expect(inv.subtotal).toBe(3000)
    expect(inv.tax_rate).toBe(10)
    expect(inv.discount_type).toBe('percentage')
    expect(inv.deposit_percent).toBe(50) // deposit_only → 50% default

    const items = await invoiceItemsFor(invoiceId)
    expect(items).toHaveLength(2)
    expect(items[0]!.description).toBe('Ceremony MC')
    expect(items[0]!.amount).toBe(2000)
    expect(items[0]!.unit_price).toBe(2000)
  })

  it('full schedule leaves no deposit', async () => {
    const coupleId = await seedCouple(user)
    const quoteId = await seedQuote(user, coupleId)
    const spec = getActionSpec('create_invoice_from_quote')
    const result = await spec!.handler(makeCtx(user, coupleId), {
      quoteId,
      paymentSchedule: 'full',
    })
    const invoiceId = (result as unknown as { output: { invoice_id: string } }).output.invoice_id
    const { data } = await serviceClient()
      .from('invoices')
      .select('deposit_percent')
      .eq('id', invoiceId)
      .single()
    expect((data as { deposit_percent: number | null }).deposit_percent).toBeNull()
  })

  it('skips cleanly when no quote can be resolved', async () => {
    const coupleId = await seedCouple(user)
    const spec = getActionSpec('create_invoice_from_quote')
    const result = await spec!.handler(makeCtx(user, coupleId), {
      paymentSchedule: 'full',
    })
    expect(result.kind).toBe('ok')
    expect((result as unknown as { output: { skipped?: string } }).output.skipped).toBeTruthy()
  })
})
