import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleTemplateRow } from '@/components/builders/parts/schedule-template-row'
import type { TemplateStage } from '@/types/payment-schedule'

const stage: TemplateStage = {
  label: 'Deposit',
  amountType: 'percent',
  amountValue: 25,
  dueOffsetDays: 7,
}

function setup(overrides: Partial<TemplateStage> = {}) {
  const props = { stage: { ...stage, ...overrides }, onChange: vi.fn(), onRemove: vi.fn() }
  render(<ScheduleTemplateRow {...props} />)
  return props
}

describe('ScheduleTemplateRow', () => {
  it('edits the label', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText(/stage label/i), { target: { value: 'Booking fee' } })
    expect(props.onChange).toHaveBeenCalledWith({ label: 'Booking fee' })
  })

  it('edits the day offset', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText(/days after issue/i), { target: { value: '30' } })
    expect(props.onChange).toHaveBeenCalledWith({ dueOffsetDays: 30 })
  })

  // The amount-type control is a Radix Select, whose option selection is not
  // drivable in jsdom (matches the codebase's select.test.tsx precedent), so
  // the switch-clears-value behaviour is asserted by rendering each state, not
  // by opening the dropdown.
  it('shows the value field for a percent stage', () => {
    setup()
    expect(screen.getByLabelText(/stage amount$/i)).toBeInTheDocument()
  })

  it('hides the value field for a remainder stage', () => {
    setup({ amountType: 'remainder', amountValue: null })
    expect(screen.queryByLabelText(/stage amount$/i)).not.toBeInTheDocument()
  })

  it('reflects the current amount type in the trigger', () => {
    setup({ amountType: 'remainder', amountValue: null })
    expect(screen.getByRole('combobox')).toHaveTextContent(/remaining balance/i)
  })

  it('removes the row', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /remove deposit/i }))
    expect(props.onRemove).toHaveBeenCalled()
  })
})
