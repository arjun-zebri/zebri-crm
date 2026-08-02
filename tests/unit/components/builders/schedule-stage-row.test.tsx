import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleStageRow, type StageDraft } from '@/components/builders/parts/schedule-stage-row'

const base: StageDraft = {
  key: 'k1',
  label: 'Deposit',
  amountType: 'percent',
  amountValue: 25,
  offsetValue: 7,
  offsetUnit: 'day',
  offsetAnchor: 'issue',
  paidAt: null,
}

function setup(overrides: Partial<StageDraft> = {}) {
  const props = { stage: { ...base, ...overrides }, onChange: vi.fn(), onRemove: vi.fn() }
  render(<ScheduleStageRow {...props} />)
  return props
}

describe('ScheduleStageRow', () => {
  it('edits the label', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText(/stage label/i), { target: { value: 'Booking fee' } })
    expect(props.onChange).toHaveBeenCalledWith({ label: 'Booking fee' })
  })

  it('edits the share', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText(/^share$/i), { target: { value: '40' } })
    expect(props.onChange).toHaveBeenCalledWith({ amountValue: 40 })
  })

  it('edits the offset amount', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText(/offset amount/i), { target: { value: '14' } })
    expect(props.onChange).toHaveBeenCalledWith({ offsetValue: 14 })
  })

  it('shows the percent unit for a percent stage', () => {
    setup()
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('shows the dollar unit for a fixed stage', () => {
    setup({ amountType: 'fixed' })
    expect(screen.getByText('$')).toBeInTheDocument()
  })

  it('shows "rest" and no share input for a remainder stage', () => {
    setup({ amountType: 'remainder', amountValue: null })
    expect(screen.getByText(/rest/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^share$/i)).not.toBeInTheDocument()
  })

  it('removes the row', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /remove deposit/i }))
    expect(props.onRemove).toHaveBeenCalled()
  })

  it('locks a paid stage: read-only, no remove', () => {
    setup({ paidAt: '2026-07-02T00:00:00Z' })
    expect(screen.getByLabelText(/stage label/i)).toBeDisabled()
    expect(screen.getByLabelText(/offset amount/i)).toBeDisabled()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })
})
