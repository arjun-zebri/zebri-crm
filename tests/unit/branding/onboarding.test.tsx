import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { OnboardingWizard } from '@/app/(dashboard)/branding/onboarding/onboarding-wizard'

describe('OnboardingWizard', () => {
  it('walks through all three steps and completes with correct payload', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)

    render(
      <OnboardingWizard
        initial={{
          businessName: '',
          tagline: '',
          logoUrl: '',
          brandColor: '#6366F1',
          fontHeading: 'playfair',
          fontBody: 'inter',
          density: 'cozy',
        }}
        onComplete={onComplete}
      />,
    )

    // Step 1: Business
    expect(screen.getByText("Let's start with your identity")).toBeInTheDocument()

    const businessInput = screen.getByLabelText('Business name')
    await user.type(businessInput, 'My Wedding Band')

    const taglineInput = screen.getByLabelText('Tagline')
    await user.type(taglineInput, 'Making your day unforgettable')

    // Click Next to go to Step 2
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Step 2: Look
    await waitFor(() => {
      expect(screen.getByText('Choose your look')).toBeInTheDocument()
    })

    // Verify font pairings are shown
    expect(screen.getByLabelText('Serif classic')).toBeInTheDocument()
    expect(screen.getByLabelText('Modern')).toBeInTheDocument()
    expect(screen.getByLabelText('Editorial')).toBeInTheDocument()

    // Verify density options are shown
    expect(screen.getByLabelText('compact')).toBeInTheDocument()
    expect(screen.getByLabelText('cozy')).toBeInTheDocument()
    expect(screen.getByLabelText('roomy')).toBeInTheDocument()

    // Click Next to go to Step 3
    const nextButton2 = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton2)

    // Step 3: Documents
    await waitFor(() => {
      expect(screen.getByText('Which documents?')).toBeInTheDocument()
    })

    // Verify all surface toggles are shown and initially checked
    const proposalCheckbox = screen.getByLabelText('Proposals')
    const invoiceCheckbox = screen.getByLabelText('Invoices')
    const contractCheckbox = screen.getByLabelText('Contracts')
    const portalCheckbox = screen.getByLabelText('Client portal')
    const runSheetCheckbox = screen.getByLabelText('Run sheet')
    const questionnaireCheckbox = screen.getByLabelText('Questionnaires')

    expect(proposalCheckbox).toBeChecked()
    expect(invoiceCheckbox).toBeChecked()
    expect(contractCheckbox).toBeChecked()
    expect(portalCheckbox).toBeChecked()
    expect(runSheetCheckbox).toBeChecked()
    expect(questionnaireCheckbox).toBeChecked()

    // Toggle Invoice off
    await user.click(invoiceCheckbox)
    expect(invoiceCheckbox).not.toBeChecked()

    // Verify other surfaces remain checked
    expect(proposalCheckbox).toBeChecked()
    expect(contractCheckbox).toBeChecked()

    // Click Finish button
    const finishButton = screen.getByRole('button', { name: /finish/i })
    await user.click(finishButton)

    // Verify onComplete was called with correct payload
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          businessName: 'My Wedding Band',
          tagline: 'Making your day unforgettable',
          enabledSurfaces: expect.not.arrayContaining(['invoice']),
        }),
      )
    })

    // Verify invoice is NOT in enabledSurfaces
    const call = onComplete.mock.calls[0][0]
    expect(call.enabledSurfaces).toEqual(
      expect.arrayContaining(['proposal', 'contract', 'portal', 'vendorTimeline', 'questionnaire']),
    )
    expect(call.enabledSurfaces).not.toContain('invoice')
  })

  it('enforces at least one surface is enabled', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)

    render(
      <OnboardingWizard
        initial={{}}
        onComplete={onComplete}
      />,
    )

    // Navigate to step 3 (Documents)
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    await user.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText('Which documents?')).toBeInTheDocument()
    })

    // Get all checkboxes
    const checkboxes = screen.getAllByRole('checkbox')

    // Uncheck 5 of the 6 surfaces
    for (let i = 0; i < 5; i++) {
      if (checkboxes[i].getAttribute('checked') !== null) {
        await user.click(checkboxes[i])
      }
    }

    // Verify the last remaining checkbox cannot be unchecked (disabled)
    const lastCheckbox = checkboxes[checkboxes.length - 1]
    expect(lastCheckbox).toBeDisabled()
  })

  it('supports skip button to complete with defaults', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)

    render(
      <OnboardingWizard
        initial={{}}
        onComplete={onComplete}
      />,
    )

    // Click Skip button
    const skipButton = screen.getByRole('button', { name: /skip, use defaults/i })
    await user.click(skipButton)

    // Verify onComplete was called with all surfaces enabled
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })

    const call = onComplete.mock.calls[0][0]
    expect(call.enabledSurfaces).toEqual([
      'proposal',
      'invoice',
      'contract',
      'portal',
      'vendorTimeline',
      'questionnaire',
    ])
  })
})
