/**
 * `getAllUserStats` (`lib/admin/admin-analytics`) — the one-pass
 * per-user aggregate feeding the admin Users table.
 *
 * The contracts: counts land on the right user, every template table
 * folds into one `templates` number, only PAID invoices contribute to
 * `paidTotal` (using the canonical `invoiceTotal` math), and the
 * page loop drains tables past the 1000-row PostgREST response cap
 * instead of silently truncating.
 *
 * It also computes `lastActiveAt` — the high-water mark across the
 * four activity surfaces (couples / events / invoices / contracts).
 * That is what the admin dashboard reads as "last active"; GoTrue's
 * `last_sign_in_at` is not an activity signal (it never moves on a
 * token refresh, and Zebri sessions never expire).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The module builds its own service-role client, so intercept the SDK
// factory and serve rows from an in-memory `tables` fixture. `range`
// slices like PostgREST does, which also exercises the pagination loop.
let tables: Record<string, Array<Record<string, unknown>>> = {}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        range: (from: number, to: number) =>
          Promise.resolve({ data: (tables[table] ?? []).slice(from, to + 1), error: null }),
      }),
    }),
  }),
}))

import { getAllUserStats } from '@/lib/admin/admin-analytics'

const owned = (userId: string, created_at: string | null = null) => ({
  user_id: userId,
  created_at,
})

function invoice(
  userId: string,
  overrides: Partial<{
    created_at: string | null
    paid_at: string | null
    subtotal: number
    tax_rate: number
    discount_type: string | null
    discount_value: number | null
  }> = {},
) {
  return {
    user_id: userId,
    created_at: null,
    paid_at: null,
    subtotal: 0,
    tax_rate: 0,
    discount_type: null,
    discount_value: null,
    ...overrides,
  }
}

beforeEach(() => {
  tables = {}
})

describe('getAllUserStats', () => {
  it('aggregates counts per user and folds all template tables into one number', async () => {
    tables = {
      couples: [owned('a'), owned('a'), owned('b')],
      events: [owned('a')],
      automations: [owned('b'), owned('b')],
      email_templates: [owned('a')],
      contract_templates: [owned('a')],
      invoice_templates: [owned('b')],
      questionnaire_templates: [owned('a')],
      packages: [owned('a')],
      invoices: [],
    }

    const stats = await getAllUserStats()
    expect(stats.a).toEqual({
      couples: 2,
      events: 1,
      invoices: 0,
      paidTotal: 0,
      templates: 4,
      automations: 0,
      lastActiveAt: null,
    })
    expect(stats.b).toEqual({
      couples: 1,
      events: 0,
      invoices: 0,
      paidTotal: 0,
      templates: 1,
      automations: 2,
      lastActiveAt: null,
    })
  })

  it('sums paidTotal from PAID invoices only, using the canonical total math', async () => {
    tables = {
      invoices: [
        // Paid: (1000 - 10%) + 10% GST = 990.
        invoice('a', {
          paid_at: '2026-08-01T00:00:00Z',
          subtotal: 1000,
          tax_rate: 10,
          discount_type: 'percentage',
          discount_value: 10,
        }),
        // Paid, fixed discount, no tax: 500 - 100 = 400.
        invoice('a', {
          paid_at: '2026-08-02T00:00:00Z',
          subtotal: 500,
          discount_type: 'fixed',
          discount_value: 100,
        }),
        // Unpaid — counts as an invoice, contributes nothing to paidTotal.
        invoice('a', { subtotal: 9999 }),
      ],
    }

    const stats = await getAllUserStats()
    expect(stats.a).toMatchObject({ invoices: 3, paidTotal: 1390 })
  })

  it('leaves users with no activity absent from the record', async () => {
    tables = { couples: [owned('a')] }
    const stats = await getAllUserStats()
    expect(stats.ghost).toBeUndefined()
  })

  it('drains tables past the 1000-row page cap', async () => {
    tables = { couples: Array.from({ length: 2500 }, () => owned('busy')) }
    const stats = await getAllUserStats()
    expect(stats.busy?.couples).toBe(2500)
  })
})

describe('getAllUserStats — lastActiveAt', () => {
  it('takes the newest timestamp across every activity surface', async () => {
    tables = {
      couples: [owned('a', '2026-01-01T00:00:00Z')],
      events: [owned('a', '2026-06-05T00:00:00Z')],
      invoices: [invoice('a', { created_at: '2026-03-01T00:00:00Z' })],
      contracts: [{ user_id: 'a', created_at: '2026-02-01T00:00:00Z', updated_at: null }],
    }
    const stats = await getAllUserStats()
    expect(stats.a?.lastActiveAt).toBe('2026-06-05T00:00:00Z')
  })

  it('counts a contract EDIT, not just its creation', async () => {
    tables = {
      couples: [owned('a', '2026-01-01T00:00:00Z')],
      contracts: [
        {
          user_id: 'a',
          created_at: '2026-01-02T00:00:00Z',
          updated_at: '2026-07-30T00:00:00Z',
        },
      ],
    }
    const stats = await getAllUserStats()
    expect(stats.a?.lastActiveAt).toBe('2026-07-30T00:00:00Z')
  })

  it('ignores template and automation rows — owning a template is not activity', async () => {
    tables = {
      couples: [owned('a', '2026-01-01T00:00:00Z')],
      automations: [owned('a', '2026-09-01T00:00:00Z')],
      email_templates: [owned('a', '2026-09-02T00:00:00Z')],
    }
    const stats = await getAllUserStats()
    expect(stats.a?.lastActiveAt).toBe('2026-01-01T00:00:00Z')
  })

  it('ignores unparseable timestamps rather than poisoning the mark', async () => {
    tables = {
      couples: [owned('a', 'not-a-date'), owned('a', '2026-04-04T00:00:00Z')],
    }
    const stats = await getAllUserStats()
    expect(stats.a?.lastActiveAt).toBe('2026-04-04T00:00:00Z')
  })
})
