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
    stage, canRecord: true, isNextUnpaid: true, markPending: false,
    onMarkPaid: vi.fn(), onDueDateChange: vi.fn(), ...overrides,
  }
  render(<PaymentStageRow {...props} />)
  return props
}

describe('PaymentStageRow', () => {
  it('shows the label and resolved amount', () => {
    setup(unpaid)
    expect(screen.getByText('Deposit')).toBeInTheDocument()
    expect(screen.getByText(/30% · \$1,500\.00/)).toBeInTheDocument()
  })

  it('has no editing inputs — shape is edited in the modal', () => {
    setup(unpaid)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('records a payment on the next unpaid stage when the invoice is live', async () => {
    const props = setup(unpaid)
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }))
    expect(props.onMarkPaid).toHaveBeenCalled()
  })

  it('hides Record payment while drafting (canRecord false)', () => {
    setup(unpaid, { canRecord: false })
    expect(screen.queryByRole('button', { name: /record payment/i })).not.toBeInTheDocument()
  })

  it('hides Record payment on a later unpaid stage', () => {
    setup(unpaid, { isNextUnpaid: false })
    expect(screen.queryByRole('button', { name: /record payment/i })).not.toBeInTheDocument()
  })

  it('a paid stage shows its paid date and no action', () => {
    setup(paid)
    expect(screen.getByText(/Paid 2 Jul/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /record payment/i })).not.toBeInTheDocument()
  })
})
