import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { OnboardingModal } from '@/app/(dashboard)/branding/onboarding/onboarding-modal'
import { OnboardingWizard } from '@/app/(dashboard)/branding/onboarding/onboarding-wizard'

describe('OnboardingWizard', () => {
  it('walks through all three steps and completes with correct payload', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)

    render(
      <div role="dialog">
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
        />
      </div>,
    )

    const dialog = screen.getByRole('dialog')

    // Step 1: Business
    expect(within(dialog).getByText("Let's start with your identity")).toBeInTheDocument()

    const businessInput = within(dialog).getByLabelText('Business name')
    await user.type(businessInput, 'My Wedding Band')

    const taglineInput = within(dialog).getByLabelText('Tagline')
    await user.type(taglineInput, 'Making your day unforgettable')

    // Click Next to go to Step 2
    const nextButton = within(dialog).getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Step 2: Look
    await waitFor(() => {
      expect(within(dialog).getByText('Choose your look')).toBeInTheDocument()
    })

    // Verify font pairings are shown
    expect(within(dialog).getByLabelText('Serif classic')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Modern')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Editorial')).toBeInTheDocument()

    // Verify density options are shown
    expect(within(dialog).getByLabelText('compact')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('cozy')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('roomy')).toBeInTheDocument()

    // Click Next to go to Step 3
    const nextButton2 = within(dialog).getByRole('button', { name: /next/i })
    await user.click(nextButton2)

    // Step 3: Documents
    await waitFor(() => {
      expect(within(dialog).getByText('Which documents?')).toBeInTheDocument()
    })

    // Verify all surface toggles are shown and initially checked
    const proposalCheckbox = within(dialog).getByLabelText('Proposals')
    const invoiceCheckbox = within(dialog).getByLabelText('Invoices')
    const contractCheckbox = within(dialog).getByLabelText('Contracts')
    const portalCheckbox = within(dialog).getByLabelText('Client portal')
    const runSheetCheckbox = within(dialog).getByLabelText('Run sheet')
    const questionnaireCheckbox = within(dialog).getByLabelText('Questionnaires')

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
    const finishButton = within(dialog).getByRole('button', { name: /finish/i })
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
      <div role="dialog">
        <OnboardingWizard
          initial={{}}
          onComplete={onComplete}
        />
      </div>,
    )

    const dialog = screen.getByRole('dialog')

    // Navigate to step 3 (Documents)
    const nextButton = within(dialog).getByRole('button', { name: /next/i })
    await user.click(nextButton)
    await user.click(nextButton)

    await waitFor(() => {
      expect(within(dialog).getByText('Which documents?')).toBeInTheDocument()
    })

    // Get all checkboxes
    const checkboxes = within(dialog).getAllByRole('checkbox')

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
      <div role="dialog">
        <OnboardingWizard
          initial={{}}
          onComplete={onComplete}
        />
      </div>,
    )

    const dialog = screen.getByRole('dialog')

    // Click Skip button
    const skipButton = within(dialog).getByRole('button', { name: /skip, use defaults/i })
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
