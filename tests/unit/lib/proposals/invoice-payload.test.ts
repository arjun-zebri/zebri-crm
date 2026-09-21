import { describe, expect, it } from 'vitest'

import { buildInvoiceItems, buildInvoicePayload } from '@/lib/proposals/invoice-payload'
import type { PublicProposalOption } from '@/lib/proposals/public-types'

const option: PublicProposalOption = {
  id: 'o1', position: 1, title: 'Reception MC', description: null, pricing_mode: 'itemised', fixed_price: null,
  gst_inclusive: true, weekend_loading_percent: 10, is_popular: true, subtotal: 1400,
  items: [
    { id: 'i1', description: 'Reception hosting', note: null, amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
    { id: 'i2', description: 'Planning meeting', note: 'x2', amount: 125, quantity: 2, is_addon: false, default_included: true, position: 2 },
    { id: 'a1', description: 'Ceremony hosting', note: null, amount: 400, quantity: 1, is_addon: true, default_included: false, position: 3 },
    { id: 'a2', description: 'Travel', note: null, amount: 150, quantity: 1, is_addon: true, default_included: true, position: 4 },
  ],
}

describe('buildInvoiceItems', () => {
  it('flattens base items, adds the weekend loading line, then the chosen add-ons', () => {
    const { items, subtotal } = buildInvoiceItems(option, ['a1'])
    expect(items.map((i) => i.description)).toEqual(['Reception hosting', '2 × Planning meeting', 'Weekend rate loading (10%)', 'Ceremony hosting'])
    expect(items.map((i) => i.amount)).toEqual([1400, 250, 165, 400])
    expect(items.map((i) => i.position)).toEqual([1000, 2000, 3000, 4000])
    expect(subtotal).toBe(2215)
  })
  it('uses one package line for single pricing', () => {
    const { items, subtotal } = buildInvoiceItems({ ...option, pricing_mode: 'single', fixed_price: 1800, weekend_loading_percent: null }, [])
    expect(items).toEqual([{ description: 'Reception MC', note: null, amount: 1800, position: 1000 }])
    expect(subtotal).toBe(1800)
  })
})

describe('buildInvoicePayload', () => {
  const common = { title: 'Wedding MC', option, selectedAddonIds: ['a1'] as const, eventDate: '2027-03-06', issueDate: '2026-09-14', stripePaymentEnabled: true }
  it('uses the MC schedule when one is given', () => {
    const { payload, warning } = buildInvoicePayload({ ...common, depositPercent: 25, schedule: [
      { label: 'Deposit', amountType: 'percent', amountValue: 30, offsetValue: 7, offsetUnit: 'day', offsetAnchor: 'issue' },
      { label: 'Balance', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: 'due' },
    ] })
    expect(payload.stages.map((s) => [s.label, s.amount_cents, s.due_date])).toEqual([['Deposit', 66450, '2026-09-21'], ['Balance', 155050, '2027-02-20']])
    expect(payload.due_date).toBe('2027-03-06')
    expect(payload.subtotal).toBe(2215)
    expect(payload.gst_inclusive).toBe(true)
    expect(payload.stripe_payment_enabled).toBe(true)
    expect(warning).toBeNull()
  })
  it('falls back to a deposit stage plus balance from deposit_percent', () => {
    const { payload, warning } = buildInvoicePayload({ ...common, depositPercent: 25, schedule: null })
    expect(payload.stages.map((s) => [s.label, s.amount_type, s.amount_cents])).toEqual([['Deposit', 'percent', 55375], ['Balance', 'remainder', 166125]])
    expect(payload.stages[0]?.due_date).toBe('2026-09-21')
    expect(warning).toBeNull()
  })
  it('falls back to a single full stage when there is no schedule and no deposit', () => {
    const { payload, warning } = buildInvoicePayload({ ...common, depositPercent: null, schedule: null })
    expect(payload.stages.map((s) => [s.label, s.amount_type, s.amount_cents])).toEqual([['Full payment', 'remainder', 221500]])
    expect(warning).toBeNull()
  })
  it('leaves due_date null without an event date', () => {
    const { payload } = buildInvoicePayload({ ...common, eventDate: null, depositPercent: null, schedule: null })
    expect(payload.due_date).toBeNull()
  })
  it('remaps a due-anchored real schedule stage to the issue date when there is no event date', () => {
    // Same shape as the "MC schedule" case above, but with no event date: the
    // 'due'-anchored Balance stage cannot count backward from a due date that
    // does not exist, so it is remapped to count forward from the issue date
    // instead (the schedule itself still resolves; nothing is substituted).
    const { payload, warning } = buildInvoicePayload({ ...common, eventDate: null, depositPercent: 25, schedule: [
      { label: 'Deposit', amountType: 'percent', amountValue: 30, offsetValue: 7, offsetUnit: 'day', offsetAnchor: 'issue' },
      { label: 'Balance', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: 'due' },
    ] })
    // issueDate 2026-09-14: Deposit +7 days -> 2026-09-21 (unaffected, already
    // issue-anchored); Balance +14 days from the same issue date, once
    // remapped from 'due' to 'issue' -> 2026-09-28.
    expect(payload.stages.map((s) => [s.label, s.amount_cents, s.due_date, s.due_offset_anchor])).toEqual([
      ['Deposit', 66450, '2026-09-21', 'issue'],
      ['Balance', 155050, '2026-09-28', 'issue'],
    ])
    expect(payload.due_date).toBeNull()
    expect(warning).toBeNull()
  })
  it('falls back to a single full stage and reports a warning when the schedule fails to resolve', () => {
    // Two remainder stages is a structural error (`multiple_remainders`):
    // there is no defined "what's left over" with two of them, so this is a
    // corrupted schedule rather than a legitimate "no schedule" case.
    const { payload, warning } = buildInvoicePayload({ ...common, depositPercent: 25, schedule: [
      { label: 'A', amountType: 'remainder', amountValue: null, offsetValue: 7, offsetUnit: 'day', offsetAnchor: 'issue' },
      { label: 'B', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: 'issue' },
    ] })
    expect(payload.stages).toEqual([
      { position: 1, label: 'Full payment', amount_type: 'remainder', amount_value: null, amount_cents: 221500, due_date: null, due_offset_value: 14, due_offset_unit: 'day', due_offset_anchor: 'issue' },
    ])
    expect(warning).not.toBeNull()
    expect(warning).toContain('Schedule did not resolve')
  })
})
