/**
 * The Global style popover (`features/proposals/editor/global-style/`):
 * opens from its button, its Page tab controls dispatch `setTheme`
 * patches (committed), the Text tab patches one role at a time, and
 * "Reset to default" sends the whole Branding-seeded theme.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { defaultTheme, GlobalStylePopover, type ProposalTheme } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function open(theme: ProposalTheme = defaultTheme(branding)) {
  const dispatch = vi.fn()
  render(<GlobalStylePopover theme={theme} branding={branding} dispatch={dispatch} boundsRef={createRef<HTMLElement>()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Global style' }))
  return dispatch
}

describe('GlobalStylePopover', () => {
  it('opens on the Page tab with the flow, gap and animation controls', () => {
    open()
    expect(screen.getByRole('tab', { name: 'Page' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Stacked' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Slide in' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a Page tab pill dispatches a committed setTheme patch', () => {
    const dispatch = open()
    fireEvent.click(screen.getByRole('button', { name: 'One at a time' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { flow: 'step' } }, { commit: true })
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { sectionGap: 64 } }, { commit: true })
    fireEvent.click(screen.getByRole('button', { name: 'Fast' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { animation: { speed: 'fast' } } }, { commit: true })
  })

  it('Page width pill patches the theme\'s contentWidth; Custom nudges it to a number', () => {
    const dispatch = open()
    expect(screen.getByText('Page width')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Wide' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { contentWidth: 'wide' } }, { commit: true })
    // Page width sits first in the tab, so its Custom is the first of the four.
    fireEvent.click(screen.getAllByRole('button', { name: 'Custom' })[0]!)
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { contentWidth: 721 } }, { commit: true })
  })

  it('vertical and horizontal padding are two controls, each with its own stops and Custom stepper', () => {
    const dispatch = open()
    expect(screen.getByText('Vertical padding')).toBeInTheDocument()
    expect(screen.getByText('Horizontal padding')).toBeInTheDocument()
    // Cozy is lit on both by default (48px tall, 32px wide).
    expect(screen.getAllByRole('button', { name: 'Cozy' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Roomy' })[0]!)
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { sectionPadding: 'roomy' } }, { commit: true })
    fireEvent.click(screen.getAllByRole('button', { name: 'Roomy' })[1]!)
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { sectionPaddingX: 64 } }, { commit: true })
    // Custom on the horizontal pill nudges the value off its stop, as the gap's does.
    fireEvent.click(screen.getAllByRole('button', { name: 'Custom' })[3]!)
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { sectionPaddingX: 33 } }, { commit: true })
  })

  it('"Custom" gap reveals a stepper and turns the value numeric', () => {
    const dispatch = open()
    expect(screen.queryByRole('spinbutton', { name: 'Section gap' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Custom' })[1]!)
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { sectionGap: 1 } }, { commit: true })
  })

  it('the Text tab patches only the selected role', () => {
    const dispatch = open()
    fireEvent.click(screen.getByRole('tab', { name: 'Text' }))
    // Role picker is a dropdown defaulting to "Heading 1"; open it and pick "Paragraph".
    fireEvent.click(screen.getByRole('button', { name: 'Heading 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph' }))
    fireEvent.click(screen.getByRole('button', { name: 'Align center' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: { text: { paragraph: { align: 'center' } } } }, { commit: true })
  })

  it('"Reset to default" dispatches the full Branding-seeded theme', () => {
    const dispatch = open({ ...defaultTheme(branding), sectionGap: 64 })
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTheme', patch: defaultTheme(branding) }, { commit: true })
  })

  it('the Background swatch opens its colour picker', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Page background' }))
    expect(screen.getByPlaceholderText('#000000')).toBeInTheDocument()
  })
})
