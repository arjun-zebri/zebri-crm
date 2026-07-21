import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import type { WelcomeProfile } from '@/app/(dashboard)/onboarding/steps/step-details'
import { WelcomeWizard } from '@/app/(dashboard)/onboarding/welcome-wizard'

const INITIAL: WelcomeProfile = {
  displayName: 'Sam Reed', businessName: 'Reed MC', phone: '',
  addressText: '', addressLat: null, addressLng: null,
  mcSignatureName: '', website: '', instagramUrl: '', facebookUrl: '',
}

function setup(save = vi.fn().mockResolvedValue({ ok: true as const })) {
  const onExit = vi.fn()
  render(
    <WelcomeWizard initial={INITIAL} email="sam@reed.com" onSaveProfile={save} onExit={onExit} />,
  )
  return { save, onExit, user: userEvent.setup() }
}

const next = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /next/i }))

describe('WelcomeWizard', () => {
  it('saves once when leaving step 3, with the edited values', async () => {
    const { save, user } = setup()
    await next(user)                                     // 1 -> 2
    await user.type(screen.getByLabelText('Phone'), '0400')
    await next(user)                                     // 2 -> 3
    await user.type(screen.getByLabelText('Website'), 'z.com')
    await next(user)                                     // 3 -> 4, saves

    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith({ ...INITIAL, phone: '0400', website: 'z.com' })
  })

  it('does not save when moving between steps 1 and 2', async () => {
    const { save, user } = setup()
    await next(user)
    expect(save).not.toHaveBeenCalled()
  })

  it('advances and surfaces a message when the save fails', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false as const, message: 'Network down' })
    const { user } = setup(save)
    await next(user)
    await next(user)
    await next(user)

    expect(await screen.findByText(/network down/i)).toBeInTheDocument()
    // The user is not trapped: the flow continues regardless.
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('calls onExit from Finish on the last step', async () => {
    const { onExit, user } = setup()
    for (let i = 0; i < 7; i++) await next(user)
    await user.click(screen.getByRole('button', { name: /finish/i }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('does not re-save when stepping back to 3 and forward again', async () => {
    const { save, user } = setup()
    await next(user); await next(user); await next(user)
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: /back/i }))
    await next(user)
    expect(save).toHaveBeenCalledOnce()
  })
})
