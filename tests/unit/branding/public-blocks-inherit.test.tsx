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
  proposal_labels: PROPOSAL_LABEL_DEFAULTS,
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

  it('renders the couple-name subtitle line at the global body size', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
    })
    const blocks: Block[] = [
      {
        id: '1',
        type: 'title',
        text: 'Test Title',
        showCoupleName: true,
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test Title', refNumber: 'TEST-001', coupleName: 'Test Couple', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const subtitleEl = screen.getByText('Test Couple').closest('p')
    expect(subtitleEl).toHaveStyle({ fontSize: '22px' })
  })

  it('renders section labels (meta labels in title block) at the subheading size', () => {
    // The sectionLabel role IS the subheading control: its size comes from
    // subheading_size, independent of body_size (13 here, not 22 x 0.73).
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      subheading_size: 13,
    })
    const blocks: Block[] = [
      {
        id: '1',
        type: 'title',
        text: 'Test',
        showRef: true,
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const labelEl = screen.getByText('Ref')
    expect(labelEl).toHaveStyle({ fontSize: '13px' })
  })

  it('renders section heading (businessName block) at heading size x 0.625', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      business_name: 'Test Business',
    })
    const blocks: Block[] = [
      {
        id: '1',
        type: 'businessName',
        layout: 'name',
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const headingEl = screen.getByText('Test Business').closest('p')
    expect(headingEl).toHaveStyle({ fontSize: '31px' })
  })

  it('renders total amount at heading size x 0.5625', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
    })
    const blocks: Block[] = [
      {
        id: 'totals-1',
        type: 'totals',
        showSubtotal: false,
        showTax: false,
        hidden: false,
      } as never,
    ]
    const doc = {
      title: 'Test',
      refNumber: 'TEST-001',
      expiresAt: '2026-12-31',
      items: [{ id: '1', description: 'Item 1', quantity: 1, unit_price: 100, displayPrice: '100.00', amount: 100 }],
      subtotal: 100,
      taxRate: 0,
    }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const totalEl = screen.getByText('Total').nextElementSibling
    expect(totalEl).toHaveStyle({ fontSize: '28px' })
  })

  it('renders fine print (footer contact line) at body size x 0.8', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      business_name: 'Test Business',
      phone: '0400000000',
      show_contact_on_documents: true,
    })
    const blocks: Block[] = [
      {
        id: '1',
        type: 'footer',
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const contactLineEl = screen.getByText(/0400000000/).closest('p')
    expect(contactLineEl).toHaveStyle({ fontSize: '18px' })
  })

  it('renders section labels (lineItems headers) at the subheading size', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      subheading_size: 13,
    })
    const blocks: Block[] = [
      {
        id: 'items-1',
        type: 'lineItems',
        showHeader: true,
        hidden: false,
      } as never,
    ]
    const doc = {
      title: 'Test',
      refNumber: 'TEST-001',
      expiresAt: '2026-12-31',
      items: [{ id: '1', description: 'Item 1', quantity: 1, unit_price: 100, displayPrice: '100.00', amount: 100 }],
      subtotal: 100,
      taxRate: 0,
    }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const descriptionHeaderEl = screen.getByText('Description')
    expect(descriptionHeaderEl).toHaveStyle({ fontSize: '13px' })
  })

  it('renders fine print (lineItems quantity sub-line) at body size x 0.8', () => {
    const branding = createMockBranding({
      heading_size: 50,
      body_size: 22,
    })
    const blocks: Block[] = [
      {
        id: 'items-1',
        type: 'lineItems',
        showHeader: false,
        hidden: false,
      } as never,
    ]
    const doc = {
      title: 'Test',
      refNumber: 'TEST-001',
      expiresAt: '2026-12-31',
      items: [{ id: '1', description: 'Item 1', quantity: 2, unit_price: 50, displayPrice: '50.00', amount: 100 }],
      subtotal: 100,
      taxRate: 0,
    }

    render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const quantitySpan = document.querySelector('span.block[style*="18px"]')
    expect(quantitySpan).toHaveStyle({ fontSize: '18px' })
  })

  it('heading size change moves heading-derived roles but not body-derived roles', () => {
    const baselineBranding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      business_name: 'Test Business',
    })
    const altBranding = createMockBranding({
      heading_size: 60,
      body_size: 22,
      business_name: 'Test Business',
    })

    const blocks: Block[] = [
      {
        id: '1',
        type: 'title',
        text: 'Doc Title',
        showCoupleName: true,
        showRef: true,
        hidden: false,
      } as never,
      {
        id: '2',
        type: 'businessName',
        layout: 'name',
        hidden: false,
      } as never,
      {
        id: '3',
        type: 'totals',
        hidden: false,
      } as never,
    ]
    const doc = {
      title: 'Doc Title',
      refNumber: 'TEST-001',
      coupleName: 'Alex & Sam',
      expiresAt: '2026-12-31',
      items: [{ id: '1', description: 'Item 1', quantity: 1, unit_price: 100, displayPrice: '100.00', amount: 100 }],
      subtotal: 100,
      taxRate: 0,
    }

    const { rerender } = render(
      <PublicBlockRenderer blocks={blocks} branding={baselineBranding} doc={doc} />,
    )

    const docTitleBaseline = screen.getByText('Doc Title')
    const subtitleBaseline = screen.getByText('Alex & Sam').closest('p')
    const sectionLabelBaseline = screen.getByText('Ref')
    const sectionHeadingBaseline = screen.getByText('Test Business').closest('p')
    const totalBaseline = screen.getByText('Total').nextElementSibling

    expect(docTitleBaseline).toHaveStyle({ fontSize: '50px' })
    expect(subtitleBaseline).toHaveStyle({ fontSize: '22px' })
    // sectionLabel follows subheading_size (11 by default here), not heading size.
    expect(sectionLabelBaseline).toHaveStyle({ fontSize: '11px' })
    expect(sectionHeadingBaseline).toHaveStyle({ fontSize: '31px' })
    expect(totalBaseline).toHaveStyle({ fontSize: '28px' })

    rerender(
      <PublicBlockRenderer blocks={blocks} branding={altBranding} doc={doc} />,
    )

    const docTitleAlt = screen.getByText('Doc Title')
    const subtitleAlt = screen.getByText('Alex & Sam').closest('p')
    const sectionLabelAlt = screen.getByText('Ref')
    const sectionHeadingAlt = screen.getByText('Test Business').closest('p')
    const totalAlt = screen.getByText('Total').nextElementSibling

    expect(docTitleAlt).toHaveStyle({ fontSize: '60px' })
    expect(subtitleAlt).toHaveStyle({ fontSize: '22px' })
    // Unchanged: subheading_size did not change, so the label size holds.
    expect(sectionLabelAlt).toHaveStyle({ fontSize: '11px' })
    expect(sectionHeadingAlt).toHaveStyle({ fontSize: '38px' })
    expect(totalAlt).toHaveStyle({ fontSize: '34px' })
  })

  it('body size change moves body-derived roles but not heading-derived roles', () => {
    const baselineBranding = createMockBranding({
      heading_size: 50,
      body_size: 22,
      business_name: 'Test Business',
      phone: '0400000000',
    })
    const altBranding = createMockBranding({
      heading_size: 50,
      body_size: 30,
      business_name: 'Test Business',
      phone: '0400000000',
    })

    const blocks: Block[] = [
      {
        id: '1',
        type: 'title',
        text: 'Doc Title',
        showCoupleName: true,
        showRef: true,
        hidden: false,
      } as never,
      {
        id: '2',
        type: 'text',
        text: 'body copy',
        hidden: false,
      } as never,
      {
        id: '3',
        type: 'footer',
        hidden: false,
      } as never,
      {
        id: '4',
        type: 'lineItems',
        showHeader: true,
        hidden: false,
      } as never,
    ]
    const doc = {
      title: 'Doc Title',
      refNumber: 'TEST-001',
      coupleName: 'Alex & Sam',
      expiresAt: '2026-12-31',
      items: [{ id: '1', description: 'Item 1', quantity: 1, unit_price: 100, displayPrice: '100.00', amount: 100 }],
      subtotal: 100,
      taxRate: 0,
    }

    const { rerender } = render(
      <PublicBlockRenderer blocks={blocks} branding={baselineBranding} doc={doc} />,
    )

    const docTitleBaseline = screen.getByText('Doc Title')
    const subtitleBaseline = screen.getByText('Alex & Sam').closest('p')
    const bodyBaseline = screen.getByText(/body copy/i).parentElement
    const descriptionHeaderBaseline = screen.getByText('Description')
    const contactLineBaseline = screen.getByText(/0400000000/).closest('p')

    expect(docTitleBaseline).toHaveStyle({ fontSize: '50px' })
    expect(subtitleBaseline).toHaveStyle({ fontSize: '22px' })
    expect(bodyBaseline).toHaveStyle({ fontSize: '22px' })
    // descriptionHeader is a sectionLabel: it follows subheading_size (11 here),
    // no longer body_size, so it stays put when body_size changes below.
    expect(descriptionHeaderBaseline).toHaveStyle({ fontSize: '11px' })
    expect(contactLineBaseline).toHaveStyle({ fontSize: '18px' })

    rerender(
      <PublicBlockRenderer blocks={blocks} branding={altBranding} doc={doc} />,
    )

    const docTitleAlt = screen.getByText('Doc Title')
    const subtitleAlt = screen.getByText('Alex & Sam').closest('p')
    const bodyAlt = screen.getByText(/body copy/i).parentElement
    const descriptionHeaderAlt = screen.getByText('Description')
    const contactLineAlt = screen.getByText(/0400000000/).closest('p')

    expect(docTitleAlt).toHaveStyle({ fontSize: '50px' })
    expect(subtitleAlt).toHaveStyle({ fontSize: '30px' })
    expect(bodyAlt).toHaveStyle({ fontSize: '30px' })
    // Held at subheading_size while body_size moved 22 -> 30.
    expect(descriptionHeaderAlt).toHaveStyle({ fontSize: '11px' })
    expect(contactLineAlt).toHaveStyle({ fontSize: '24px' })
  })

  it('subheading size change moves section labels (the subheading control)', () => {
    const blocks: Block[] = [
      { id: '1', type: 'title', text: 'Test', showRef: true, hidden: false } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    const { rerender } = render(
      <PublicBlockRenderer blocks={blocks} branding={createMockBranding({ subheading_size: 10 })} doc={doc} />,
    )
    expect(screen.getByText('Ref')).toHaveStyle({ fontSize: '10px' })

    rerender(
      <PublicBlockRenderer blocks={blocks} branding={createMockBranding({ subheading_size: 18 })} doc={doc} />,
    )
    expect(screen.getByText('Ref')).toHaveStyle({ fontSize: '18px' })
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
