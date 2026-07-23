import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptTemplate } from '@/app/(dashboard)/onboarding/previews/script-template'

describe('ScriptTemplate', () => {
  it('shows the finished template under reduced motion', () => {
    render(<ScriptTemplate active reducedMotion />)
    expect(screen.getAllByText('Enquiry reply')).toHaveLength(2)
    expect(screen.getByText('Couple display name')).toBeInTheDocument()
    const templatesNav = screen.getAllByText('Templates').find(el => el.hasAttribute('data-active'))
    expect(templatesNav).toHaveAttribute('data-active', 'true')
  })

  it('shows nothing typed when inactive', () => {
    render(<ScriptTemplate active={false} reducedMotion={false} />)
    expect(screen.queryByText('Couple display name')).not.toBeInTheDocument()
  })
})
