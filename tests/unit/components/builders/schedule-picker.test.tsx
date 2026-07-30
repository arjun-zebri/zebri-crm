import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SchedulePicker } from '@/components/builders/parts/schedule-picker'
import type { PaymentSchedule } from '@/types/payment-schedule'

const schedules: PaymentSchedule[] = [
  {
    id: 'a',
    name: '30 / 70 split',
    isDefault: true,
    stages: [
      { label: 'Deposit', amountType: 'percent', amountValue: 30, dueOffsetDays: 0 },
      { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 60 },
    ],
  },
]

function setup(overrides: Partial<Parameters<typeof SchedulePicker>[0]> = {}) {
  const props = {
    schedules,
    loading: false,
    error: null,
    onApply: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSetDefault: vi.fn(),
    ...overrides,
  }
  render(<SchedulePicker {...props} />)
  return props
}

describe('SchedulePicker', () => {
  it('applies a saved schedule when picked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    await userEvent.click(screen.getByRole('button', { name: /30 \/ 70 split/i }))
    expect(props.onApply).toHaveBeenCalledWith(schedules[0])
  })

  it('applies null for the single-payment entry', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    await userEvent.click(screen.getByRole('button', { name: /no schedule/i }))
    expect(props.onApply).toHaveBeenCalledWith(null)
  })

  it('shows an empty state that points at the builder', async () => {
    setup({ schedules: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    expect(screen.getByText(/no saved schedules yet/i)).toBeInTheDocument()
  })

  it('shows a loading state', async () => {
    setup({ loading: true, schedules: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows an error state', async () => {
    setup({ error: 'Network down', schedules: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    expect(screen.getByText(/network down/i)).toBeInTheDocument()
  })
})
