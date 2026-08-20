/**
 * Tests for editable due dates in PaymentStageRow (Task 1).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaymentStageRow } from '@/components/builders/parts/payment-stage-row'
import type { InvoiceStage } from '@/types/payment-schedule'

const unpaid: InvoiceStage = {
  id: 's1',
  position: 1,
  label: 'Deposit',
  amountType: 'percent',
  amountValue: 30,
  amountCents: 150_000,
  dueDate: '2026-08-01',
  offsetValue: 7,
  offsetUnit: 'day',
  offsetAnchor: 'issue',
  paidAt: null,
}

const paid: InvoiceStage = { ...unpaid, id: 's0', paidAt: '2026-07-02T00:00:00Z' }

function setup(stage: InvoiceStage, overrides = {}) {
  const props = {
    stage,
    canRecord: true,
    isNextUnpaid: true,
    markPending: false,
    onMarkPaid: vi.fn(),
    onDueDateChange: vi.fn(),
    ...overrides,
  }
  render(<PaymentStageRow {...props} />)
  return props
}

describe('PaymentStageRow – editable due dates (Task 1)', () => {
  it('unpaid stage shows due date as editable DatePicker', async () => {
    setup(unpaid)
    const trigger = screen.getByRole('button', { name: /1 aug 2026/i })
    expect(trigger).toBeInTheDocument()
  })

  it('clicking the DatePicker trigger opens the calendar', async () => {
    setup(unpaid)
    const trigger = screen.getByRole('button', { name: /1 aug 2026/i })
    await userEvent.click(trigger)
    expect(screen.getByText(/august/i)).toBeInTheDocument()
  })

  it('selecting a date in the calendar calls onDueDateChange', async () => {
    const props = setup(unpaid)
    const trigger = screen.getByRole('button', { name: /1 aug 2026/i })
    await userEvent.click(trigger)
    const dayButton = screen.getByRole('button', { name: '15' })
    await userEvent.click(dayButton)
    expect(props.onDueDateChange).toHaveBeenCalledWith('s1', '2026-08-15')
  })

  it('paid stage shows due date as read-only locked text', () => {
    setup(paid)
    expect(screen.queryByRole('button', { name: /1 aug 2026/i })).not.toBeInTheDocument()
    expect(screen.getByText(/paid 2 jul/i)).toBeInTheDocument()
  })

  it('changing due date updates the displayed date', async () => {
    const props = setup(unpaid)
    const trigger = screen.getByRole('button', { name: /1 aug 2026/i })
    await userEvent.click(trigger)
    const day20 = screen.getByRole('button', { name: '20' })
    await userEvent.click(day20)
    expect(props.onDueDateChange).toHaveBeenCalledWith('s1', '2026-08-20')
  })
})
