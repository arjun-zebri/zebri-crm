/**
 * Ruling W1: the deposit the couple sees on the page (`depositAmount` from
 * `deposit_percent`) is the deposit the invoice's first stage carries, and
 * the MC's default schedule is only consulted when the proposal names
 * neither a schedule nor a percent.
 *
 * @module tests/unit/lib/proposals/deposit-consistency.test
 */
import { describe, expect, it, vi } from 'vitest'

import { buildInvoicePayload } from '@/lib/proposals/invoice-payload'
import { loadSchedule } from '@/lib/proposals/load-schedule'
import { depositAmount, optionTotal } from '@/lib/proposals/pricing'
import type { PublicProposalOption } from '@/lib/proposals/public-types'

vi.mock('@/lib/alerts/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const option: PublicProposalOption = {
  id: 'o1', position: 1, title: 'Reception MC', description: null, pricing_mode: 'itemised', fixed_price: null,
  gst_inclusive: true, weekend_loading_percent: null, is_popular: true, subtotal: 1400,
  items: [
    { id: 'i1', description: 'Reception hosting', note: null, amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
    { id: 'a1', description: 'Ceremony hosting', note: null, amount: 333, quantity: 1, is_addon: true, default_included: false, position: 2 },
  ],
}

describe('deposit consistency (ruling W1)', () => {
  it('invoices the same deposit the page computed from deposit_percent when no schedule applies', () => {
    const addonIds = ['a1']
    const total = optionTotal(
      { pricingMode: 'itemised', fixedPrice: null, weekendLoadingPercent: null, items: option.items.map((i) => ({ id: i.id, amount: i.amount, quantity: i.quantity, isAddon: i.is_addon })) },
      addonIds,
    )
    const { payload } = buildInvoicePayload({
      title: 'Wedding MC', option, selectedAddonIds: addonIds, schedule: null, depositPercent: 30,
      eventDate: '2027-03-06', issueDate: '2026-09-14', stripePaymentEnabled: false,
    })
    expect(payload.stages[0]?.label).toBe('Deposit')
    expect(payload.stages[0]?.amount_cents).toBe(depositAmount(total, 30) * 100)
    expect(payload.stages.reduce((sum, s) => sum + s.amount_cents, 0)).toBe(Math.round(total * 100))
  })
})

/** A fake admin client that records whether the schedule table was queried. */
function fakeAdmin(row: unknown) {
  const query = vi.fn()
  const chain = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn((col: string, value: unknown) => {
      query(col, value)
      return chain
    }),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  }
  return { admin: chain as unknown as Parameters<typeof loadSchedule>[0], query }
}

describe('loadSchedule precedence', () => {
  const defaultRow = { id: 's1', payment_schedule_stages: [{ position: 1, label: 'Deposit', amount_type: 'percent', amount_value: 25, due_offset_value: 7, due_offset_unit: 'day', due_offset_anchor: 'issue' }] }

  it('never reads the MC default when the proposal has a deposit_percent and no schedule', async () => {
    const { admin, query } = fakeAdmin(defaultRow)
    expect(await loadSchedule(admin, null, 'u1', 30)).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it('reads the MC default when the proposal names neither a schedule nor a percent', async () => {
    const { admin, query } = fakeAdmin(defaultRow)
    const stages = await loadSchedule(admin, null, 'u1', null)
    expect(stages?.[0]).toMatchObject({ label: 'Deposit', amountType: 'percent', amountValue: 25 })
    expect(query).toHaveBeenCalledWith('is_default', true)
  })

  it('reads the named schedule even when a deposit_percent is also set', async () => {
    const { admin, query } = fakeAdmin(defaultRow)
    await loadSchedule(admin, 's1', 'u1', 30)
    expect(query).toHaveBeenCalledWith('id', 's1')
  })
})
