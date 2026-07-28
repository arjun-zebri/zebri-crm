import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { StepFounder } from '@/app/(dashboard)/onboarding/steps/step-founder'
import { StepWelcome } from '@/app/(dashboard)/onboarding/steps/step-welcome'

describe('StepWelcome', () => {
  it('names the product', () => {
    render(<StepWelcome />)
    expect(screen.getByRole('heading', { name: /welcome to zebri/i })).toBeInTheDocument()
  })
})

describe('StepFounder', () => {
  it('shows the founder note and signature', () => {
    render(<StepFounder />)
    expect(screen.getByRole('heading', { name: /a note from the founder/i })).toBeInTheDocument()
    expect(screen.getByText('Arjun Punekar')).toBeInTheDocument()
  })
})
