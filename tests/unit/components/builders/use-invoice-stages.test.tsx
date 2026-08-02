import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useInvoiceStages } from '@/components/builders/parts/use-invoice-stages'
import type { InvoiceStage } from '@/types/payment-schedule'

vi.mock('@/app/(dashboard)/payments/schedule-actions', () => ({
  listSchedules: vi.fn().mockResolvedValue([]),
  createSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  markStagePaid: vi.fn(),
  replaceInvoiceStages: vi.fn(),
  setDefaultSchedule: vi.fn(),
}))

const stage: InvoiceStage = {
  id: 's1', position: 1, label: 'Deposit', amountType: 'percent', amountValue: 25,
  amountCents: 25_000, dueDate: '2026-08-01', offsetValue: 7, offsetUnit: 'day',
  offsetAnchor: 'issue', paidAt: null,
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useInvoiceStages', () => {
  it('re-seeds the draft when the invoice loads asynchronously', () => {
    // First render: the invoice query is still pending, so the builder passes
    // an empty initialStages and a null invoiceId.
    const { result, rerender } = renderHook((props) => useInvoiceStages(props), {
      wrapper,
      initialProps: {
        invoiceId: null as string | null,
        totalCents: 100_000,
        issueDate: '2026-06-12',
        dueDate: null as string | null,
        initialStages: [] as InvoiceStage[],
      },
    })
    expect(result.current.stages).toHaveLength(0)

    // The invoice query resolves: the builder now passes the loaded stages and
    // the real id. The draft must adopt them.
    rerender({
      invoiceId: 'inv1',
      totalCents: 100_000,
      issueDate: '2026-06-12',
      dueDate: null,
      initialStages: [stage],
    })
    expect(result.current.stages).toHaveLength(1)
    expect(result.current.stages[0]!.label).toBe('Deposit')
  })
})
