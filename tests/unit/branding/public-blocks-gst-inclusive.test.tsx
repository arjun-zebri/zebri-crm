/**
 * The totals block renders a "Prices include GST" disclosure when the
 * document carries `gstInclusive`. It is display-only: these tests lock
 * that the amounts above it are byte-identical with the flag on and off,
 * so a couple never sees the total move because of a note.
 */
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-surface'

const branding: PublicBranding = {
  logo_url: null, favicon_url: null, header_image_url: null,
  brand_color: '#000', heading_color: '#000', subheading_color: '#666', accent_color: '#000',
  surface_color: '#fff', text_color: '#333', muted_color: '#666',
  secondary_color: '#EEE', secondary_text_color: '#000',
  business_name: 'Acme Weddings', vendor_role: 'MC', tagline: null, abn: '12 345 678 901',
  phone: '0400000000', website: 'acme.example',
  instagram_url: null, facebook_url: null, twitter_url: null, pinterest_url: null, website_url: null,
  show_contact_on_documents: true,
  font_heading: 'inter' as never, font_body: 'inter' as never,
  font_weight: 600 as never, font_body_weight: 400 as never, font_scale: 1,
  density: 'cozy' as never, corner_radius: 8, doc_padding: 0,
  theme_preset: 'minimal',
  email_show_logo: true, email_logo_align: 'left', email_show_accent: true,
  heading_size: 32, body_size: 15, heading_case: 'none', body_case: 'none',
  subheading_size: 11, subheading_weight: 400, subheading_case: 'none',
  heading_letter_spacing: 0, body_line_height: 1.5,
  link_color: '#06C', border_color: '#E5E7EB',
  button_variant: 'fill', button_size: 'md', button_radius: 8,
  section_spacing: 32, page_background: '#fff',
  bank_account_name: 'Acme Pty Ltd', bank_bsb: '123-456', bank_account_number: '12345678',
} as PublicBranding

const totalsBlock = { id: 't1', type: 'totals', showSubtotal: true, showTax: true } as never as Block

const doc: PublicDocData = {
  title: 'Invoice',
  refNumber: 'INV-001',
  coupleName: 'Sarah & James',
  expiresAt: null,
  items: [{ id: 'i1', description: 'MC services', amount: 3000 }],
  subtotal: 3000,
  taxRate: 0,
}

const renderTotals = (docOverride: Partial<PublicDocData> = {}) =>
  render(
    <PublicBlockRenderer
      blocks={[totalsBlock]}
      branding={branding}
      doc={{ ...doc, ...docOverride }}
    />,
  )

describe('totals block: prices include GST', () => {
  it('omits the note when the flag is absent', () => {
    const { queryByText } = renderTotals()
    expect(queryByText('Prices include GST')).not.toBeInTheDocument()
  })

  it('omits the note when the flag is explicitly false', () => {
    const { queryByText } = renderTotals({ gstInclusive: false })
    expect(queryByText('Prices include GST')).not.toBeInTheDocument()
  })

  it('renders the note when the flag is on', () => {
    const { getByText } = renderTotals({ gstInclusive: true })
    expect(getByText('Prices include GST')).toBeInTheDocument()
  })

  it('leaves the total untouched when the flag is on', () => {
    // Read the total row by its subtarget tag: with a zero tax rate the
    // subtotal and total print the same figure, so a text query is ambiguous.
    const totalRow = (override: Partial<PublicDocData> = {}) =>
      renderTotals(override).container.querySelector('[data-subtarget="total"]')?.textContent
    expect(totalRow({ gstInclusive: true })).toBe(totalRow())
    expect(totalRow({ gstInclusive: true })).toContain('$3,000.00')
  })

  it('renders the note alongside a GST line without altering it', () => {
    // The flag and a live tax rate are independent: an MC can set both,
    // and the GST line still computes and displays as it always has.
    const { getByText } = renderTotals({ taxRate: 10, gstInclusive: true })
    expect(getByText('GST (10%)')).toBeInTheDocument()
    expect(getByText('$300.00')).toBeInTheDocument()
    expect(getByText('$3,300.00')).toBeInTheDocument()
    expect(getByText('Prices include GST')).toBeInTheDocument()
  })
})
