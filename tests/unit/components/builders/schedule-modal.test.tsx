import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleModal } from '@/components/builders/parts/schedule-modal'
import type { PaymentSchedule } from '@/types/payment-schedule'

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const defaultSchedule: PaymentSchedule = {
  id: 'def',
  name: 'Default',
  isDefault: true,
  stages: [
    { label: 'Deposit', amountType: 'percent', amountValue: 25, offsetValue: 0, offsetUnit: 'day' },
    { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day' },
  ],
}

function setup(overrides: Partial<Parameters<typeof ScheduleModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    totalCents: 400_000,
    issueDate: '2026-06-12',
    initialStages: [],
    defaultSchedule,
    schedules: [defaultSchedule],
    schedulesLoading: false,
    schedulesError: null,
    onApply: vi.fn(),
    onSaveToLibrary: vi.fn().mockResolvedValue(undefined),
    onDeleteSchedule: vi.fn().mockResolvedValue(undefined),
    onSetDefaultSchedule: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<ScheduleModal {...props} />)
  return props
}

describe('ScheduleModal', () => {
  it('seeds the timeline from the default schedule', () => {
    setup()
    const labels = screen.getAllByLabelText(/stage label/i) as HTMLInputElement[]
    expect(labels.map((l) => l.value)).toEqual(['Deposit', 'Final'])
    expect((screen.getByLabelText(/schedule name/i) as HTMLInputElement).value).toBe('Default')
  })

  it('shows a matching running total', () => {
    setup()
    expect(screen.getByText(/Stages total .*\$4,000\.00 of \$4,000\.00/i)).toBeInTheDocument()
  })

  it('applies the resolved template and closes', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(props.onApply).toHaveBeenCalledWith([
      { label: 'Deposit', amountType: 'percent', amountValue: 25, offsetValue: 0, offsetUnit: 'day' },
      { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day' },
    ])
    expect(props.onClose).toHaveBeenCalled()
  })

  it('saves the current timeline to the library', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /save to library/i }))
    expect(props.onSaveToLibrary).toHaveBeenCalledWith({
      name: 'Default',
      stages: expect.any(Array),
    })
  })

  it('adds a payment', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /add payment/i }))
    expect(screen.getAllByLabelText(/stage label/i)).toHaveLength(3)
  })

  it('disables Apply with a warning for an unresolvable schedule', () => {
    setup({
      defaultSchedule: {
        id: 'bad',
        name: 'Bad',
        isDefault: true,
        stages: [
          { label: 'A', amountType: 'percent', amountValue: 30, offsetValue: 0, offsetUnit: 'day' },
          { label: 'B', amountType: 'percent', amountValue: 30, offsetValue: 0, offsetUnit: 'day' },
        ],
      },
    })
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeDisabled()
    expect(screen.getByText(/do not add up/i)).toBeInTheDocument()
  })
})
