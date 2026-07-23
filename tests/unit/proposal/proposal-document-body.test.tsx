/**
 * Unit tests for ProposalDocumentBody — verifies routing through
 * ProposalBlocksRenderer when package blocks exist, and fallback to
 * standalone ProposalPageView when blocks are empty/undefined.
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { ProposalDocumentBody } from '@/components/proposal/proposal-document-body'
import { PROPOSAL_LABEL_DEFAULTS } from '@/lib/branding/proposal-labels'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { PublicProposalOption } from '@/lib/payments/proposal-view'

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
  business_name: 'Test Business',
  tagline: 'Test tagline',
  abn: '12345678901',
  phone: '0412345678',
  website: 'test.com',
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

const optionFixture = (): PublicProposalOption => ({
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
  ],
})

describe('ProposalDocumentBody', () => {
  describe('with package blocks', () => {
    it('renders package content via ProposalBlocksRenderer when blocks contain packageHeader', () => {
      const blocks: Block[] = [
        {
          id: 'header-block',
          type: 'packageHeader',
        } as any,
      ]

      render(
        <ProposalDocumentBody
          blocks={blocks}
          branding={brandingFixture()}
          title="Test Proposal"
          coupleName="Test Couple"
          proposalNumber="P-001"
          notes={null}
          expiresAt={null}
          options={[optionFixture()]}
          state="active"
          chosenId="opt-1"
          selection={{}}
        />
      )

      // Should render the package title (from ProposalBlocksRenderer path)
      expect(screen.getByText('Gold Package')).toBeInTheDocument()
    })

    it('renders full package content with header, details, inclusions, and totals', () => {
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
        <ProposalDocumentBody
          blocks={blocks}
          branding={brandingFixture()}
          title="Test Proposal"
          coupleName="Test Couple"
          proposalNumber="P-001"
          notes={null}
          expiresAt={null}
          options={[optionFixture()]}
          state="active"
          chosenId="opt-1"
          selection={{}}
        />
      )

      // Should render all package blocks content
      expect(screen.getByText('Gold Package')).toBeInTheDocument()
      expect(screen.getByText('Premium service package')).toBeInTheDocument()
      expect(screen.getByText('Drone shots')).toBeInTheDocument()
      // Total should show the price
      const totalElements = screen.getAllByText(/5,000/)
      expect(totalElements.length).toBeGreaterThan(0)
    })
  })

  describe('without blocks (fallback)', () => {
    it('renders standalone ProposalPageView when blocks are empty', () => {
      render(
        <ProposalDocumentBody
          blocks={[]}
          branding={brandingFixture()}
          title="Test Proposal"
          coupleName="Test Couple"
          proposalNumber="P-001"
          notes={null}
          expiresAt={null}
          options={[optionFixture()]}
          state="active"
          chosenId="opt-1"
          selection={{}}
        />
      )

      // Should render the couple name (part of standalone ProposalPageView)
      expect(screen.getByText('Test Couple')).toBeInTheDocument()
      // Should render the proposal number
      expect(screen.getByText(/P-001/)).toBeInTheDocument()
    })

    it('renders standalone ProposalPageView when blocks are null', () => {
      render(
        <ProposalDocumentBody
          blocks={null}
          branding={brandingFixture()}
          title="Test Proposal"
          coupleName="Test Couple"
          proposalNumber="P-001"
          notes={null}
          expiresAt={null}
          options={[optionFixture()]}
          state="active"
          chosenId="opt-1"
          selection={{}}
        />
      )

      // Should render the couple name (part of standalone ProposalPageView)
      expect(screen.getByText('Test Couple')).toBeInTheDocument()
      // Should render the proposal number
      expect(screen.getByText(/P-001/)).toBeInTheDocument()
    })

    it('renders standalone ProposalPageView when blocks are undefined', () => {
      render(
        <ProposalDocumentBody
          blocks={undefined}
          branding={brandingFixture()}
          title="Test Proposal"
          coupleName="Test Couple"
          proposalNumber="P-001"
          notes={null}
          expiresAt={null}
          options={[optionFixture()]}
          state="active"
          chosenId="opt-1"
          selection={{}}
        />
      )

      // Should render the couple name (part of standalone ProposalPageView)
      expect(screen.getByText('Test Couple')).toBeInTheDocument()
      // Should render the proposal number
      expect(screen.getByText(/P-001/)).toBeInTheDocument()
    })
  })

  describe('state handling', () => {
    it('renders accepted state in standalone view without accept actions', () => {
      render(
        <ProposalDocumentBody
          blocks={null}
          branding={brandingFixture()}
          title="Test Proposal"
          coupleName="Test Couple"
          proposalNumber="P-001"
          notes={null}
          expiresAt={null}
          options={[optionFixture()]}
          state="accepted"
          chosenId="opt-1"
          selection={{}}
        />
      )

      // Should render couple name (part of standalone view)
      expect(screen.getByText('Test Couple')).toBeInTheDocument()
      // Should NOT render renderAccept callback for non-active state
      // (testing that accept is null when state !== 'active')
      expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
    })
  })
})
