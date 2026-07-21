import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import type { WelcomeProfile } from '@/app/(dashboard)/onboarding/steps/step-details'
import { WelcomeModal } from '@/app/(dashboard)/onboarding/welcome-modal'

const INITIAL: WelcomeProfile = {
  displayName: 'Sam Reed', businessName: 'Reed MC', phone: '',
  addressText: '', addressLat: null, addressLng: null,
  mcSignatureName: '', website: '', instagramUrl: '', facebookUrl: '',
}

describe('WelcomeModal', () => {
  it('is dismissible with Escape and reports the dismissal', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <WelcomeModal
        isOpen
        initial={INITIAL}
        email="sam@reed.com"
        onSaveProfile={vi.fn().mockResolvedValue({ ok: true })}
        onDismiss={onDismiss}
      />,
    )
    expect(screen.getByRole('heading', { name: /welcome to zebri/i })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders nothing when closed', () => {
    render(
      <WelcomeModal
        isOpen={false}
        initial={INITIAL}
        email="sam@reed.com"
        onSaveProfile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.queryByRole('heading', { name: /welcome to zebri/i })).not.toBeInTheDocument()
  })
})
