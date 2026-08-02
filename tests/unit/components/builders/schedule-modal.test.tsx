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
    { label: 'Deposit', amountType: 'percent', amountValue: 25, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
    { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
  ],
}

function setup(overrides: Partial<Parameters<typeof ScheduleModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    totalCents: 400_000,
    issueDate: '2026-06-12',
    dueDate: '2026-12-01' as string | null,
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
  it('seeds the timeline and name from the default schedule', () => {
    setup()
    const labels = screen.getAllByLabelText(/stage label/i) as HTMLInputElement[]
    expect(labels.map((l) => l.value)).toEqual(['Deposit', 'Final'])
    expect((screen.getByLabelText(/^schedule$/i) as HTMLInputElement).value).toBe('Default')
  })

  it('shows a matching running total', () => {
    setup()
    expect(screen.getByText(/Stages total .*\$4,000\.00 of \$4,000\.00/i)).toBeInTheDocument()
  })

  it('applies the resolved template and closes', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(props.onApply).toHaveBeenCalledWith([
      { label: 'Deposit', amountType: 'percent', amountValue: 25, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
      { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
    ])
    expect(props.onClose).toHaveBeenCalled()
  })

  it('saves the current timeline to the library', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /save to library/i }))
    expect(props.onSaveToLibrary).toHaveBeenCalledWith({ name: 'Default', stages: expect.any(Array) })
  })

  it('adds a payment before the remainder', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /add payment/i }))
    expect(screen.getAllByLabelText(/stage label/i)).toHaveLength(3)
  })

  it('switches every share to dollars when Amount is set to $', async () => {
    setup()
    const dollar = screen.getByRole('button', { name: '$' })
    await userEvent.click(dollar)
    expect(dollar).toHaveAttribute('aria-pressed', 'true')
  })

  it('disables Before due when the invoice has no due date', () => {
    setup({ dueDate: null })
    expect(screen.getByRole('button', { name: /before due/i })).toBeDisabled()
  })

  it('unchecking the remainder box turns the last stage into a numeric share', async () => {
    setup()
    expect(screen.getByText(/rest/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /remaining balance/i }))
    expect(screen.queryByText(/rest/i)).not.toBeInTheDocument()
  })

  it('disables Apply with a warning for an unresolvable schedule', () => {
    setup({
      defaultSchedule: {
        id: 'bad',
        name: 'Bad',
        isDefault: true,
        stages: [
          { label: 'A', amountType: 'percent', amountValue: 30, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'B', amountType: 'percent', amountValue: 30, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      },
    })
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeDisabled()
    expect(screen.getByText(/do not add up/i)).toBeInTheDocument()
  })
})
