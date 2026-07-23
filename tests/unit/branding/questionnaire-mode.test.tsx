import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { RenderQuestionnaireBody } from '@/app/(dashboard)/branding/blocks/render'
import type { QuestionnaireBodyBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { BrandPreviewState } from '@/types/branding-preview'

/**
 * Test the questionnaire mode toggle persisting to the block.
 * When clicking "One at a time" or "Form", the toggle should call
 * updateBlock with the new mode value (persisted on the block, not preview state).
 */
describe('RenderQuestionnaireBody', () => {
  const mockUpdateBlock = vi.fn()

  const defaultBlock: QuestionnaireBodyBlock = {
    id: 'test-block-id',
    type: 'questionnaireBody',
    mode: 'form',
  }

  const defaultState: BrandPreviewState = {
    logoUrl: '',
    faviconUrl: '',
    headerImageUrl: '',
    brandColor: '#111827',
    headingColor: '#111827',
    subheadingColor: '#6B7280',
    surfaceColor: '#FFFFFF',
    textColor: '#111827',
    secondaryColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    tagline: '',
    footerText: '',
    abn: '',
    showContactOnDocuments: false,
    fontHeading: 'poppins',
    fontBody: 'inter',
    fontWeight: 600,
    fontBodyWeight: 400,
    density: 'cozy',
    cornerRadius: 16,
    docPadding: 32,
    headingSize: 32,
    bodySize: 14,
    headingCase: 'none',
    bodyCase: 'none',
    subheadingSize: 14,
    subheadingWeight: 600,
    subheadingCase: 'uppercase',
    headingLetterSpacing: 0,
    bodyLineHeight: 1.5,
    linkColor: '#111827',
    buttonVariant: 'fill',
    buttonSize: 'md',
    buttonRadius: 8,
    sectionSpacing: 24,
    businessName: 'Test Business',
    phone: '',
    website: '',
    instagramUrl: '',
    facebookUrl: '',
  }

  it('should call updateBlock with mode: "oneAtATime" when clicking "One at a time"', async () => {
    const user = userEvent.setup()
    mockUpdateBlock.mockClear()

    render(
      <RenderQuestionnaireBody
        block={defaultBlock}
        state={defaultState}
        updateBlock={mockUpdateBlock}
      />,
    )

    // Find and click the "One at a time" button
    const oneAtATimeButton = screen.getByRole('button', { name: /one at a time/i })
    await user.click(oneAtATimeButton)

    expect(mockUpdateBlock).toHaveBeenCalledWith('test-block-id', { mode: 'oneAtATime' })
  })

  it('should call updateBlock with mode: "form" when clicking "Form"', async () => {
    const user = userEvent.setup()
    mockUpdateBlock.mockClear()

    const blockWithOneAtATime: QuestionnaireBodyBlock = {
      ...defaultBlock,
      mode: 'oneAtATime',
    }

    render(
      <RenderQuestionnaireBody
        block={blockWithOneAtATime}
        state={defaultState}
        updateBlock={mockUpdateBlock}
      />,
    )

    // Find and click the "Form" button
    const formButton = screen.getByRole('button', { name: /form/i })
    await user.click(formButton)

    expect(mockUpdateBlock).toHaveBeenCalledWith('test-block-id', { mode: 'form' })
  })

  it('should render the "Form" layout when mode is "form"', () => {
    mockUpdateBlock.mockClear()

    render(
      <RenderQuestionnaireBody
        block={defaultBlock}
        state={defaultState}
        updateBlock={mockUpdateBlock}
      />,
    )

    // Check that form mode inputs are present
    const formInputs = screen.getAllByPlaceholderText(/DD\/MM\/YYYY|Type your answer/)
    expect(formInputs.length).toBeGreaterThan(0)
  })

  it('should render the typeform layout when mode is "oneAtATime"', () => {
    mockUpdateBlock.mockClear()

    const blockWithOneAtATime: QuestionnaireBodyBlock = {
      ...defaultBlock,
      mode: 'oneAtATime',
    }

    render(
      <RenderQuestionnaireBody
        block={blockWithOneAtATime}
        state={defaultState}
        updateBlock={mockUpdateBlock}
      />,
    )

    // Check for typeform-specific elements like progress bar
    const progressText = screen.getByText(/Question 1 of 3/)
    expect(progressText).toBeInTheDocument()
  })

  it('should default to form mode when mode is undefined', () => {
    mockUpdateBlock.mockClear()

    const blockWithoutMode: QuestionnaireBodyBlock = {
      id: 'test-block-id',
      type: 'questionnaireBody',
    }

    render(
      <RenderQuestionnaireBody
        block={blockWithoutMode}
        state={defaultState}
        updateBlock={mockUpdateBlock}
      />,
    )

    // Check that form mode is rendered by default
    const formInputs = screen.getAllByPlaceholderText(/DD\/MM\/YYYY|Type your answer/)
    expect(formInputs.length).toBeGreaterThan(0)
  })
})
