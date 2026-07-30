import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleEditor } from '@/components/builders/parts/schedule-editor'
import type { TemplateStage } from '@/types/payment-schedule'

const stages: TemplateStage[] = [
  { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
  { label: 'Final balance', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
]

function setup(overrides: Partial<Parameters<typeof ScheduleEditor>[0]> = {}) {
  const props = {
    schedule: { id: 'sch-1', name: 'Default', stages },
    saving: false,
    onBack: vi.fn(),
    onDirtyChange: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  }
  render(<ScheduleEditor {...props} />)
  return props
}

describe('ScheduleEditor', () => {
  it('saves the name and stages of an existing schedule', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onSave).toHaveBeenCalledWith({ name: 'Default', stages })
  })

  it('reports dirty when the name changes', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText(/schedule name/i), { target: { value: 'Deposit plan' } })
    expect(props.onDirtyChange).toHaveBeenCalledWith(true)
  })

  it('disables Save with a reason for two remainder stages', () => {
    setup({
      schedule: {
        id: 'sch-2',
        name: 'Broken',
        stages: [
          { label: 'A', amountType: 'remainder', amountValue: null, dueOffsetDays: 0 },
          { label: 'B', amountType: 'remainder', amountValue: null, dueOffsetDays: 0 },
        ],
      },
    })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(screen.getByText(/only one stage can take the remaining balance/i)).toBeInTheDocument()
  })

  it('disables Save with a reason when percentages exceed 100', () => {
    setup({
      schedule: {
        id: 'sch-3',
        name: 'Over',
        stages: [
          { label: 'A', amountType: 'percent', amountValue: 70, dueOffsetDays: 0 },
          { label: 'B', amountType: 'percent', amountValue: 70, dueOffsetDays: 0 },
        ],
      },
    })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(screen.getByText(/add up to more than 100/i)).toBeInTheDocument()
  })

  it('disables Save for a new empty schedule', () => {
    setup({ schedule: null })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('adds a stage', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /add stage/i }))
    expect(props.onDirtyChange).toHaveBeenCalledWith(true)
    expect(screen.getAllByLabelText(/stage label/i)).toHaveLength(3)
  })
})
