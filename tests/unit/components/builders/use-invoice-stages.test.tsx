import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { replaceInvoiceStages } from '@/app/(dashboard)/payments/schedule-actions'
import { useInvoiceStages } from '@/components/builders/parts/use-invoice-stages'
import type { InvoiceStage } from '@/types/payment-schedule'

vi.mock('@/app/(dashboard)/payments/schedule-actions', () => ({
  listSchedules: vi.fn().mockResolvedValue([]),
  createSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  markStagePaid: vi.fn(),
  replaceInvoiceStages: vi.fn().mockResolvedValue(undefined),
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

/** Two unpaid stages on a $1000 invoice issued 2026-06-12, due 2026-09-12. */
const twoStages: InvoiceStage[] = [
  {
    id: 's1', position: 1, label: 'Deposit', amountType: 'percent', amountValue: 25,
    amountCents: 25_000, dueDate: '2026-06-19', offsetValue: 7, offsetUnit: 'day',
    offsetAnchor: 'issue', paidAt: null,
  },
  {
    id: 's2', position: 2, label: 'Balance', amountType: 'remainder', amountValue: null,
    amountCents: 75_000, dueDate: '2026-09-05', offsetValue: 7, offsetUnit: 'day',
    offsetAnchor: 'due', paidAt: null,
  },
]

const baseProps = {
  invoiceId: 'inv1' as string | null,
  totalCents: 100_000,
  issueDate: '2026-06-12',
  dueDate: '2026-09-12' as string | null,
  initialStages: twoStages,
}

describe('useInvoiceStages', () => {
  beforeEach(() => {
    vi.mocked(replaceInvoiceStages).mockClear()
  })

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

  // A stage's date is normally derived from its offset, and `persist` used to
  // write exactly what the resolver produced. A date the MC typed into the
  // row's DatePicker showed on screen and saved without error, then reverted
  // on reopen, because the override never reached the resolved stages.
  describe('manual due-date overrides', () => {
    it('persists an edited due date instead of the offset-derived one', async () => {
      const { result } = renderHook((props) => useInvoiceStages(props), {
        wrapper,
        initialProps: baseProps,
      })

      // The offset (issue + 7 days) puts stage 1 on the 19th.
      expect(result.current.stages[0]!.dueDate).toBe('2026-06-19')

      act(() => result.current.updateStageDueDate('s1', '2026-07-01'))

      // Shown immediately...
      expect(result.current.stages[0]!.dueDate).toBe('2026-07-01')

      // ...and written on save.
      await act(async () => {
        await result.current.persist()
      })
      const written = vi.mocked(replaceInvoiceStages).mock.calls[0]![0]!.stages
      expect(written[0]!.dueDate).toBe('2026-07-01')
    })

    it('leaves untouched stages on their offset-derived dates', async () => {
      const { result } = renderHook((props) => useInvoiceStages(props), {
        wrapper,
        initialProps: baseProps,
      })

      act(() => result.current.updateStageDueDate('s1', '2026-07-01'))
      await act(async () => {
        await result.current.persist()
      })

      const written = vi.mocked(replaceInvoiceStages).mock.calls[0]![0]!.stages
      // due - 7 days from 2026-09-12.
      expect(written[1]!.dueDate).toBe('2026-09-05')
    })

    it('drops overrides when a schedule template is reapplied', async () => {
      const { result } = renderHook((props) => useInvoiceStages(props), {
        wrapper,
        initialProps: baseProps,
      })

      act(() => result.current.updateStageDueDate('s1', '2026-07-01'))
      act(() =>
        result.current.applyTemplate([
          {
            label: 'Deposit', amountType: 'percent', amountValue: 50,
            offsetValue: 1, offsetUnit: 'day', offsetAnchor: 'issue',
          },
          {
            label: 'Balance', amountType: 'remainder', amountValue: null,
            offsetValue: 1, offsetUnit: 'day', offsetAnchor: 'due',
          },
        ]),
      )

      await act(async () => {
        await result.current.persist()
      })

      // Reapplying recomputes every date from its offsets, which is the point
      // of reapplying: issue + 1 day, not the MC's earlier override.
      const written = vi.mocked(replaceInvoiceStages).mock.calls[0]![0]!.stages
      expect(written[0]!.dueDate).toBe('2026-06-13')
    })
  })
})
