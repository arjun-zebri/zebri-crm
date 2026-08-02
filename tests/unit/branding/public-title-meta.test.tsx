import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-surface'

/**
 * Minimal branding fixture covering the fields the title block's type-scale
 * resolution reads. Mirrors the shape used in public-blocks-inherit.test.tsx.
 */
const createMockBranding = (overrides: Partial<PublicBranding> = {}): PublicBranding => ({
  logo_url: null,
  favicon_url: null,
  header_image_url: null,
  brand_color: '#000',
  heading_color: '#000',
  subheading_color: '#666',
  accent_color: '#000',
  surface_color: '#fff',
  text_color: '#333',
  muted_color: '#666',
  secondary_color: '#EEE',
  secondary_text_color: '#000',
  business_name: null,
  tagline: null,
  abn: null,
  phone: null,
  website: null,
  instagram_url: null,
  facebook_url: null, twitter_url: null, pinterest_url: null, website_url: null,
  show_contact_on_documents: true,
  font_heading: 'inter' as never,
  font_body: 'inter' as never,
  font_weight: 600 as never,
  font_body_weight: 400 as never,
  font_scale: 1,
  density: 'cozy' as never,
  corner_radius: 8,
  doc_padding: 0,
  theme_preset: 'minimal',
  email_show_logo: true,
  email_logo_align: 'left',
  email_show_accent: true,
  heading_size: 32,
  body_size: 15,
  heading_case: 'none',
  body_case: 'none',
  subheading_size: 11,
  subheading_weight: 400,
  subheading_case: 'none',
  heading_letter_spacing: 0,
  body_line_height: 1.5,
  link_color: '#0066CC',
  border_color: '#E5E7EB',
  button_variant: 'fill',
  button_size: 'md',
  button_radius: 8,
  section_spacing: 32,
  page_background: '#fff',
  ...overrides,
})

const titleBlock = (overrides: Partial<Record<string, unknown>> = {}): Block =>
  ({
    id: '1',
    type: 'title',
    title: 'Invoice',
    showCoupleName: false,
    showRef: true,
    showExpires: true,
    showAbn: false,
    hidden: false,
    ...overrides,
  }) as never

const baseDoc: PublicDocData = {
  title: 'Invoice',
  refNumber: 'INV-2024-001',
  coupleName: 'Sarah & James',
  expiresAt: '2026-12-31',
  items: [],
  subtotal: 0,
  taxRate: 0,
}

describe('title block meta row', () => {
  it('labels the date row "Expires" by default when no expiresLabel is set', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock()]}
        branding={createMockBranding()}
        doc={baseDoc}
      />,
    )
    expect(screen.getByText('Expires')).toBeInTheDocument()
    expect(screen.queryByText('Due')).not.toBeInTheDocument()
  })

  it('labels the date row "Due" when the surface sets expiresLabel (invoice)', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock()]}
        branding={createMockBranding()}
        doc={{ ...baseDoc, expiresLabel: 'Due' }}
      />,
    )
    expect(screen.getByText('Due')).toBeInTheDocument()
    expect(screen.queryByText('Expires')).not.toBeInTheDocument()
  })

  it('hides the date row when showExpires is off', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock({ showExpires: false })]}
        branding={createMockBranding()}
        doc={{ ...baseDoc, expiresLabel: 'Due' }}
      />,
    )
    expect(screen.queryByText('Due')).not.toBeInTheDocument()
    expect(screen.queryByText('Expires')).not.toBeInTheDocument()
  })

  it('hides the date row when the surface supplies no date (e.g. scheduled invoice)', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock()]}
        branding={createMockBranding()}
        doc={{ ...baseDoc, expiresAt: null, expiresLabel: 'Due' }}
      />,
    )
    expect(screen.queryByText('Due')).not.toBeInTheDocument()
  })

  it('shows the reference row when showRef is on', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock()]}
        branding={createMockBranding()}
        doc={baseDoc}
      />,
    )
    expect(screen.getByText('Ref')).toBeInTheDocument()
    expect(screen.getByText('INV-2024-001')).toBeInTheDocument()
  })

  it('hides the reference row when showRef is off', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock({ showRef: false })]}
        branding={createMockBranding()}
        doc={baseDoc}
      />,
    )
    expect(screen.queryByText('Ref')).not.toBeInTheDocument()
  })
})

describe('title block couple-name subtitle line', () => {
  it('shows the couple name from doc data when showCoupleName is on', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock({ showCoupleName: true })]}
        branding={createMockBranding()}
        doc={baseDoc}
      />,
    )
    expect(screen.getByText('Sarah & James')).toBeInTheDocument()
  })

  it('hides the couple-name line when showCoupleName is off', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock({ showCoupleName: false })]}
        branding={createMockBranding()}
        doc={baseDoc}
      />,
    )
    expect(screen.queryByText('Sarah & James')).not.toBeInTheDocument()
  })

  it('renders nothing for the couple-name line when the doc has no couple name', () => {
    render(
      <PublicBlockRenderer
        blocks={[titleBlock({ showCoupleName: true })]}
        branding={createMockBranding()}
        doc={{ ...baseDoc, coupleName: undefined }}
      />,
    )
    // The couple name is the only place "Sarah & James" would appear; absent
    // data must never leave an empty subtitle line behind.
    expect(screen.queryByText('Sarah & James')).not.toBeInTheDocument()
  })
})
