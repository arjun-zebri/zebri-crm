/**
 * The shared editor primitives now live in components/editor; the Branding
 * paths only re-export them. Both import paths must resolve to the same
 * components so neither editor drifts.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import * as legacy from '@/app/(dashboard)/branding/blocks/toolbar-primitives'
import { PillToggle, ToolbarDivider } from '@/components/editor'

describe('components/editor toolbar primitives', () => {
  it('PillToggle marks the active option and reports changes', async () => {
    const onChange = vi.fn()
    render(<PillToggle options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} value="a" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('renders a divider', () => {
    const { container } = render(<ToolbarDivider />)
    expect(container.firstChild).not.toBeNull()
  })

  it('the Branding path re-exports the same components', () => {
    expect(legacy.PillToggle).toBe(PillToggle)
    expect(legacy.ToolbarDivider).toBe(ToolbarDivider)
  })
})
