/**
 * useApplySources — the invoice builder's "start from" sources.
 *
 * After the proposals removal the hook offers only packages and (opt-in)
 * invoice templates. It no longer queries the (dropped) `proposals` table,
 * and no source carries a `proposal` meta. These tests pin that shape.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/current-user', () => ({
  getCurrentUser: () => Promise.resolve({ id: 'u1' }),
}))

const TABLE_ROWS: Record<string, unknown[]> = {
  packages: [
    { id: 'p1', name: 'Full Day', description: 'All-day hosting', gst_inclusive: true, weekend_loading_percent: null, is_popular: false },
  ],
  package_items: [
    { id: 'pi1', package_id: 'p1', description: 'Hosting', amount: 1200, quantity: 1, optional: false },
  ],
  invoice_templates: [
    { id: 't1', name: 'Deposit invoice', description: 'Standard deposit', pricing_mode: 'itemised', fixed_price: null },
    { id: 't2', name: 'Gold', description: null, pricing_mode: 'single', fixed_price: 2400 },
  ],
  invoice_template_items: [
    { invoice_template_id: 't1', description: 'Deposit', amount: 500, position: 0 },
    { invoice_template_id: 't2', description: 'Two Zoom calls', note: null, amount: 0, position: 0 },
    { invoice_template_id: 't2', description: 'Run sheet', note: null, amount: 0, position: 1 },
  ],
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const result = { data: TABLE_ROWS[table] ?? [], error: null }
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => resolve(result),
      }
      for (const method of ['select', 'eq', 'order']) {
        chain[method] = () => chain
      }
      return chain
    },
  }),
}))

const { useApplySources } = await import('@/components/builders/parts/use-apply-sources')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client }, children)
}

describe('useApplySources', () => {
  it('returns package and invoice-template sources, and never a proposal source', async () => {
    const { result } = renderHook(() => useApplySources({ includeInvoiceTemplates: true }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const { options, applyMap } = result.current.data!
    const ids = options.map((o) => o.id)

    // Both surviving source kinds are present.
    expect(ids).toContain('pkg:p1')
    expect(ids).toContain('it:t1')

    // No proposal source leaks through.
    expect(ids.some((id) => id.startsWith('prop:'))).toBe(false)
    for (const source of Object.values(applyMap)) {
      expect(source).not.toHaveProperty('proposal')
    }

    // The package source carries its package meta.
    expect(applyMap['pkg:p1']?.package).toMatchObject({ id: 'p1', gstInclusive: true })
  })

  it('applies a single-price invoice template as one priced line listing its inclusions', async () => {
    // Regression: invoice templates had no single-price mode, so a template
    // built from a single-price package applied as a column of $0 lines.
    const { result } = renderHook(() => useApplySources({ includeInvoiceTemplates: true }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const { options, applyMap } = result.current.data!
    expect(applyMap['it:t2']?.items).toEqual([
      { description: 'Gold', note: 'Two Zoom calls\nRun sheet', amount: 2400 },
    ])
    // The picker still counts the inclusions, not the collapsed line.
    expect(options.find((o) => o.id === 'it:t2')?.itemCount).toBe(2)
    // Itemised templates are untouched.
    expect(applyMap['it:t1']?.items).toEqual([{ description: 'Deposit', note: undefined, amount: 500 }])
  })

  it('omits invoice templates when not requested', async () => {
    const { result } = renderHook(() => useApplySources({}), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const ids = result.current.data!.options.map((o) => o.id)
    expect(ids).toContain('pkg:p1')
    expect(ids.some((id) => id.startsWith('it:'))).toBe(false)
  })
})
