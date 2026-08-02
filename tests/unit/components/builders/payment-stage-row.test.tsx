import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaymentStageRow } from '@/components/builders/parts/payment-stage-row'
import type { InvoiceStage } from '@/types/payment-schedule'

const unpaid: InvoiceStage = {
  id: 's1', position: 1, label: 'Deposit', amountType: 'percent',
  amountValue: 30, amountCents: 150_000, dueDate: '2026-08-01',
  offsetValue: 7, offsetUnit: 'day', offsetAnchor: 'issue', paidAt: null,
}
const paid: InvoiceStage = { ...unpaid, id: 's0', paidAt: '2026-07-02T00:00:00Z' }

function setup(stage: InvoiceStage, overrides = {}) {
  const props = {
    stage, canEdit: true, isNextUnpaid: true, markPending: false,
    onChange: vi.fn(), onRemove: vi.fn(), onMarkPaid: vi.fn(), ...overrides,
  }
  render(<PaymentStageRow {...props} />)
  return props
}

describe('PaymentStageRow', () => {
  it('shows the resolved amount', () => {
    setup(unpaid)
    expect(screen.getByText(/\$1,500\.00/)).toBeInTheDocument()
  })

  it('commits a label edit on blur', async () => {
    const props = setup(unpaid)
    const field = screen.getByLabelText(/stage label/i)
    await userEvent.clear(field)
    await userEvent.type(field, 'Booking fee')
    await userEvent.tab()
    expect(props.onChange).toHaveBeenCalledWith({ label: 'Booking fee' })
  })

  it('commits an amount change on blur', async () => {
    const props = setup(unpaid)
    const field = screen.getByLabelText(/stage amount/i)
    await userEvent.clear(field)
    await userEvent.type(field, '40')
    await userEvent.tab()
    expect(props.onChange).toHaveBeenCalledWith({ amountValue: 40 })
  })

  it('hides the amount field for a remainder stage', () => {
    setup({ ...unpaid, amountType: 'remainder', amountValue: null })
    expect(screen.queryByLabelText(/stage amount/i)).not.toBeInTheDocument()
    expect(screen.getByText('Remaining balance', { selector: 'span.text-caption' })).toBeInTheDocument()
  })

  it('locks a paid stage: no editing, no remove', () => {
    setup(paid)
    expect(screen.queryByLabelText(/stage label/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
    // StatePill renders Paid as a styled span, not a button
    expect(screen.getByText('Paid', { selector: 'span' })).toBeInTheDocument()
  })

  it('only offers Mark paid on the next unpaid stage', () => {
    setup(unpaid, { isNextUnpaid: false })
    expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument()
  })

  it('exposes a reorder handle on an editable stage', () => {
    setup(unpaid)
    expect(screen.getByLabelText(/reorder deposit/i)).toBeInTheDocument()
  })

  it('has no reorder handle on a paid stage', () => {
    setup(paid)
    expect(screen.queryByLabelText(/reorder/i)).not.toBeInTheDocument()
  })
})
