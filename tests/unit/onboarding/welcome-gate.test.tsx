/**
 * Unit tests for {@link WelcomeGate} — the decision layer that opens the
 * welcome wizard on first login.
 *
 * The gate is the only thing standing between a fresh signup and the
 * onboarding tour, so its suppression rules get tested directly rather
 * than through the modal.
 *
 * @module tests/unit/onboarding/welcome-gate.test.tsx
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { WelcomeGate } from '@/app/(dashboard)/onboarding/welcome-gate'
import { WELCOME_CACHE_KEY } from '@/app/(dashboard)/onboarding/welcome-modal'

const getUser = vi.fn()
const updateUser = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser, updateUser } }),
}))

/** Minimal auth user shape the gate reads from. */
function fakeUser(id: string, metadata: Record<string, unknown> = {}) {
  return { id, email: `${id}@zebri.com.au`, user_metadata: metadata }
}

const heading = () => screen.queryByRole('heading', { name: /welcome to zebri/i })

describe('WelcomeGate', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('opens the wizard for a user who has never onboarded', async () => {
    getUser.mockResolvedValue({ data: { user: fakeUser('fresh') } })
    render(<WelcomeGate />)
    await waitFor(() => expect(heading()).toBeInTheDocument())
  })

  it('stays shut for a user already stamped as onboarded', async () => {
    getUser.mockResolvedValue({
      data: { user: fakeUser('done', { welcome_onboarded_at: '2026-07-24T00:00:00Z' }) },
    })
    render(<WelcomeGate />)
    await waitFor(() => expect(getUser).toHaveBeenCalled())
    expect(heading()).not.toBeInTheDocument()
  })

  it('opens for a new signup in a browser where another account onboarded', async () => {
    // The cache is a browser-level hint, and sign-out does not clear it,
    // so this unscoped key is what a developer's browser actually holds
    // after they dismiss the tour once. Scoping the cache per user is
    // what stops one account's dismissal from silently swallowing the
    // tour for the next person to sign up in the same browser.
    localStorage.setItem(WELCOME_CACHE_KEY, 'true')
    getUser.mockResolvedValue({ data: { user: fakeUser('brand-new') } })
    render(<WelcomeGate />)
    await waitFor(() => expect(heading()).toBeInTheDocument())
  })

  it('skips the wizard for the same user on a repeat visit', async () => {
    localStorage.setItem(`${WELCOME_CACHE_KEY}:repeat`, 'true')
    getUser.mockResolvedValue({ data: { user: fakeUser('repeat') } })
    render(<WelcomeGate />)
    await waitFor(() => expect(getUser).toHaveBeenCalled())
    expect(heading()).not.toBeInTheDocument()
  })
})
