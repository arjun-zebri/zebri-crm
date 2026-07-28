import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { PROPOSAL_LABEL_DEFAULTS } from '@/lib/branding/proposal-labels'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-surface'

/**
 * The branding editor drives click-to-style by reading `data-subtarget`
 * attributes the public renderers emit. These tests lock that contract: each
 * styleable sub-element must carry the tag the toolbar's control expects. The
 * attributes are inert on the public surface but load-bearing for the editor.
 */
const branding = (overrides: Partial<PublicBranding> = {}): PublicBranding => ({
  logo_url: null, favicon_url: null, header_image_url: null,
  brand_color: '#000', heading_color: '#000', subheading_color: '#666', accent_color: '#000',
  surface_color: '#fff', text_color: '#333', muted_color: '#666',
  secondary_color: '#EEE', secondary_text_color: '#000',
  business_name: 'Acme Weddings', tagline: null, abn: '12 345 678 901',
  phone: '0400000000', website: 'acme.example',
  instagram_url: null, facebook_url: null, twitter_url: null, pinterest_url: null, website_url: null,
  show_contact_on_documents: true,
  font_heading: 'inter' as never, font_body: 'inter' as never,
  font_weight: 600 as never, font_body_weight: 400 as never, font_scale: 1,
  density: 'cozy' as never, corner_radius: 8, doc_padding: 0,
  proposal_labels: PROPOSAL_LABEL_DEFAULTS, theme_preset: 'minimal',
  email_show_logo: true, email_logo_align: 'left', email_show_accent: true,
  heading_size: 32, body_size: 15, heading_case: 'none', body_case: 'none',
  subheading_size: 11, subheading_weight: 400, subheading_case: 'none',
  heading_letter_spacing: 0, body_line_height: 1.5,
  link_color: '#06C', border_color: '#E5E7EB',
  button_variant: 'fill', button_size: 'md', button_radius: 8,
  section_spacing: 32, page_background: '#fff',
  bank_account_name: 'Acme Pty Ltd', bank_bsb: '123-456', bank_account_number: '12345678',
  ...overrides,
} as PublicBranding)

const doc: PublicDocData = {
  title: 'Invoice', refNumber: 'INV-001', coupleName: 'Sarah & James', expiresAt: '2026-12-31',
  items: [{ id: 'i1', description: 'MC services', quantity: 2, unit_price: 100, amount: 200 }],
  subtotal: 200, taxRate: 10,
}

const renderBlock = (block: Block, docOverride?: Partial<PublicDocData>) =>
  render(<PublicBlockRenderer blocks={[block]} branding={branding()} doc={{ ...doc, ...docOverride }} />)

const has = (c: HTMLElement, t: string) => c.querySelectorAll(`[data-subtarget="${t}"]`).length

describe('public renderers emit data-subtarget tags for click-to-style', () => {
  // Title text stays editable (no tag, styled as the default target), but the
  // couple-name line and the meta row (ref/date/ABN) are click-to-style targets,
  // so each carries its data-subtarget tag.
  it('title: tags the couple-name line and meta row (title stays editable)', () => {
    const { container } = renderBlock({ id: '1', type: 'title', title: 'Invoice', showCoupleName: true, showRef: true, showExpires: false, showAbn: false } as never)
    expect(has(container, 'title')).toBe(0)
    expect(has(container, 'subtitle')).toBe(1)
    expect(has(container, 'meta')).toBe(1)
  })

  it('footer: tags the contact line (the note is now a rich-text field)', () => {
    const { container } = renderBlock({ id: '1', type: 'footer', closingNote: 'Thank you' } as never)
    expect(has(container, 'contact')).toBe(1)
  })

  it('action: tags primary + secondary buttons', () => {
    const { container } = renderBlock({ id: '1', type: 'action', primary: 'Pay now', secondary: 'Later' } as never)
    expect(has(container, 'primary')).toBe(1)
    expect(has(container, 'secondary')).toBe(1)
  })

  it('totals: tags subtotal, tax, and total rows', () => {
    const { container } = renderBlock({ id: '1', type: 'totals', showSubtotal: true, showTax: true, taxRate: 10 } as never)
    expect(has(container, 'subtotal')).toBe(1)
    expect(has(container, 'tax')).toBe(1)
    expect(has(container, 'total')).toBe(1)
  })

  it('lineItems: tags the header row and one tag per item row', () => {
    const { container } = renderBlock({ id: '1', type: 'lineItems', showHeader: true } as never)
    expect(has(container, 'header')).toBe(1)
    expect(has(container, 'item')).toBe(1) // one item in the sample doc
  })

  it('paymentDetails: tags each label/value cell (the heading is now a rich-text field)', () => {
    const { container } = renderBlock({ id: '1', type: 'paymentDetails', heading: 'Bank transfer' } as never)
    expect(has(container, 'label')).toBe(3)
    expect(has(container, 'value')).toBe(3)
  })
})
