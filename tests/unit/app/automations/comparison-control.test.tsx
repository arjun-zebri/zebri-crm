/**
 * The number field inside a trigger filter chip.
 *
 * It holds a whole non-negative number and nothing else, so a letter
 * must not be typeable in the first place — reverting on blur would
 * still have let one appear on screen. The other rule worth pinning is
 * that clearing the box and leaving it restores the previous value
 * rather than committing 0, since clearing is how you start retyping.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ComparisonControl } from '@/app/(dashboard)/automations/[id]/filter-controls'

/** Harness holding the committed value the way a filter chip does. */
function Harness({ onCommit }: { onCommit?: (value: number) => void }) {
  const [value, setValue] = useState(14)
  return (
    <>
      <ComparisonControl
        value={value}
        unit="days"
        onChange={(_op, next) => {
          setValue(next)
          onCommit?.(next)
        }}
      />
      <output data-testid="committed">{value}</output>
    </>
  )
}

function field() {
  return screen.getByRole('textbox', { name: 'Number of days' })
}

describe('ComparisonControl number field', () => {
  it('accepts digits', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.clear(field())
    await user.type(field(), '30')
    expect(field()).toHaveValue('30')
  })

  it('ignores letters as they are typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.clear(field())
    await user.type(field(), '1a2b3')
    expect(field()).toHaveValue('123')
  })

  it('ignores symbols, decimals and minus signs', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.clear(field())
    await user.type(field(), '-1.5$')
    expect(field()).toHaveValue('15')
  })

  it('strips separators out of a pasted amount', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.clear(field())
    await user.paste('$1,000')
    expect(field()).toHaveValue('1000')
  })

  it('commits the typed number on blur', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<Harness onCommit={onCommit} />)
    await user.clear(field())
    await user.type(field(), '30')
    await user.tab()
    expect(onCommit).toHaveBeenCalledWith(30)
    expect(screen.getByTestId('committed')).toHaveTextContent('30')
  })

  it('restores the previous value when left empty', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<Harness onCommit={onCommit} />)
    await user.clear(field())
    await user.tab()
    expect(field()).toHaveValue('14')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commits a typed number when the popover closes without a blur', async () => {
    // Clicking outside the popover unmounts the field, and React does
    // not deliver a blur to an element that is already gone — so the
    // number only used to save if you went on to click an operator.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { unmount } = render(
      <ComparisonControl value={14} unit="days" onChange={onChange} />,
    )
    await user.clear(field())
    await user.type(field(), '30')
    expect(onChange).not.toHaveBeenCalled()

    unmount()
    expect(onChange).toHaveBeenCalledWith('', 30)
  })

  it('does not re-commit an unchanged value on close', async () => {
    const onChange = vi.fn()
    const { unmount } = render(
      <ComparisonControl value={14} unit="days" onChange={onChange} />,
    )
    unmount()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('still allows an explicit zero', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<Harness onCommit={onCommit} />)
    await user.clear(field())
    await user.type(field(), '0')
    await user.tab()
    expect(onCommit).toHaveBeenCalledWith(0)
  })
})
