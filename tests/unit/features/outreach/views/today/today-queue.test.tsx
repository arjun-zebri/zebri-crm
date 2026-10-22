/**
 * Today view behaviour the founder relies on:
 * - a DM copied on another visit (server `copiedAt`) shows as copied, so it
 *   cannot be sent twice by copying again;
 * - "Can't DM" asks before it acts, because it stops every later IG step;
 * - the step label reads as a sequence step.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/ui/toast'
import { IgQueue } from '@/features/outreach/views/today/ig-queue'
import type { IgQueueItem } from '@/lib/outreach/services/queries'

const igCantDmAction = vi.fn(async () => ({ ok: true, data: null }))
vi.mock('@/features/outreach/actions', () => ({
  igCopiedAction: vi.fn(async () => ({ ok: true, data: null })),
  igSentAction: vi.fn(async () => ({ ok: true, data: null })),
  igSkipAction: vi.fn(async () => ({ ok: true, data: null })),
  igCantDmAction: (...args: unknown[]) => igCantDmAction(...(args as [])),
  markRepliedAction: vi.fn(async () => ({ ok: true, data: null })),
  checkRepliesNowAction: vi.fn(async () => ({ ok: true, data: { polled: false } })),
  undoOptOutAction: vi.fn(async () => ({ ok: true, data: null })),
}))


function item(overrides: Partial<IgQueueItem> = {}): IgQueueItem {
  return {
    messageId: 'm1', prospectId: 'p1', name: 'Ada Lovelace', handle: '@ada', igStatus: null, body: 'Hi Ada',
    scheduledFor: '2026-10-12T00:00:00Z', overdue: false, step: 2, score: 5, copiedAt: null, ...overrides,
  }
}

function renderQueue(items: IgQueueItem[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <IgQueue items={items} onOpen={vi.fn()} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Today IG queue', () => {
  beforeEach(() => igCantDmAction.mockClear())

  it('shows a DM as copied from the server flag, so a reload does not re-offer the copy', () => {
    renderQueue([item({ copiedAt: '2026-10-12T01:00:00Z' })])
    expect(screen.getByRole('button', { name: 'Sent' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Copy & open/ })).not.toBeInTheDocument()
  })

  it('labels the step as a sequence step', () => {
    renderQueue([item()])
    expect(screen.getByText('Sequence step 2')).toBeInTheDocument()
  })

  it("asks before marking can't DM, and only acts on confirm", async () => {
    renderQueue([item()])
    fireEvent.click(screen.getByRole('button', { name: "Can't DM" }))
    expect(igCantDmAction).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent("Mark Ada Lovelace as can't DM?")
    fireEvent.click(screen.getByRole('button', { name: "Mark as can't DM" }))
    await waitFor(() => expect(igCantDmAction).toHaveBeenCalledWith({ messageId: 'm1' }))
  })
})
