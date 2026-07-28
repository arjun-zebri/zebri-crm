import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { OnboardingModalSkeleton } from '@/app/(dashboard)/branding/onboarding/onboarding-modal-skeleton'
import { OnboardingWizard } from '@/app/(dashboard)/branding/onboarding/onboarding-wizard'

describe('OnboardingWizard', () => {
  it('walks through all four steps and completes with correct payload', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)

    render(
      <div role="dialog">
        <OnboardingWizard
          initial={{
            businessName: '',
            tagline: '',
            logoUrl: '',
            headingColor: '#111827',
            subheadingColor: '#111827',
            bodyColor: '#6B7280',
            backgroundColor: '#FFFFFF',
            primaryButtonColor: '#111827',
            secondaryButtonColor: '#6B7280',
            fontHeading: 'playfair',
            fontBody: 'inter',
            density: 'cozy',
          }}
          onComplete={onComplete}
        />
      </div>,
    )

    const dialog = screen.getByRole('dialog')

    // Welcome screen precedes the steps; dismiss it.
    expect(within(dialog).getByText('Welcome to your branding')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /get started/i }))

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

    // Verify the look controls are shown: six colour fields and font selects.
    expect(within(dialog).getByLabelText('Heading hex')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Subheading hex')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Body text hex')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Background hex')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Primary button hex')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Secondary button hex')).toBeInTheDocument()
    expect(within(dialog).getByText('Heading font')).toBeInTheDocument()
    expect(within(dialog).getByText('Body font')).toBeInTheDocument()

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

    // Click Next to go to Step 4 (editor demo)
    await user.click(within(dialog).getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(within(dialog).getByText('See how the editor works')).toBeInTheDocument()
    })

    // Click Finish button
    const finishButton = within(dialog).getByRole('button', { name: /finish/i })
    await user.click(finishButton)

    // Verify onComplete was called with correct payload containing six colours
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          businessName: 'My Wedding Band',
          tagline: 'Making your day unforgettable',
          headingColor: expect.any(String),
          subheadingColor: expect.any(String),
          bodyColor: expect.any(String),
          backgroundColor: expect.any(String),
          primaryButtonColor: expect.any(String),
          secondaryButtonColor: expect.any(String),
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

    // Dismiss the welcome screen, then navigate to step 3 (Documents).
    await user.click(within(dialog).getByRole('button', { name: /get started/i }))
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

describe('OnboardingModalSkeleton', () => {
  it('renders with flex column layout matching wizard structure', () => {
    const { container } = render(<OnboardingModalSkeleton />)

    // Verify skeleton renders a single root div with flex flex-col h-full
    const root = container.firstChild as HTMLDivElement
    expect(root).toBeInstanceOf(HTMLDivElement)
    expect(root.className).toContain('flex')
    expect(root.className).toContain('flex-col')
    expect(root.className).toContain('h-full')
  })

  it('renders two-pane layout inside flex container', () => {
    const { container } = render(<OnboardingModalSkeleton />)

    // Verify the middle section contains left and right panes
    const flexContainer = container.querySelector('.flex.flex-1.min-h-0')
    expect(flexContainer).toBeInTheDocument()

    // Verify left pane (flex-1 min-w-0) exists
    const leftPane = flexContainer?.querySelector('.flex-1.min-w-0')
    expect(leftPane).toBeInTheDocument()

    // Verify right pane (hidden sm:block w-[380px]) exists
    const rightPane = flexContainer?.querySelector('.w-\\[380px\\]')
    expect(rightPane).toBeInTheDocument()
  })

  it('renders skeleton footer at bottom with border-top', () => {
    const { container } = render(<OnboardingModalSkeleton />)

    // Verify footer structure with border-t
    const footer = container.querySelector('.border-t.border-border')
    expect(footer).toBeInTheDocument()
    expect(footer?.className).toContain('px-6')
    expect(footer?.className).toContain('py-4')
    expect(footer?.className).toContain('flex')
  })
})

describe('Onboarding modal frame continuity', () => {
  it('maintains same modal frame dimensions when content swaps from skeleton to wizard', async () => {
    /**
     * This test verifies the continuity property: when a modal card holds
     * the skeleton while loading=true, then swaps to the wizard when
     * loading=false, the frame dimensions stay constant (max-w-3xl h-[780px]).
     *
     * We simulate this by rendering the skeleton and wizard in the same
     * modal container and verifying both render within a flex column that
     * can accommodate the height.
     */
    const { rerender } = render(
      <div
        className="w-full max-w-3xl bg-surface rounded-xl shadow-lg outline-none h-[780px] max-h-[94vh] flex flex-col overflow-hidden"
        role="dialog"
      >
        <OnboardingModalSkeleton />
      </div>,
    )

    // Verify skeleton is in the DOM
    const container = screen.getByRole('dialog')
    expect(container.className).toContain('flex')
    expect(container.className).toContain('flex-col')
    expect(container.className).toContain('h-[780px]')

    // Verify skeleton structure has flex flex-col h-full root
    const skeletonRoot = container.querySelector(':scope > .flex.flex-col.h-full')
    expect(skeletonRoot).toBeInTheDocument()

    // Swap to wizard (same container dimensions)
    const onComplete = vi.fn().mockResolvedValue(undefined)
    rerender(
      <div
        className="w-full max-w-3xl bg-surface rounded-xl shadow-lg outline-none h-[780px] max-h-[94vh] flex flex-col overflow-hidden"
        role="dialog"
      >
        <OnboardingWizard
          initial={{
            businessName: '',
            tagline: '',
            logoUrl: '',
            headingColor: '#111827',
            subheadingColor: '#111827',
            bodyColor: '#6B7280',
            backgroundColor: '#FFFFFF',
            primaryButtonColor: '#111827',
            secondaryButtonColor: '#6B7280',
            fontHeading: 'playfair',
            fontBody: 'inter',
            density: 'cozy',
          }}
          onComplete={onComplete}
        />
      </div>,
    )

    // Verify wizard is now in the DOM with same flex flex-col h-full root
    const wizardRoot = container.querySelector(':scope > .flex.flex-col.h-full')
    expect(wizardRoot).toBeInTheDocument()

    // Verify the modal container still has the same dimensions
    expect(container.className).toContain('h-[780px]')

    // Verify both components render their middle flex section
    // (skeleton: flex flex-1 min-h-0 for panes; wizard: flex flex-1 min-h-0 for panes)
    const middleSection = container.querySelector(':scope > .flex.flex-col.h-full > .flex.flex-1.min-h-0')
    expect(middleSection).toBeInTheDocument()
  })
})
