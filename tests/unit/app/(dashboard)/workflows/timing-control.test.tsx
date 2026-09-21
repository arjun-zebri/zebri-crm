import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TimingControl } from '@/app/(dashboard)/workflows/[id]/timing-control'

describe('TimingControl', () => {
  it('shows a Send at select for a wedding-relative step', () => {
    render(<TimingControl value={{ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days' }} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Send at' })).toBeInTheDocument()
  })

  it('hides Send at for a chained delay', () => {
    render(<TimingControl value={{ mode: 'after_previous', delayAmount: 45, unit: 'minutes' }} onChange={vi.fn()} />)
    expect(screen.queryByRole('combobox', { name: 'Send at' })).toBeNull()
    expect(screen.getByRole('spinbutton', { name: 'How many' })).toHaveAttribute('step', '15')
  })

  it('hides Send at for a sub-day apply delay', () => {
    render(<TimingControl value={{ mode: 'apply_relative', amount: 2, unit: 'hours' }} onChange={vi.fn()} />)
    expect(screen.queryByRole('combobox', { name: 'Send at' })).toBeNull()
  })

  it('holds a typed minutes amount as a draft and commits it on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimingControl value={{ mode: 'after_previous', delayAmount: 15, unit: 'minutes' }} onChange={onChange} />)
    const field = screen.getByRole('spinbutton', { name: 'How many' })
    await user.clear(field)
    await user.type(field, '30')
    expect(onChange).not.toHaveBeenCalled()
    await user.tab()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ mode: 'after_previous', delayAmount: 30, unit: 'minutes' })
  })

  it('snaps an off-grid minutes draft to the grid on Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimingControl value={{ mode: 'after_previous', delayAmount: 15, unit: 'minutes' }} onChange={onChange} />)
    const field = screen.getByRole('spinbutton', { name: 'How many' })
    await user.clear(field)
    await user.type(field, '20{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' })
  })
})
