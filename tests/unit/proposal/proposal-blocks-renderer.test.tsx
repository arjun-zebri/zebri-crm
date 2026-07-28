import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { ProposalBlocksRenderer } from '@/components/proposal/proposal-blocks-renderer'
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

describe('ProposalBlocksRenderer', () => {
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
      {
        id: 'base-1',
        description: 'Photography',
        amount: 3000,
        is_addon: false,
        default_included: true,
        position: 0,
      },
      {
        id: 'base-2',
        description: 'Videography',
        amount: 2000,
        is_addon: false,
        default_included: true,
        position: 1,
      },
      {
        id: 'addon-1',
        description: 'Drone shots',
        amount: 500,
        is_addon: true,
        default_included: false,
        position: 2,
      },
      {
        id: 'addon-2',
        description: 'Highlight reel',
        amount: 300,
        is_addon: true,
        default_included: false,
        position: 3,
      },
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
      {
        id: 'base-3',
        description: 'Photography',
        amount: 2000,
        is_addon: false,
        default_included: true,
        position: 0,
      },
      {
        id: 'base-4',
        description: 'Album',
        amount: 1000,
        is_addon: false,
        default_included: true,
        position: 1,
      },
      {
        id: 'addon-3',
        description: 'Extra prints',
        amount: 200,
        is_addon: true,
        default_included: false,
        position: 2,
      },
    ],
  }

  it('renders packageHeader with package title', () => {
    const blocks: Block[] = [
      {
        id: 'header-block',
        type: 'packageHeader',
      } as any,
    ]

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    expect(screen.getByText('Gold Package')).toBeInTheDocument()
  })

  it('renders the compare-and-pick chooser when multiple options exist', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    const blocks: Block[] = [
      {
        id: 'header-block',
        type: 'packageHeader',
      } as any,
    ]

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1, option2]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
        onChoose={onChoose}
      />
    )

    // Multi-option proposals show a comparison chooser (radio cards for every
    // package), not a single package title with a dropdown.
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /gold package/i })).toBeInTheDocument()
    const silver = screen.getByRole('radio', { name: /silver package/i })
    expect(silver).toBeInTheDocument()

    // Picking a different package calls onChoose.
    await user.click(silver)

    expect(onChoose).toHaveBeenCalledWith('opt-2')
  })

  it('renders packageInclusions with add-on checkboxes and toggles them', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const blocks: Block[] = [
      {
        id: 'inclusions-block',
        type: 'packageInclusions',
      } as any,
    ]

    const selection = {
      'addon-1': false,
      'addon-2': false,
    }

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={selection}
        state="active"
        expiresAt={null}
        onToggle={onToggle}
      />
    )

    // Should show add-on items
    expect(screen.getByText('Drone shots')).toBeInTheDocument()
    expect(screen.getByText('Highlight reel')).toBeInTheDocument()

    // Should not show base items
    expect(screen.queryByText('Photography')).not.toBeInTheDocument()
    expect(screen.queryByText('Videography')).not.toBeInTheDocument()

    // Toggle first add-on via checkbox
    const checkbox1 = screen.getByRole('checkbox', { name: /drone shots/i })
    await user.click(checkbox1)

    expect(onToggle).toHaveBeenCalledWith('addon-1', true)
  })

  it('renders packageInclusions with correct checked state', () => {
    const blocks: Block[] = [
      {
        id: 'inclusions-block',
        type: 'packageInclusions',
      } as any,
    ]

    const selection = {
      'addon-1': true,
      'addon-2': false,
    }

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={selection}
        state="active"
        expiresAt={null}
      />
    )

    const checkbox1 = screen.getByRole('checkbox', { name: /drone shots/i })
    const checkbox2 = screen.getByRole('checkbox', { name: /highlight reel/i })

    expect(checkbox1).toBeChecked()
    expect(checkbox2).not.toBeChecked()
  })

  it('renders packageTotals with computed price summary', () => {
    const blocks: Block[] = [
      {
        id: 'totals-block',
        type: 'packageTotals',
      } as any,
    ]

    const selection = {
      'addon-1': true, // +500
      'addon-2': false,
    }

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={selection}
        state="active"
        expiresAt={null}
      />
    )

    // Should show subtotal (5000 + 500 = 5500) with "Total" label
    const totalElements = screen.getAllByText(/5,500/)
    expect(totalElements.length).toBeGreaterThan(0)
  })

  it('renders packageDetails with description', () => {
    const blocks: Block[] = [
      {
        id: 'details-block',
        type: 'packageDetails',
      } as any,
    ]

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    expect(screen.getByText('Premium service package')).toBeInTheDocument()
  })

  it('renders packageDetails empty when description is null', () => {
    const optionNoDesc = { ...option1, description: null }
    const blocks: Block[] = [
      {
        id: 'details-block',
        type: 'packageDetails',
      } as any,
    ]

    const { container } = render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[optionNoDesc]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    const detailsBlock = container.querySelector('[data-testid="package-details"]')
    if (detailsBlock) {
      expect(detailsBlock).toBeEmptyDOMElement()
    }
  })

  it('renders action block via renderAccept callback', () => {
    const blocks: Block[] = [
      {
        id: 'action-block',
        type: 'action',
      } as any,
    ]

    const renderAccept = vi.fn(() => <div>Accept CTA</div>)

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
        renderAccept={renderAccept}
      />
    )

    expect(screen.getByText('Accept CTA')).toBeInTheDocument()
    expect(renderAccept).toHaveBeenCalled()
  })

  it('renders action block as static preview when renderAccept is not provided', () => {
    const blocks: Block[] = [
      {
        id: 'action-block',
        type: 'action',
      } as any,
    ]

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    // Should render something, but not call the callback
    expect(screen.queryByText('Accept CTA')).not.toBeInTheDocument()
  })

  it('delegates non-package blocks to PublicBlockRenderer', () => {
    const blocks: Block[] = [
      {
        id: 'text-block',
        type: 'text',
        text: 'Some promotional text',
      } as any,
    ]

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    expect(screen.getByText('Some promotional text')).toBeInTheDocument()
  })

  it('renders multiple blocks in sequence', () => {
    const blocks: Block[] = [
      {
        id: 'header-block',
        type: 'packageHeader',
      } as any,
      {
        id: 'details-block',
        type: 'packageDetails',
      } as any,
      {
        id: 'inclusions-block',
        type: 'packageInclusions',
      } as any,
      {
        id: 'totals-block',
        type: 'packageTotals',
      } as any,
    ]

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    expect(screen.getByText('Gold Package')).toBeInTheDocument()
    expect(screen.getByText('Premium service package')).toBeInTheDocument()
    expect(screen.getByText('Drone shots')).toBeInTheDocument()
    const totalElements = screen.getAllByText(/5,000/)
    expect(totalElements.length).toBeGreaterThan(0)
  })

  it('falls back to the first option when chosenId does not match any option', () => {
    const blocks: Block[] = [
      {
        id: 'header-block',
        type: 'packageHeader',
      } as any,
    ]

    render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[option1, option2]}
        chosenId="non-existent-id"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    // With an unmatched chosenId the region falls back to the first option, so
    // the first package's card is the selected (checked) one in the chooser.
    const goldRadio = screen.getByRole('radio', { name: /gold package/i })
    expect(goldRadio).toHaveAttribute('aria-checked', 'true')
  })

  it('renders nothing for packageInclusions when there are no add-ons', () => {
    const optionNoAddons = {
      ...option1,
      items: option1.items.filter((i) => !i.is_addon),
    }

    const blocks: Block[] = [
      {
        id: 'inclusions-block',
        type: 'packageInclusions',
      } as any,
    ]

    const { container } = render(
      <ProposalBlocksRenderer
        blocks={blocks}
        branding={brandingFixture()}
        view={viewBrandingFixture()}
        options={[optionNoAddons]}
        chosenId="opt-1"
        selection={{}}
        state="active"
        expiresAt={null}
      />
    )

    const inclusionsBlock = container.querySelector('[data-testid="package-inclusions"]')
    expect(inclusionsBlock).toBeEmptyDOMElement()
  })
})
