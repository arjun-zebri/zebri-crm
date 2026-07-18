import { describe, it, expect } from 'vitest'
import { resolveTypeDefaults } from '@/lib/branding/type-defaults'
import { buildPublicBranding } from '@/lib/branding/public-branding'

describe('resolveTypeDefaults', () => {
  it('heading role uses heading_color, body uses text_color', () => {
    const b = buildPublicBranding({ heading_color: '#000000', text_color: '#777777' })
    const t = resolveTypeDefaults(b)
    expect(t.heading.color).toBe('#000000')
    expect(t.body.color).toBe('#777777')
  })
})
