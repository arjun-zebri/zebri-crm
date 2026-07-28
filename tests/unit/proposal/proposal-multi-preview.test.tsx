import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { ProposalMultiPreview } from '@/components/proposal/proposal-multi-preview'
import type { BrandPreviewState } from '@/types/branding-preview'

/** Minimal editor branding state for rendering the preview. */
const state: BrandPreviewState = {
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

const blocks: Block[] = [{ id: 'ph', type: 'packageHeader' } as Block]

describe('ProposalMultiPreview', () => {
  it('previews the compare-and-pick view with the three sample packages', () => {
    render(<ProposalMultiPreview blocks={blocks} state={state} />)

    // The chooser renders every sample package as a radio card.
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /the essentials/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /the full day/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /the legacy/i })).toBeInTheDocument()
  })

  it('opens on the popular package and lets the previewer switch', async () => {
    const user = userEvent.setup()
    render(<ProposalMultiPreview blocks={blocks} state={state} />)

    // Defaults to the popular "Full Day" so add-ons are visible.
    expect(screen.getByRole('radio', { name: /the full day/i })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // Switching packages updates the selection locally.
    const essentials = screen.getByRole('radio', { name: /the essentials/i })
    await user.click(essentials)
    expect(essentials).toHaveAttribute('aria-checked', 'true')
  })
})
