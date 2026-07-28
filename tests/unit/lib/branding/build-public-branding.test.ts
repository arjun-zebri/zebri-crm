import { describe, expect, it } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'

describe('buildPublicBranding — redesign fields', () => {
  it('defaults the new type + global-style fields', () => {
    const b = buildPublicBranding({})
    expect(b.heading_size).toBe(32)
    expect(b.body_size).toBe(15)
    expect(b.heading_case).toBe('none')
    expect(b.link_color).toBe(b.brand_color)
    expect(b.button_variant).toBe('fill')
    expect(b.section_spacing).toBe(32)
    expect(b.page_background).toBe(b.surface_color)
  })
  it('honours overrides from metadata', () => {
    const b = buildPublicBranding({ heading_size: 44, heading_case: 'uppercase', link_color: '#FF0000' })
    expect(b.heading_size).toBe(44)
    expect(b.heading_case).toBe('uppercase')
    expect(b.link_color).toBe('#FF0000')
  })
})
