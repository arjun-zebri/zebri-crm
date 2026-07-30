import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleLibraryList } from '@/components/builders/parts/schedule-library-list'
import type { PaymentSchedule } from '@/types/payment-schedule'

const schedules: PaymentSchedule[] = [
  {
    id: 'a',
    name: 'Default',
    isDefault: true,
    stages: [
      { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
      { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
    ],
  },
]

function setup(overrides: Partial<Parameters<typeof ScheduleLibraryList>[0]> = {}) {
  const props = {
    schedules,
    onApply: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onSetDefault: vi.fn(),
    onDelete: vi.fn(),
    onNew: vi.fn(),
    ...overrides,
  }
  render(<ScheduleLibraryList {...props} />)
  return props
}

describe('ScheduleLibraryList', () => {
  it('applies a schedule when its row is clicked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /default/i }))
    expect(props.onApply).toHaveBeenCalledWith(schedules[0])
  })

  it('renders the summary from describeSchedule', () => {
    setup()
    expect(screen.getByText('25%, then remainder')).toBeInTheDocument()
  })

  it('fires Edit from the overflow menu', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(props.onEdit).toHaveBeenCalledWith(schedules[0])
  })

  it('fires Delete from the overflow menu', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(props.onDelete).toHaveBeenCalledWith(schedules[0])
  })

  it('offers New schedule', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /new schedule/i }))
    expect(props.onNew).toHaveBeenCalled()
  })

  it('shows an empty-library line', () => {
    setup({ schedules: [] })
    expect(screen.getByText(/no saved schedules/i)).toBeInTheDocument()
  })
})
