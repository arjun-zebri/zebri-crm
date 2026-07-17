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
    // Logo should be embedded.
    expect(html).toContain('https://example.com/logo.png')
  })
})

describe('publicBrandingToPdfOpts adapter', () => {
  it('converts PublicBranding to PdfBrandingOpts with all fields', () => {
    const metadata = {
      logo_url: 'https://example.com/logo.png',
      brand_color: '#FF6B35',
      text_color: '#1A1A1A',
      muted_color: '#666666',
      font_heading: 'inter' as const,
      font_body: 'inter' as const,
      theme_preset: 'custom',
      business_name: 'Test MC',
    }
    const branding = buildPublicBranding(metadata as any)
    const opts = publicBrandingToPdfOpts(branding)

    expect(opts.brandColor).toBe('#FF6B35')
    expect(opts.textColor).toBe('#1A1A1A')
    expect(opts.mutedColor).toBe('#666666')
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
})
