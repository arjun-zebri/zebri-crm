// tests/unit/features/proposals/editor/label-with-variables.test.tsx
/**
 * `LabelWithVariables`: a plain-string label input (accept button,
 * packages CTA, a rich-text button node) with an `@` button that drops a
 * `{{ id }}` token at the caret, so those fields take variables like the
 * rich fields do.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LabelWithVariables } from '@/features/proposals'

describe('LabelWithVariables', () => {
  it('inserts a {{ id }} token at the caret when a variable is picked', async () => {
    const onChange = vi.fn()
    render(<LabelWithVariables label="Button label" value="Book now" onChange={onChange} onBlur={() => {}} />)
    const input = screen.getByLabelText('Button label') as HTMLInputElement
    input.focus()
    input.setSelectionRange(5, 5)
    // Clicking the picker blurs the field first; the caret it had is what counts.
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole('button', { name: 'Insert variable' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Couple name' }))
    expect(onChange).toHaveBeenCalledWith('Book {{couple_name}} now')
  })

  it('appends the token when the field has never been focused', async () => {
    const onChange = vi.fn()
    render(<LabelWithVariables label="Button label" value="Book" onChange={onChange} onBlur={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Insert variable' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Venue' }))
    expect(onChange).toHaveBeenCalledWith('Book {{venue}}')
  })

  it('types through to onChange and fires onBlur', () => {
    const onChange = vi.fn()
    const onBlur = vi.fn()
    render(<LabelWithVariables label="Button label" value="A" onChange={onChange} onBlur={onBlur} />)
    const input = screen.getByLabelText('Button label')
    fireEvent.change(input, { target: { value: 'AB' } })
    expect(onChange).toHaveBeenCalledWith('AB')
    fireEvent.blur(input)
    expect(onBlur).toHaveBeenCalled()
  })
})
