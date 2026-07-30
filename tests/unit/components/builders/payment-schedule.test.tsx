import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaymentSchedule } from '@/components/builders/parts/payment-schedule'
import type { InvoiceStage } from '@/types/payment-schedule'

const stageA: InvoiceStage = {
  id: 's1',
  position: 1,
  label: 'Deposit',
  amountType: 'percent',
  amountValue: 30,
  amountCents: 150_000,
  dueDate: '2026-08-01',
  paidAt: null,
}

const stageB: InvoiceStage = {
  id: 's2',
  position: 2,
  label: 'Final',
  amountType: 'remainder',
  amountValue: null,
  amountCents: 350_000,
  dueDate: '2026-09-01',
  paidAt: null,
}

function setup(overrides = {}) {
  const props = {
    canEdit: true,
    stages: [stageA, stageB],
    schedules: [],
    schedulesLoading: false,
    schedulesError: null,
    validationError: null,
    markPendingStageId: null,
    onStagesChange: vi.fn(),
    onApplySchedule: vi.fn(),
    onSaveAsSchedule: vi.fn(),
    onUpdateApplied: null,
    onMarkPaid: vi.fn(),
    onRenameSchedule: vi.fn(),
    onDeleteSchedule: vi.fn(),
    onSetDefaultSchedule: vi.fn(),
    ...overrides,
  }
  render(<PaymentSchedule {...props} />)
  return props
}

describe('PaymentSchedule', () => {
  it('collects a name before saving a schedule', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /save this as a schedule/i }))
    await userEvent.type(screen.getByLabelText(/schedule name/i), '30 / 70 split')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onSaveAsSchedule).toHaveBeenCalledWith('30 / 70 split')
  })

  it('does not save an empty name', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /save this as a schedule/i }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onSaveAsSchedule).not.toHaveBeenCalled()
  })

  it('does not save a whitespace-only name', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /save this as a schedule/i }))
    await userEvent.type(screen.getByLabelText(/schedule name/i), '   ')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onSaveAsSchedule).not.toHaveBeenCalled()
  })

  it('trims whitespace from the name before saving', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /save this as a schedule/i }))
    await userEvent.type(screen.getByLabelText(/schedule name/i), '  50 / 50  ')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onSaveAsSchedule).toHaveBeenCalledWith('50 / 50')
  })
})
