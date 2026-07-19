import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { PROPOSAL_LABEL_DEFAULTS } from '@/lib/branding/proposal-labels'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-surface'

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
  link_color: '#0066CC',
  border_color: '#E5E7EB',
  button_variant: 'fill',
  button_size: 'md',
  button_radius: 8,
  section_spacing: 32,
  page_background: '#fff',
  ...overrides,
})

describe('PublicBlockRenderer inherits global type scale and border colour', () => {
  it('renders the document title at the global heading size', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      border_color: '#FF00FF',
    })
    const blocks: Block[] = [
      {
        id: '1',
        type: 'title',
        text: 'Test',
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const titleEl = screen.getByText('Test')
    expect(titleEl).toHaveStyle({ fontSize: '50px' })
  })

  it('renders body text at the global body size', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      border_color: '#FF00FF',
    })
    const blocks: Block[] = [
      {
        id: '1',
        type: 'text',
        text: 'body copy here',
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const bodyEl = screen.getByText(/body copy/i).parentElement
    expect(bodyEl).toHaveStyle({ fontSize: '22px' })
  })

  it('draws hairlines in the border colour', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      border_color: '#FF00FF',
    })
    const blocks: Block[] = [
      {
        id: 'totals-1',
        type: 'totals',
        showSubtotal: true,
        showTax: true,
        hidden: false,
      } as never,
    ]
    const doc = {
      title: 'Test',
      refNumber: 'TEST-001',
      expiresAt: '2026-12-31',
      items: [{ id: '1', description: 'Item 1', quantity: 1, unit_price: 100, displayPrice: '100.00', amount: 100 }],
      subtotal: 100,
      taxRate: 10,
    }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const ruleEl = document.querySelector('[data-testid="totals-rule"]')
    expect(ruleEl).toHaveStyle({ borderTopColor: '#FF00FF' })
  })
})
