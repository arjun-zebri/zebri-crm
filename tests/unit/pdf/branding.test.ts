/**
 * PDF branding feature tests.
 *
 * Verifies that:
 * - Invoice PDFs render with and without branding (snapshot stability).
 * - Contract PDFs render with and without branding.
 * - PublicBranding adapts correctly to PdfBrandingOpts.
 *
 * @module tests/unit/pdf/branding.test
 */
import { describe, it, expect } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import {
  buildPdfHtml,
  publicBrandingToPdfOpts,
  type PdfDocumentData,
  type PdfBrandingOpts,
} from '@/lib/pdf/generate-pdf'

describe('buildPdfHtml with branding', () => {
  const invoiceDoc: PdfDocumentData = {
    type: 'invoice',
    documentNumber: 'INV-001',
    title: 'Wedding MC Services',
    status: 'sent',
    coupleName: 'Smith & Jones',
    businessName: 'Amazing MCs Inc',
    items: [
      { description: 'MC Services', amount: 1000 },
    ],
    subtotal: 1000,
    total: 1100,
    taxRate: 10,
    notes: 'Thank you for your business',
  }

  const contractDoc: PdfDocumentData = {
    type: 'contract',
    documentNumber: 'CTR-001',
    title: 'Wedding MC Agreement',
    status: 'draft',
    coupleName: 'Smith & Jones',
    businessName: 'Amazing MCs Inc',
    items: [],
    subtotal: 0,
    total: 0,
    contractHtml: '<p>Test contract content</p>',
  }

  const branding: PdfBrandingOpts = {
    brandColor: '#FF6B35',
    textColor: '#1A1A1A',
    mutedColor: '#666666',
    headingColor: '#000000',
    subheadingColor: '#333333',
    headingFontFamily: "'Georgia', serif",
    bodyFontFamily: "'Roboto', sans-serif",
    fontsHref: 'https://fonts.googleapis.com/css2?family=Georgia:wght@400;700&display=swap',
    logoUrl: 'https://example.com/logo.png',
  }

  it('renders invoice without branding (snapshot stability)', () => {
    const html = buildPdfHtml(invoiceDoc)
    expect(html).toContain('INV-001')
    expect(html).toContain('Smith & Jones')
    expect(html).toContain('Amazing MCs Inc')
    expect(html).toContain('$1,100.00')
    // Verify no branding artifacts when branding omitted.
    expect(html).not.toContain('#FF6B35')
    // Snapshot unbranded output to catch future changes.
    expect(html).toMatchSnapshot()
  })

  it('renders invoice with branding', () => {
    const html = buildPdfHtml(invoiceDoc, branding)
    expect(html).toContain('INV-001')
    expect(html).toContain('Smith & Jones')
    // Brand color should appear in the HTML when provided.
    expect(html).toContain('#FF6B35')
    // Heading color should appear for titles and totals.
    expect(html).toContain('#000000')
    // Subheading color should appear for section labels.
    expect(html).toContain('#333333')
    // Logo should be embedded.
    expect(html).toContain('https://example.com/logo.png')
    // Fonts link should be present.
    expect(html).toContain('https://fonts.googleapis.com/css2?family=Georgia')
    // Font families should be used.
    expect(html).toContain("'Georgia', serif")
    expect(html).toContain("'Roboto', sans-serif")
  })

  it('renders contract without branding (snapshot stability)', () => {
    const html = buildPdfHtml(contractDoc)
    expect(html).toContain('CTR-001')
    expect(html).toContain('Smith & Jones')
    expect(html).toContain('Test contract content')
    // Verify no branding artifacts when branding omitted.
    expect(html).not.toContain('#FF6B35')
    // Snapshot unbranded output to catch future changes.
    expect(html).toMatchSnapshot()
  })

  it('renders contract with branding', () => {
    const html = buildPdfHtml(contractDoc, branding)
    expect(html).toContain('CTR-001')
    expect(html).toContain('Smith & Jones')
    expect(html).toContain('Test contract content')
    // Brand color should appear in the HTML.
    expect(html).toContain('#FF6B35')
    // Heading color should appear for h1/h2/h3 elements.
    expect(html).toContain('#000000')
    // Logo should be embedded.
    expect(html).toContain('https://example.com/logo.png')
  })

  describe('line item columns', () => {
    it('omits Qty / Unit price when items carry no quantity or unit price', () => {
      const html = buildPdfHtml(invoiceDoc)
      expect(html).not.toContain('>Qty<')
      expect(html).not.toContain('>Unit price<')
      expect(html).toContain('$1,000.00')
    })

    it('omits Qty / Unit price when every item is a plain qty-1 line', () => {
      // The builder writes quantity=1, unit_price=amount for forward
      // compatibility; those columns would just repeat the amount.
      const html = buildPdfHtml({
        ...invoiceDoc,
        items: [{ description: 'MC Services', quantity: 1, unit_price: 1000, amount: 1000 }],
      })
      expect(html).not.toContain('>Qty<')
      expect(html).not.toContain('>Unit price<')
    })

    it('renders Qty / Unit price when an item has a real quantity', () => {
      const html = buildPdfHtml({
        ...invoiceDoc,
        items: [{ description: 'Extra hours', quantity: 2, unit_price: 500, amount: 1000 }],
      })
      expect(html).toContain('>Qty<')
      expect(html).toContain('>Unit price<')
      expect(html).toContain('>2<')
      expect(html).toContain('$500.00')
    })

    it('pads qty-1 rows so columns line up when another item has a quantity', () => {
      const html = buildPdfHtml({
        ...invoiceDoc,
        items: [
          { description: 'MC Services', amount: 1000 },
          { description: 'Extra hours', quantity: 2, unit_price: 500, amount: 1000 },
        ],
      })
      // Header is 4 columns, so every row must also be 4 cells.
      const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? []
      const itemRows = rows.filter((r) => r.includes('MC Services') || r.includes('Extra hours'))
      expect(itemRows).toHaveLength(2)
      for (const row of itemRows) {
        expect((row.match(/<td/g) ?? []).length).toBe(4)
      }
    })
  })

  describe('prices include GST note', () => {
    it('is absent unless the flag is set', () => {
      expect(buildPdfHtml(invoiceDoc)).not.toContain('Prices include GST')
    })

    it('renders under the total when the flag is set', () => {
      const html = buildPdfHtml({ ...invoiceDoc, gstInclusive: true })
      expect(html).toContain('Prices include GST')
      // Display only: the printed total is unchanged by the flag.
      expect(html).toContain('$1,100.00')
      expect(html.indexOf('Prices include GST')).toBeGreaterThan(html.indexOf('>Total<'))
    })
  })

})

describe('publicBrandingToPdfOpts adapter', () => {
  it('converts PublicBranding to PdfBrandingOpts with all fields', () => {
    const metadata = {
      logo_url: 'https://example.com/logo.png',
      brand_color: '#FF6B35',
      text_color: '#1A1A1A',
      heading_color: '#000000',
      subheading_color: '#333333',
      font_heading: 'inter' as const,
      font_body: 'inter' as const,
      theme_preset: 'custom',
      business_name: 'Test MC',
    }
    const branding = buildPublicBranding(metadata as any)
    const opts = publicBrandingToPdfOpts(branding)

    expect(opts.brandColor).toBe('#FF6B35')
    expect(opts.textColor).toBe('#1A1A1A')
    expect(opts.mutedColor).toBe('#1A1A1A')
    expect(opts.headingColor).toBe('#000000')
    expect(opts.subheadingColor).toBe('#333333')
    expect(opts.logoUrl).toBe('https://example.com/logo.png')
    expect(opts.headingFontFamily).toBeDefined()
    expect(opts.bodyFontFamily).toBeDefined()
    expect(opts.fontsHref).toBeDefined()
  })

  it('handles missing logo gracefully', () => {
    const metadata = {
      brand_color: '#FF6B35',
      text_color: '#1A1A1A',
      muted_color: '#666666',
      font_heading: 'inter' as const,
      font_body: 'inter' as const,
      theme_preset: 'custom',
    }
    const branding = buildPublicBranding(metadata as any)
    const opts = publicBrandingToPdfOpts(branding)

    expect(opts.logoUrl).toBeUndefined()
    expect(opts.brandColor).toBe('#FF6B35')
  })

  it('uses theme preset defaults when heading/subheading colors not in metadata', () => {
    const metadata = {
      brand_color: '#FF6B35',
      text_color: '#1A1A1A',
      font_heading: 'inter' as const,
      font_body: 'inter' as const,
      theme_preset: 'minimal',
    }
    const branding = buildPublicBranding(metadata as any)
    const opts = publicBrandingToPdfOpts(branding)

    // When heading_color is not in metadata, buildPublicBranding uses theme preset default.
    // For minimal theme, heading defaults to '#111827'.
    expect(opts.headingColor).toBe('#111827')
    // When subheading_color is not in metadata, buildPublicBranding uses theme preset default.
    // For minimal theme, subheading defaults to '#111827'.
    expect(opts.subheadingColor).toBe('#111827')
  })
})
