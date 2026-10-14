/**
 * The "Optional" tag on Input and Textarea, and the label and error support
 * DatePicker gained for booking questions.
 *
 * @module tests/unit/components/ui/field-optional
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

describe('Input optional', () => {
  it('shows a quiet Optional tag beside the label, not inside it', () => {
    render(<Input label="Phone" optional />)

    expect(screen.getByLabelText('Phone')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })

  it('shows no tag by default', () => {
    render(<Input label="Email" />)

    expect(screen.queryByText('Optional')).not.toBeInTheDocument()
  })
})

describe('Textarea optional', () => {
  it('shows a quiet Optional tag beside the label', () => {
    render(<Textarea label="Notes" optional />)

    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })
})

describe('DatePicker label and error', () => {
  it('labels the trigger button so it can be found by its name', () => {
    render(<DatePicker label="Wedding date" id="wedding" value="" onChange={() => {}} placeholder="Pick a date" />)

    expect(screen.getByRole('button', { name: 'Wedding date' })).toHaveAttribute('id', 'wedding')
  })

  it('announces an error and marks the trigger invalid', () => {
    render(
      <DatePicker label="Wedding date" id="wedding" value="" onChange={() => {}} error="Enter a valid date" />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid date')
    expect(screen.getByRole('button', { name: 'Wedding date' })).toHaveAccessibleDescription('Enter a valid date')
  })

  it('shows the Optional tag and help text when given', () => {
    render(
      <DatePicker
        label="Wedding date"
        id="wedding"
        value=""
        onChange={() => {}}
        optional
        help="Your best guess is fine."
      />,
    )

    expect(screen.getByText('Optional')).toBeInTheDocument()
    expect(screen.getByText('Your best guess is fine.')).toBeInTheDocument()
  })
})
