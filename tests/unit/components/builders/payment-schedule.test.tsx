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
    { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
    { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
  ],
}

const stageA: InvoiceStage = {
  id: 's1', position: 1, label: 'Deposit', amountType: 'percent',
  amountValue: 25, amountCents: 140_000, dueDate: '2026-08-01', paidAt: null,
}
const stageB: InvoiceStage = {
  id: 's2', position: 2, label: 'Final', amountType: 'remainder',
  amountValue: null, amountCents: 420_000, dueDate: '2026-09-01', paidAt: null,
}

function setup(overrides: Partial<Parameters<typeof PaymentSchedule>[0]> = {}) {
  const props = {
    canEdit: true,
    stages: [stageA, stageB],
    totalCents: 560_000,
    defaultSchedule,
    schedules: [defaultSchedule],
    schedulesLoading: false,
    schedulesError: null,
    validationError: null,
    markPendingStageId: null,
    onStagesChange: vi.fn(),
    onApplySchedule: vi.fn(),
    onMarkPaid: vi.fn(),
    onCreateSchedule: vi.fn().mockResolvedValue(undefined),
    onUpdateSchedule: vi.fn().mockResolvedValue(undefined),
    onDeleteSchedule: vi.fn().mockResolvedValue(undefined),
    onSetDefaultSchedule: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<PaymentSchedule {...props} />)
  return props
}

describe('PaymentSchedule', () => {
  it('offers the default schedule by name in the empty state', () => {
    setup({ stages: [] })
    expect(screen.getByRole('button', { name: /apply .*default/i })).toBeInTheDocument()
    expect(screen.getByText('25%, then remainder')).toBeInTheDocument()
  })

  it('applies the default when the primary button is clicked', async () => {
    const props = setup({ stages: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply .*default/i }))
    expect(props.onApplySchedule).toHaveBeenCalledWith(defaultSchedule)
  })

  it('offers Add payment schedule when there is no default', () => {
    setup({ stages: [], defaultSchedule: null })
    expect(screen.getByRole('button', { name: /add payment schedule/i })).toBeInTheDocument()
  })

  it('shows a matching running total', () => {
    setup()
    expect(screen.getByText(/stages total .*\$5,600\.00 of \$5,600\.00/i)).toBeInTheDocument()
  })

  it('surfaces a validation error when the stage total is short', () => {
    setup({ totalCents: 600_000, validationError: 'The stages do not add up to the invoice total.' })
    expect(screen.getByText(/do not add up/i)).toBeInTheDocument()
  })

  it('opens the library from Change', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /change/i }))
    // The library modal renders its list, which offers New schedule.
    expect(screen.getByRole('button', { name: /new schedule/i })).toBeInTheDocument()
  })
})
