import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptCouple } from '@/app/(dashboard)/onboarding/previews/script-couple'

describe('ScriptCouple', () => {
  it('shows the finished state immediately under reduced motion', () => {
    render(<ScriptCouple active reducedMotion />)
    // Final beat: the saved couple row is on screen.
    expect(screen.getByText('Ellie & Tom')).toBeInTheDocument()
    // Couples appears in nav and content; find the nav item with data-active.
    const couplesNav = screen.getAllByText('Couples').find(el => el.hasAttribute('data-active'))
    expect(couplesNav).toHaveAttribute('data-active', 'true')
  })

  it('starts from an empty frame when inactive', () => {
    render(<ScriptCouple active={false} reducedMotion={false} />)
    expect(screen.queryByText('Ellie & Tom')).not.toBeInTheDocument()
  })
})
