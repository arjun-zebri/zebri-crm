/**
 * Bulk do-not-contact must not fire on the first click. It asks first and
 * states how many people it will affect.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/ui/toast'
import { ProspectsBulkBar } from '@/features/outreach/views/prospects/prospects-bulk-bar'
const updateProspectAction = vi.fn(async () => ({ ok: true, data: null }))
vi.mock('@/features/outreach/actions', () => ({
  updateProspectAction: (...args: unknown[]) => updateProspectAction(...(args as [])),
  setVerdictAction: vi.fn(async () => ({ ok: true, data: null })),
  startCheckRunAction: vi.fn(async () => ({ ok: true, data: null })),
}))

function renderBar(ids: string[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ProspectsBulkBar selectedIds={ids} onDone={vi.fn()} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('ProspectsBulkBar do not contact', () => {
  beforeEach(() => updateProspectAction.mockClear())

  it('asks for confirmation with the count before doing anything', () => {
    renderBar(['a', 'b', 'c'])
    fireEvent.click(screen.getByRole('button', { name: 'Do not contact' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Stop contacting 3 people?')).toBeInTheDocument()
    expect(updateProspectAction).not.toHaveBeenCalled()
  })

  it('uses the singular for one person', () => {
    renderBar(['a'])
    fireEvent.click(screen.getByRole('button', { name: 'Do not contact' }))
    expect(screen.getByText('Stop contacting 1 person?')).toBeInTheDocument()
  })

  it('applies the change to every selected prospect once confirmed', async () => {
    renderBar(['a', 'b'])
    fireEvent.click(screen.getByRole('button', { name: 'Do not contact' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Do not contact' }))

    await waitFor(() => expect(updateProspectAction).toHaveBeenCalledTimes(2))
    expect(updateProspectAction).toHaveBeenCalledWith({ id: 'a', patch: { do_not_contact: true } })
  })
})
