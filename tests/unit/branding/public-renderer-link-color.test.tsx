import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { PROPOSAL_LABEL_DEFAULTS } from '@/lib/branding/proposal-labels'

const createMockBranding = (linkColor: string): PublicBranding => ({
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
  link_color: linkColor,
  button_variant: 'fill',
  button_size: 'md',
  button_radius: 8,
  section_spacing: 32,
  page_background: '#fff',
})

describe('PublicBlockRenderer link color', () => {
  it('renders wrapper with --doc-link CSS variable set to branding.link_color', () => {
    const linkColor = '#FF0000'
    const branding = createMockBranding(linkColor)
    const blocks: Block[] = [
      {
        id: '1',
        type: 'text',
        text: '<a href="https://example.com">Link</a>',
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    const { container } = render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.style.getPropertyValue('--doc-link')).toBe(linkColor)
  })

  it('renders wrapper with anchor-colour class', () => {
    const branding = createMockBranding('#FF0000')
    const blocks: Block[] = [
      {
        id: '1',
        type: 'text',
        text: '<a href="https://example.com">Link</a>',
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    const { container } = render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('[&_a]:[color:var(--doc-link)]')
  })

  it('applies link_color default (brand_color) when link_color is not explicitly set', () => {
    const branding = createMockBranding('#1234AB')
    const blocks: Block[] = [
      {
        id: '1',
        type: 'text',
        text: '<a href="https://example.com">Link</a>',
        hidden: false,
      } as never,
    ]
    const doc = { title: 'Test', refNumber: 'TEST-001', expiresAt: '2026-12-31', items: [], subtotal: 0, taxRate: 0 }

    const { container } = render(
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--doc-link')).toBe('#1234AB')
  })
})
