import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaymentSchedule } from '@/components/builders/parts/payment-schedule'
import type { InvoiceStage, PaymentSchedule as PaymentScheduleType } from '@/types/payment-schedule'

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const defaultSchedule: PaymentScheduleType = {
  id: 'def',
  name: 'Default',
  isDefault: true,
  stages: [
    { label: 'Deposit', amountType: 'percent', amountValue: 25, offsetValue: 0, offsetUnit: 'day' },
    { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day' },
  ],
}

const stageA: InvoiceStage = {
  id: 's1', position: 1, label: 'Deposit', amountType: 'percent', amountValue: 25,
  amountCents: 140_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', paidAt: null,
}
const stageB: InvoiceStage = {
  id: 's2', position: 2, label: 'Final', amountType: 'remainder', amountValue: null,
  amountCents: 420_000, dueDate: '2026-09-01', offsetValue: 30, offsetUnit: 'day', paidAt: null,
}

function setup(overrides: Partial<Parameters<typeof PaymentSchedule>[0]> = {}) {
  const props = {
    canEdit: true,
    stages: [stageA, stageB],
    totalCents: 560_000,
    issueDate: '2026-06-12',
    defaultSchedule,
    schedules: [defaultSchedule],
    schedulesLoading: false,
    schedulesError: null,
    validationError: null,
    markPendingStageId: null,
    onStagesChange: vi.fn(),
    onApplyTemplate: vi.fn(),
    onMarkPaid: vi.fn(),
    onCreateSchedule: vi.fn().mockResolvedValue(undefined),
    onDeleteSchedule: vi.fn().mockResolvedValue(undefined),
    onSetDefaultSchedule: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<PaymentSchedule {...props} />)
  return props
}

describe('PaymentSchedule', () => {
  it('offers a single Add schedule button when empty', () => {
    setup({ stages: [] })
    expect(screen.getByRole('button', { name: /add schedule/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change/i })).not.toBeInTheDocument()
  })

  it('opens the modal from Add schedule', async () => {
    setup({ stages: [] })
    await userEvent.click(screen.getByRole('button', { name: /add schedule/i }))
    // The modal's Apply button is unambiguous (the section h4 also reads
    // "Payment schedule", so we do not assert on the heading here).
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument()
  })

  it('shows a matching running total when applied', () => {
    setup()
    expect(screen.getByText(/stages total .*\$5,600\.00 of \$5,600\.00/i)).toBeInTheDocument()
  })

  it('opens the modal from Change', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /change/i }))
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeInTheDocument()
  })
})
