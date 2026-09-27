/**
 * The Wait chip's modes (owner ruling 2026-09-27, wait block).
 *
 * The builder offers two ways to wait: a fixed amount of time, or a
 * "Relative date" (before or after the event, now in months too). "Until
 * a specific date" is no longer offered. A Wait saved with it still runs,
 * shows as "Until <date>", and can be switched to a supported mode.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WAIT_CHIPS } from '@/app/(dashboard)/workflows/[id]/wait-chips'

const waitChip = WAIT_CHIPS.find((c) => c.key === 'wait')!

function renderPopover(config: Record<string, unknown>) {
  const setConfig = vi.fn()
  render(<>{waitChip.render!(config, setConfig)}</>)
  return setConfig
}

describe('the Wait chip modes', () => {
  it('offers a fixed amount of time and a relative date, never a specific date', () => {
    renderPopover({ mode: 'duration', durationMinutes: 1440 })
    expect(screen.getByText('A fixed amount of time')).toBeInTheDocument()
    expect(screen.getByText('Relative date')).toBeInTheDocument()
    expect(screen.queryByText('Until a specific date')).toBeNull()
    expect(screen.queryByText('Before or after the event')).toBeNull()
  })

  it('offers months on a relative date and writes them', () => {
    const setConfig = renderPopover({
      mode: 'relative_to_event',
      relative: { amount: 2, unit: 'weeks', direction: 'before', anchor: 'event_date' },
    })
    fireEvent.click(screen.getByText('Months'))
    expect(setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        relative: expect.objectContaining({ unit: 'months', amount: 2, direction: 'before' }),
      }),
    )
  })

  it('shows a saved specific-date wait as "Until <date>" and lets the MC switch away', () => {
    const setConfig = renderPopover({ mode: 'until_date', untilDate: '2027-01-03' })
    expect(screen.getByText('Until 3 Jan 2027')).toBeInTheDocument()
    // The date is not edited any more, only switched away from.
    expect(screen.queryByLabelText('Resume on')).toBeNull()
    fireEvent.click(screen.getByText('Relative date'))
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ mode: 'relative_to_event' }))
  })

  it('summarises a saved specific date and a months wait', () => {
    expect(waitChip.summary({ mode: 'until_date', untilDate: '2027-01-03' })).toBe('until 3 Jan 2027')
    expect(
      waitChip.summary({
        mode: 'relative_to_event',
        relative: { amount: 3, unit: 'months', direction: 'before', anchor: 'event_date' },
      }),
    ).toBe('3 months before the event')
    expect(
      waitChip.summary({
        mode: 'relative_to_event',
        relative: { amount: 1, unit: 'months', direction: 'after', anchor: 'event_date' },
      }),
    ).toBe('1 month after the event')
  })
})
