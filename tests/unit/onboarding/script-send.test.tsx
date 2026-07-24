import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptSend } from '@/app/(dashboard)/onboarding/previews/script-send'

describe('ScriptSend', () => {
  it('ends on the composed email with a Sent confirmation', () => {
    render(<ScriptSend active reducedMotion />)
    // The compose modal is the closing frame; its Send button reads Sent.
    expect(screen.getByText('Email Ellie & Tom')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Couples')).toHaveAttribute('data-active', 'true')
  })

  it('shows no compose modal when inactive', () => {
    render(<ScriptSend active={false} reducedMotion={false} />)
    expect(screen.queryByText('Sent')).not.toBeInTheDocument()
    expect(screen.queryByText('Email Ellie & Tom')).not.toBeInTheDocument()
  })
})
