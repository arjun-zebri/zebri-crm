import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NumberStepper } from '@/components/editor'

describe('NumberStepper', () => {
  it('steps within bounds and shows the suffix', async () => {
    const onChange = vi.fn()
    render(<NumberStepper value={48} min={0} max={50} step={4} onChange={onChange} ariaLabel="Padding" suffix="px" />)
    expect(screen.getByRole('spinbutton', { name: 'Padding' })).toHaveValue(48)
    expect(screen.getByText('px')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Increase Padding' }))
    expect(onChange).toHaveBeenCalledWith(50)
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Padding' }))
    expect(onChange).toHaveBeenCalledWith(44)
  })

  it('typing a value into the field commits it', () => {
    const onChange = vi.fn()
    render(<NumberStepper value={48} min={0} max={50} step={4} onChange={onChange} ariaLabel="Padding" suffix="px" />)
    const input = screen.getByRole('spinbutton', { name: 'Padding' })
    // fireEvent.change rather than userEvent.type: jsdom's type="number"
    // input does not support the selection-range calls userEvent.clear()
    // needs, so clear+type concatenates onto the existing "48" instead of
    // replacing it.
    fireEvent.change(input, { target: { value: '40' } })
    expect(onChange).toHaveBeenCalledWith(40)
  })
})
