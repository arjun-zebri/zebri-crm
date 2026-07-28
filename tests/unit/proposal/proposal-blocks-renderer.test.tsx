import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import {
  ProposalBlocksRenderer,
  type AcceptStyle,
} from '@/components/proposal/proposal-blocks-renderer'
import { PROPOSAL_LABEL_DEFAULTS } from '@/lib/branding/proposal-labels'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'

const brandingFixture = (): PublicBranding => ({
  logo_url: null,
  favicon_url: null,
  header_image_url: null,
  brand_color: '#00FF52',
  heading_color: '#111827',
  subheading_color: '#7828C8',
  subheading_size: 14,
  subheading_weight: 600 as never,
  subheading_case: 'none',
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
  twitter_url: null,
  pinterest_url: null,
  website_url: null,
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

const viewBrandingFixture = (): ProposalViewBranding => ({
  pageBg: '#fafafa',
  textColor: '#111827',
  mutedColor: '#6B7280',
  brand: '#00FF52',
  accent: '#00FF52',
  secondaryColor: '#EEEEEE',
  secondaryTextColor: '#000000',
  headingColor: '#111827',
  subheadingColor: '#7828C8',
  radius: 16,
  borderColor: '#E5E7EB',
  cornerRadius: 8,
  headingFontFamily: undefined,
  bodyFontFamily: undefined,
  headingWeight: 600,
  docPadding: 0,
  logoUrl: null,
  headerImageUrl: null,
  businessName: null,
  tagline: null,
  abn: null,
  labels: PROPOSAL_LABEL_DEFAULTS,
})

const option1: PublicProposalOption = {
  id: 'opt-1',
  title: 'Gold Package',
  description: 'Premium service package',
  deposit_percent: 50,
  gst_inclusive: true,
  is_popular: true,
  subtotal: 5000,
  position: 0,
  items: [
    { id: 'base-1', description: 'Photography', amount: 3000, is_addon: false, default_included: true, position: 0 },
    { id: 'base-2', description: 'Videography', amount: 2000, is_addon: false, default_included: true, position: 1 },
    { id: 'addon-1', description: 'Drone shots', amount: 500, is_addon: true, default_included: false, position: 2 },
    { id: 'addon-2', description: 'Highlight reel', amount: 300, is_addon: true, default_included: false, position: 3 },
  ],
}

const option2: PublicProposalOption = {
  id: 'opt-2',
  title: 'Silver Package',
  description: 'Standard service package',
  deposit_percent: 30,
  gst_inclusive: true,
  is_popular: false,
  subtotal: 3000,
  position: 1,
  items: [
    { id: 'base-3', description: 'Photography', amount: 2000, is_addon: false, default_included: true, position: 0 },
    { id: 'base-4', description: 'Album', amount: 1000, is_addon: false, default_included: true, position: 1 },
    { id: 'addon-3', description: 'Extra prints', amount: 200, is_addon: true, default_included: false, position: 2 },
  ],
}

/** A standard proposal block tree: the package region + the action block. */
const packageBlocks: Block[] = [
  { id: 'ph', type: 'packageHeader' } as Block,
  { id: 'pd', type: 'packageDetails' } as Block,
  { id: 'pi', type: 'packageInclusions' } as Block,
  { id: 'pt', type: 'packageTotals' } as Block,
  { id: 'ac', type: 'action', primary: 'Accept', secondary: 'Decline' } as Block,
]

/** Marker Accept CTA per package, tagged with the option id. */
const renderPackageAccept = ({ option }: { option: PublicProposalOption; selection: Record<string, boolean>; style: AcceptStyle }) => (
  <div data-testid={`accept-${option.id}`}>Accept {option.title}</div>
)

/** Marker for the single bottom Decline. */
const renderDecline = () => <div data-testid="decline">Decline</div>

function renderTree(options: PublicProposalOption[], overrides: Partial<React.ComponentProps<typeof ProposalBlocksRenderer>> = {}) {
  return render(
    <ProposalBlocksRenderer
      blocks={packageBlocks}
      branding={brandingFixture()}
      view={viewBrandingFixture()}
      options={options}
      state="active"
      expiresAt={null}
      renderPackageAccept={renderPackageAccept}
      renderDecline={renderDecline}
      {...overrides}
    />,
  )
}

describe('ProposalBlocksRenderer — package stacking', () => {
  it('renders one package with its own Accept and a Decline for a single option', () => {
    renderTree([option1])

    expect(screen.getByText('Gold Package')).toBeInTheDocument()
    expect(screen.getByText('Optional add-ons')).toBeInTheDocument()
    expect(screen.getByTestId('accept-opt-1')).toBeInTheDocument()
    expect(screen.getByTestId('decline')).toBeInTheDocument()
  })

  it('stacks each package with its own Accept, and one shared Decline, for multiple options', () => {
    renderTree([option1, option2])

    // Both packages render in full (titles + their own Accept).
    expect(screen.getByText('Gold Package')).toBeInTheDocument()
    expect(screen.getByText('Silver Package')).toBeInTheDocument()
    expect(screen.getByTestId('accept-opt-1')).toBeInTheDocument()
    expect(screen.getByTestId('accept-opt-2')).toBeInTheDocument()

    // Decline is shown exactly once, at the bottom.
    expect(screen.getAllByTestId('decline')).toHaveLength(1)
  })

  it('renders each package add-ons and toggles them independently', async () => {
    const user = userEvent.setup()
    renderTree([option1])

    const drone = screen.getByRole('checkbox', { name: /drone shots/i })
    expect(drone).toHaveAttribute('aria-checked', 'false')

    await user.click(drone)
    expect(drone).toHaveAttribute('aria-checked', 'true')
  })

  it('renders only the accepted package, with no Accept or Decline, once accepted', () => {
    renderTree([option1, option2], {
      state: 'accepted',
      acceptedOptionId: 'opt-2',
      acceptedSelection: {},
    })

    expect(screen.getByText('Silver Package')).toBeInTheDocument()
    expect(screen.queryByText('Gold Package')).not.toBeInTheDocument()
    expect(screen.queryByTestId('accept-opt-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('decline')).not.toBeInTheDocument()
  })

  it('renders nothing when there are no options', () => {
    const { container } = renderTree([])
    expect(container).toBeEmptyDOMElement()
  })
})
