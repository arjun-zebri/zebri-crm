import { describe, it, expect } from 'vitest'
import { buildPublicBranding } from '@/lib/branding/public-branding'

describe('buildPublicBranding role-based colours', () => {
  it('defaults to the new role palette when metadata is empty', () => {
    const b = buildPublicBranding({})
    expect(b.heading_color).toBe('#111827')
    expect(b.subheading_color).toBe('#111827')
    expect(b.text_color).toBe('#6B7280')
    expect(b.surface_color).toBe('#FFFFFF')
    expect(b.brand_color).toBe('#111827')
    expect(b.secondary_color).toBe('#6B7280')
  })

  it('derives dropped colours from the role colours', () => {
    const b = buildPublicBranding({ text_color: '#333333', brand_color: '#222222', surface_color: '#EEEEEE' })
    expect(b.muted_color).toBe('#333333')       // = text_color
    expect(b.accent_color).toBe('#222222')       // = brand_color
    expect(b.page_background).toBe('#EEEEEE')     // = surface_color
  })
})
