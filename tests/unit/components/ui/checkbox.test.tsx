/**
 * Unit coverage for the `Checkbox` primitive — toggle behaviour,
 * a11y contract (role + aria-checked), label click-through, and the
 * disabled state.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Checkbox } from '@/components/ui/checkbox'

describe('<Checkbox />', () => {
  it('renders with role=checkbox and reflects checked state', () => {
    render(<Checkbox checked={true} onChange={() => {}} label="BCC yourself" />)
    const box = screen.getByRole('checkbox', { name: 'BCC yourself' })
    expect(box).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with the inverted state on click', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Track" />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles when the label text is clicked', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={true} onChange={onChange} label="CC vendors" />)
    await userEvent.click(screen.getByText('CC vendors'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not fire when disabled', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Off" disabled />)
    await userEvent.click(screen.getByText('Off'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is not a native input (design-system rule)', () => {
    const { container } = render(
      <Checkbox checked={false} onChange={() => {}} label="x" />,
    )
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('button[role="checkbox"]')).not.toBeNull()
  })
})
