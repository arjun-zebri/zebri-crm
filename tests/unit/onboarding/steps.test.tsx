import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { StepDetails, type WelcomeProfile } from '@/app/(dashboard)/onboarding/steps/step-details'
import { StepLinks } from '@/app/(dashboard)/onboarding/steps/step-links'

const EMPTY: WelcomeProfile = {
  displayName: 'Sam Reed', businessName: 'Reed MC', phone: '',
  addressText: '', addressLat: null, addressLng: null,
  mcSignatureName: '', website: '', instagramUrl: '', facebookUrl: '',
}

describe('StepDetails', () => {
  it('prefills name and business name', () => {
    render(<StepDetails value={EMPTY} email="sam@reed.com" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Your name')).toHaveValue('Sam Reed')
    expect(screen.getByLabelText('Business name')).toHaveValue('Reed MC')
  })

  it('shows email as read-only', () => {
    render(<StepDetails value={EMPTY} email="sam@reed.com" onChange={vi.fn()} />)
    const email = screen.getByLabelText('Email')
    expect(email).toHaveValue('sam@reed.com')
    expect(email).toHaveAttribute('readonly')
  })

  it('reports edits to the business name', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StepDetails value={EMPTY} email="sam@reed.com" onChange={onChange} />)
    await user.type(screen.getByLabelText('Business name'), '!')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, businessName: 'Reed MC!' })
  })
})

describe('StepLinks', () => {
  it('reports edits to the website', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StepLinks value={EMPTY} onChange={onChange} />)
    await user.type(screen.getByLabelText('Website'), 'x')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, website: 'x' })
  })
})
