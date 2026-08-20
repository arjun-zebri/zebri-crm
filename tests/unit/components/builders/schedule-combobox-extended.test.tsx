/**
 * Tests for the expanded combobox behaviour: the input itself opens the
 * dropdown (not just the chevron), typing filters saved schedules, and an
 * unmatched name offers a Notion-style "Create '<typed>'" row.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleCombobox } from '@/components/builders/parts/schedule-combobox'
import type { PaymentSchedule } from '@/types/payment-schedule'

const schedules: PaymentSchedule[] = [
  {
    id: '1',
    name: 'Fifty-Fifty',
    isDefault: true,
    stages: [
      { label: 'Deposit', amountType: 'percent', amountValue: 50, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
      { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
    ],
  },
  {
    id: '2',
    name: 'Quarter Split',
    isDefault: false,
    stages: [
      { label: 'A', amountType: 'percent', amountValue: 25, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
      { label: 'B', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
    ],
  },
]

function setup() {
  const mocks = {
    onPick: vi.fn(),
    onSetDefault: vi.fn(),
    onDelete: vi.fn(),
    onCreateNew: vi.fn(),
  }
  const Wrapper = () => {
    const [name, setName] = useState('')
    return (
      <ScheduleCombobox
        name={name}
        onNameChange={setName}
        schedules={schedules}
        loading={false}
        error={null}
        onPick={mocks.onPick}
        onSetDefault={mocks.onSetDefault}
        onDelete={mocks.onDelete}
        onCreateNew={mocks.onCreateNew}
      />
    )
  }
  render(<Wrapper />)
  return mocks
}

describe('ScheduleCombobox expanded behaviour', () => {
  it('clicking the input opens the dropdown of saved schedules', async () => {
    setup()
    expect(screen.queryByText(/Fifty-Fifty/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(/^schedule$/i))
    expect(screen.getByText(/Fifty-Fifty/)).toBeInTheDocument()
    expect(screen.getByText(/Quarter Split/)).toBeInTheDocument()
  })

  it('typing filters the saved schedules', async () => {
    setup()
    await userEvent.click(screen.getByLabelText(/^schedule$/i))
    await userEvent.keyboard('quarter')
    expect(screen.getByText(/Quarter Split/)).toBeInTheDocument()
    expect(screen.queryByText(/Fifty-Fifty/)).not.toBeInTheDocument()
  })

  it("offers a Create '<typed>' row when the name matches no saved schedule", async () => {
    const mocks = setup()
    await userEvent.click(screen.getByLabelText(/^schedule$/i))
    await userEvent.keyboard('Thirds')
    const createRow = screen.getByRole('button', { name: /create 'thirds'/i })
    await userEvent.click(createRow)
    expect(mocks.onCreateNew).toHaveBeenCalledWith('Thirds')
    // Picking Create closes the dropdown.
    expect(screen.queryByText(/Quarter Split/)).not.toBeInTheDocument()
  })

  it('shows no Create row when the typed name exactly matches a saved schedule', async () => {
    setup()
    await userEvent.click(screen.getByLabelText(/^schedule$/i))
    await userEvent.keyboard('Fifty-Fifty')
    expect(screen.queryByRole('button', { name: /^create/i })).not.toBeInTheDocument()
  })

  it('Escape closes the dropdown', async () => {
    setup()
    await userEvent.click(screen.getByLabelText(/^schedule$/i))
    expect(screen.getByText(/Fifty-Fifty/)).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText(/Fifty-Fifty/)).not.toBeInTheDocument()
  })

  it('clicking a schedule item closes the dropdown and calls onPick', async () => {
    const mocks = setup()
    await userEvent.click(screen.getByLabelText(/^schedule$/i))
    const buttons = screen.getAllByRole('button')
    const fiftyFifty = buttons.find((b) => b.textContent?.includes('Fifty-Fifty'))
    expect(fiftyFifty).toBeDefined()
    await userEvent.click(fiftyFifty!)
    expect(mocks.onPick).toHaveBeenCalledWith(schedules[0])
    expect(screen.queryByText(/Quarter Split/)).not.toBeInTheDocument()
  })

  it('keeps the star (set-default) and delete row actions', async () => {
    setup()
    await userEvent.click(screen.getByLabelText(/^schedule$/i))
    expect(screen.getAllByLabelText(/set .* as default/i).length).toBe(2)
    expect(screen.getAllByLabelText(/delete/i).length).toBe(2)
  })
})
