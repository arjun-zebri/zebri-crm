import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptSend } from '@/app/(dashboard)/onboarding/previews/script-send'

describe('ScriptSend', () => {
  it('ends on a sent email in the history', () => {
    render(<ScriptSend active reducedMotion />)
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Enquiry reply')).toBeInTheDocument()
    expect(screen.getByText('Couples')).toHaveAttribute('data-active', 'true')
  })

  it('shows no history when inactive', () => {
    render(<ScriptSend active={false} reducedMotion={false} />)
    expect(screen.queryByText('Sent')).not.toBeInTheDocument()
  })
})
