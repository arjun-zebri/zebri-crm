/**
 * ChoiceGroup: single and multiple selection, ARIA roles, roving focus, and
 * arrow-key navigation.
 *
 * @module tests/unit/components/ui/choice-group
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ChoiceGroup } from '@/components/ui/choice-group'

const OPTIONS = ['Garden', 'Ballroom', 'Beach']

function SingleHarness({ onChange = vi.fn(), initial = null as string | null }) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <ChoiceGroup
      label="Venue type"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

function MultipleHarness({ onChange = vi.fn(), initial = [] as string[] }) {
  const [value, setValue] = useState<string[]>(initial)
  return (
    <ChoiceGroup
      mode="multiple"
      label="Services"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

describe('ChoiceGroup single mode', () => {
  it('is a labelled radiogroup of radio buttons', () => {
    render(<SingleHarness />)

    expect(screen.getByRole('radiogroup', { name: 'Venue type' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('chooses an option on click and marks it checked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleHarness onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Ballroom' }))

    expect(onChange).toHaveBeenCalledWith('Ballroom')
    expect(screen.getByRole('radio', { name: 'Ballroom' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Garden' })).toHaveAttribute('aria-checked', 'false')
  })

  it('puts the tab stop on the chosen option, or the first when nothing is chosen', () => {
    const { unmount } = render(<SingleHarness />)
    expect(screen.getByRole('radio', { name: 'Garden' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Ballroom' })).toHaveAttribute('tabindex', '-1')
    unmount()

    render(<SingleHarness initial="Beach" />)
    expect(screen.getByRole('radio', { name: 'Beach' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Garden' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleHarness onChange={onChange} />)

    screen.getByRole('radio', { name: 'Garden' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('Ballroom')
    expect(screen.getByRole('radio', { name: 'Ballroom' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('Beach')
    expect(screen.getByRole('radio', { name: 'Beach' })).toHaveFocus()
  })

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleHarness onChange={onChange} />)

    screen.getByRole('radio', { name: 'Ballroom' }).focus()
    await user.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('Beach')
    await user.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('Garden')
  })

  it('shows the error as an alert and marks the group invalid', () => {
    render(
      <ChoiceGroup label="Venue type" options={OPTIONS} value={null} onChange={() => {}} error="Choose an option" />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Choose an option')
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows help under the label and the Optional tag beside it', () => {
    render(
      <ChoiceGroup
        label="Venue type"
        options={OPTIONS}
        value={null}
        onChange={() => {}}
        help="Pick the closest one."
        optional
      />,
    )

    expect(screen.getByText('Pick the closest one.')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })
})

describe('ChoiceGroup multiple mode', () => {
  it('is a labelled group of checkbox buttons', () => {
    render(<MultipleHarness />)

    expect(screen.getByRole('group', { name: 'Services' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('toggles options on and off', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultipleHarness onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Beach' }))
    await user.click(screen.getByRole('checkbox', { name: 'Garden' }))
    expect(onChange).toHaveBeenLastCalledWith(['Garden', 'Beach'])

    await user.click(screen.getByRole('checkbox', { name: 'Beach' }))
    expect(onChange).toHaveBeenLastCalledWith(['Garden'])
  })

  it('keeps the option order the caller listed, whatever order they were ticked in', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultipleHarness onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Beach' }))
    await user.click(screen.getByRole('checkbox', { name: 'Garden' }))

    expect(onChange.mock.calls.at(-1)![0]).toEqual(['Garden', 'Beach'])
  })

  it('reflects checked state with aria-checked', () => {
    render(<MultipleHarness initial={['Ballroom']} />)

    expect(screen.getByRole('checkbox', { name: 'Ballroom' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Garden' })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('ChoiceGroup disabled', () => {
  it('does not choose an option when disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChoiceGroup label="Venue" options={OPTIONS} value={null} onChange={onChange} disabled />)

    await user.click(screen.getByRole('radio', { name: 'Garden' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
