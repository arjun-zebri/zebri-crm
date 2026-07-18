import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import { ProposalPageView, viewBranding } from '@/components/proposal/proposal-page-view'
import { PROPOSAL_LABEL_DEFAULTS } from '@/lib/branding/proposal-labels'
import type { PublicBranding } from '@/lib/branding/public-surface'

/**
 * Distinct sentinel colours so a label picking the wrong role is
 * unambiguous in the assertion rather than coincidentally equal.
 */
const HEADING = 'rgb(17, 24, 39)'
const SUBHEADING = 'rgb(120, 40, 200)'
const BRAND = 'rgb(0, 255, 82)'

const brandingFixture = (): PublicBranding => ({
  logo_url: null,
  favicon_url: null,
  header_image_url: null,
  brand_color: '#00FF52',
  heading_color: '#111827',
  subheading_color: '#7828C8',
  accent_color: '#00FF52',
  surface_color: '#fff',
  text_color: '#333333',
  muted_color: '#6B7280',
  secondary_color: '#EEEEEE',
  secondary_text_color: '#000000',
  business_name: null,
  tagline: null,
  abn: null,
  phone: null,
  website: null,
  instagram_url: null,
  facebook_url: null,
  show_contact_on_documents: true,
  font_heading: 'inter' as never,
  font_body: 'inter' as never,
  font_weight: 600 as never,
  font_body_weight: 400 as never,
  font_scale: 1,
  density: 'cozy' as never,
  corner_radius: 8,
  doc_padding: 0,
  proposal_labels: PROPOSAL_LABEL_DEFAULTS,
  theme_preset: 'minimal',
  email_show_logo: true,
  email_logo_align: 'left',
  email_show_accent: true,
  heading_size: 32,
  body_size: 15,
  heading_case: 'none',
  body_case: 'none',
  heading_letter_spacing: 0,
  body_line_height: 1.5,
  link_color: '#00FF52',
  border_color: '#E5E7EB',
  button_variant: 'fill',
  button_size: 'md',
  button_radius: 8,
  section_spacing: 32,
  page_background: '#fff',
})

const renderProposal = () =>
  render(
    <ProposalPageView
      coupleName="Alex & Jordan"
      proposalNumber="PROP-001"
      notes="We loved hearing about your day."
      expiresAt="2026-08-30"
      options={[
        {
          id: 'opt-1',
          name: 'The Essentials',
          description: 'A beautiful record of the day itself.',
          basePrice: 1100,
          items: [],
        } as never,
      ]}
      state="active"
      branding={viewBranding(brandingFixture())}
      chosenId="opt-1"
      selection={{}}
    />,
  )

describe('proposal section labels follow the subheading colour', () => {
  it('renders the couple name in the heading colour', () => {
    renderProposal()
    expect(screen.getByText('Alex & Jordan')).toHaveStyle({ color: HEADING })
  })

  // The section eyebrows are headings under the colour model's
  // classification rule, so they must track subheading_color rather than
  // the primary button colour. They read as brand-coloured accents only
  // because the default palette makes both black.
  it.each([
    ['eyebrow', PROPOSAL_LABEL_DEFAULTS.eyebrow.text],
    ['note heading', PROPOSAL_LABEL_DEFAULTS.note.text],
  ])('renders the %s in the subheading colour, not the brand colour', (_role, text) => {
    renderProposal()
    const label = screen.getByText(text)
    expect(label).toHaveStyle({ color: SUBHEADING })
    expect(label).not.toHaveStyle({ color: BRAND })
  })
})
