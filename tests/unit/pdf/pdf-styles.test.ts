/**
 * PDF type CSS generation tests.
 *
 * Verifies that pdfTypeCss emits CSS custom properties for every role
 * and colour, deriving sizes from the global numbers and colours from
 * the branding model.
 *
 * @module tests/unit/pdf/pdf-styles.test
 */
import { describe, it, expect } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { pdfTypeCss } from '@/lib/pdf/pdf-styles'

describe('pdfTypeCss', () => {
  /**
   * Fixture helper: builds a minimal PublicBranding object.
   * All required fields are included; callers override specific ones.
   */
  function fixture(overrides: Partial<ReturnType<typeof buildPublicBranding>> = {}) {
    const base = buildPublicBranding({
      heading_size: 20,
      body_size: 14,
      border_color: '#E5E7EB',
    })
    return { ...base, ...overrides }
  }

  it('emits role sizes derived from the global numbers', () => {
    const css = pdfTypeCss({ ...fixture(), heading_size: 40, body_size: 20 })
    expect(css).toContain('--pdf-doc-title: 40px')
    expect(css).toContain('--pdf-body: 20px')
  })

  it('emits the border colour', () => {
    const css = pdfTypeCss({ ...fixture(), border_color: '#FF00FF' })
    expect(css).toContain('--pdf-border: #FF00FF')
  })

  it('derives section heading from heading size by ratio 0.625', () => {
    const css = pdfTypeCss({ ...fixture(), heading_size: 40 })
    // 40 * 0.625 = 25
    expect(css).toContain('--pdf-section-heading: 25px')
  })

  it('derives total from heading size by ratio 0.5625', () => {
    const css = pdfTypeCss({ ...fixture(), heading_size: 40 })
    // 40 * 0.5625 = 22.5, rounds to 23
    expect(css).toContain('--pdf-total: 23px')
  })

  it('derives fine print from body size by ratio 0.8', () => {
    const css = pdfTypeCss({ ...fixture(), body_size: 20 })
    // 20 * 0.8 = 16
    expect(css).toContain('--pdf-fine-print: 16px')
  })

  it('derives section label from body size by ratio 0.73', () => {
    const css = pdfTypeCss({ ...fixture(), body_size: 20 })
    // 20 * 0.73 = 14.6, rounds to 15
    expect(css).toContain('--pdf-section-label: 15px')
  })

  it('emits subtitle (body size 1.0)', () => {
    const css = pdfTypeCss({ ...fixture(), body_size: 18 })
    expect(css).toContain('--pdf-subtitle: 18px')
  })

  it('emits role colours from heading_color', () => {
    const css = pdfTypeCss({ ...fixture(), heading_color: '#FF0000' })
    expect(css).toContain('--pdf-doc-title-color: #FF0000')
    expect(css).toContain('--pdf-section-heading-color: #FF0000')
  })

  it('emits role colours from subheading_color', () => {
    const css = pdfTypeCss({ ...fixture(), subheading_color: '#00FF00' })
    expect(css).toContain('--pdf-subtitle-color: #00FF00')
    expect(css).toContain('--pdf-section-label-color: #00FF00')
  })

  it('emits role colours from text_color', () => {
    const css = pdfTypeCss({ ...fixture(), text_color: '#0000FF' })
    expect(css).toContain('--pdf-body-color: #0000FF')
    expect(css).toContain('--pdf-fine-print-color: #0000FF')
  })

  it('emits total colour from heading_color', () => {
    const css = pdfTypeCss({ ...fixture(), heading_color: '#FF6B35' })
    expect(css).toContain('--pdf-total-color: #FF6B35')
  })

  it('is wrapped in a :root selector for CSS custom properties', () => {
    const css = pdfTypeCss(fixture())
    expect(css).toContain(':root {')
    expect(css).toContain('}')
  })

  it('clamps role sizes to 9px minimum', () => {
    // body_size: 3, fine print ratio 0.8 = 2.4px -> clamped to 9px
    const css = pdfTypeCss({ ...fixture(), body_size: 3 })
    expect(css).toContain('--pdf-fine-print: 9px')
  })
})
