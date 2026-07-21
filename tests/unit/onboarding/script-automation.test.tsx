import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptAutomation } from '@/app/(dashboard)/onboarding/previews/script-automation'

describe('ScriptAutomation', () => {
  it('ends with the real trigger and action labels', () => {
    render(<ScriptAutomation active reducedMotion />)
    expect(screen.getByText('New enquiry')).toBeInTheDocument()
    expect(screen.getByText('Send email')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toHaveAttribute('data-active', 'true')
  })

  it('shows an empty canvas when inactive', () => {
    render(<ScriptAutomation active={false} reducedMotion={false} />)
    expect(screen.queryByText('Send email')).not.toBeInTheDocument()
  })
})
