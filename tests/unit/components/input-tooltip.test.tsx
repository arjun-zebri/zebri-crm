import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Input } from '@/components/ui/input'

describe('Input label tooltip', () => {
  it('reveals the explanation on hover without occupying a help row', async () => {
    render(<Input label="Home address" tooltip="Used to calculate drive time." />)
    // Not rendered until hovered, which is the point: no permanent height.
    expect(screen.queryByText('Used to calculate drive time.')).toBeNull()

    const glyph = document.querySelector('svg')
    await userEvent.hover(glyph!.parentElement!)
    expect(await screen.findByText('Used to calculate drive time.')).toBeTruthy()
  })

  it('keeps the label bound to the input so getByLabelText still works', () => {
    render(<Input label="Home address" tooltip="Why we ask" />)
    expect(screen.getByLabelText('Home address')).toBeTruthy()
  })

  it('renders no glyph when no tooltip is given', () => {
    const { container } = render(<Input label="Plain" />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('lets a worked-example tooltip wrap instead of running off screen', async () => {
    const example =
      'Your contracts read: "This agreement is made between Zebri (the MC) and the Couple."'
    render(<Input label="What clients call you" tooltip={example} tooltipMultiline />)
    await userEvent.hover(document.querySelector('svg')!.parentElement!)

    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('(the MC)')
    // The single-line default would clip a sentence this long.
    expect(tip.className).toContain('whitespace-pre-line')
    expect(tip.className).not.toContain('whitespace-nowrap')
  })

  it('keeps short tooltips on one line', async () => {
    render(<Input label="Home address" tooltip="Used for drive time." />)
    await userEvent.hover(document.querySelector('svg')!.parentElement!)
    expect((await screen.findByRole('tooltip')).className).toContain('whitespace-nowrap')
  })
})
