import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { WizardChrome, type WelcomeStep } from '@/app/(dashboard)/onboarding/wizard-chrome'

function setup(step: WelcomeStep) {
  const handlers = {
    onBack: vi.fn(), onSkip: vi.fn(), onNext: vi.fn(), onFinish: vi.fn(),
  }
  render(<WizardChrome step={step} saving={false} {...handlers} />)
  return handlers
}

describe('WizardChrome', () => {
  it('hides Back on the first step', () => {
    setup(1)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('shows Skip only on the form steps', () => {
    const { unmount } = render(
      <WizardChrome step={2} saving={false} onBack={vi.fn()} onSkip={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    unmount()
    setup(5)
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
  })

  it('shows Finish on the last step and calls onFinish', async () => {
    const user = userEvent.setup()
    const handlers = setup(8)
    await user.click(screen.getByRole('button', { name: /finish/i }))
    expect(handlers.onFinish).toHaveBeenCalledOnce()
    expect(handlers.onNext).not.toHaveBeenCalled()
  })

  it('reports progress for assistive tech', () => {
    setup(3)
    expect(screen.getByText('3 of 8')).toBeInTheDocument()
  })
})
