import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

import { FormSubmitControls } from '@/app/(dashboard)/branding/blocks/form-field-controls'
import { RenderFormSubmit } from '@/app/(dashboard)/branding/blocks/render'
import type { FormSubmitBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { BrandPreviewState } from '@/types/branding-preview'

/**
 * The submit block's canvas preview mirrors the public page (just the button,
 * nothing under it); the after-submit behaviour is configured in the labelled
 * toolbar controls, which these tests also cover.
 */
const block: FormSubmitBlock = {
  id: 'fs-test',
  type: 'formSubmit',
  locked: true,
  label: 'Send enquiry',
  successMessage: 'Thanks! We will be in touch soon.',
}

const updateBlock = () => {}

describe('RenderFormSubmit', () => {
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
    twitterUrl: '',
    pinterestUrl: '',
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
  }

  it('shows only the button, with no caption under it (the after-submit config lives in the toolbar)', () => {
    render(<RenderFormSubmit block={block} state={defaultState} updateBlock={updateBlock} />)

    expect(screen.getByText('Send enquiry')).toBeInTheDocument()
    expect(screen.queryByText(/After sending/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Thanks! We will be in touch soon\./)).not.toBeInTheDocument()
  })

  it('renders a branded button: brand colour + corner radius by default', () => {
    render(<RenderFormSubmit block={block} state={defaultState} updateBlock={updateBlock} />)

    const btn = screen.getByText('Send enquiry').closest('button')!
    // state.brandColor #111827, state.buttonRadius 8 (the brand button radius,
    // not the block cornerRadius)
    expect(btn.style.background).toBe('rgb(17, 24, 39)')
    expect(btn.style.borderRadius).toBe('8px')
  })

  it('honours block style overrides: colour, radius, and outline variant', () => {
    render(
      <RenderFormSubmit
        block={{
          ...block,
          buttonColor: '#FF0000',
          buttonRadius: 4,
          variant: 'outline',
        }}
        state={defaultState}
        updateBlock={updateBlock}
      />,
    )

    const btn = screen.getByText('Send enquiry').closest('button')!
    expect(btn.style.background).toBe('transparent')
    expect(btn.style.borderRadius).toBe('4px')
    // Outline paints the label in the button colour.
    expect(btn.style.color).toBe('rgb(255, 0, 0)')
  })

  it('renders no caption in redirect mode either', () => {
    render(
      <RenderFormSubmit
        block={{ ...block, successMode: 'redirect', redirectUrl: 'https://example.com/thanks' }}
        state={defaultState}
        updateBlock={updateBlock}
      />,
    )

    expect(screen.getByText('Send enquiry')).toBeInTheDocument()
    expect(screen.queryByText(/example\.com\/thanks/)).not.toBeInTheDocument()
  })
})

describe('FormSubmitControls', () => {
  it('labels every control, and swaps the third input with the mode', () => {
    const { rerender } = render(<FormSubmitControls block={block} updateBlock={updateBlock} />)

    expect(screen.getByText('Button label')).toBeInTheDocument()
    expect(screen.getByText('After sending')).toBeInTheDocument()
    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.queryByText('Redirect URL')).not.toBeInTheDocument()

    rerender(
      <FormSubmitControls block={{ ...block, successMode: 'redirect' }} updateBlock={updateBlock} />,
    )
    expect(screen.getByText('Redirect URL')).toBeInTheDocument()
    expect(screen.queryByText('Success message')).not.toBeInTheDocument()
  })
})
