import { describe, expect, it } from 'vitest'

import { TEMPLATES, templatesForSurface } from '@/app/(dashboard)/branding/templates'
import { repairBlocks } from '@/lib/branding/validate-blocks'

const SURFACES = ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'] as const

describe('template registry', () => {
  it('has exactly three templates per surface with stable ids', () => {
    for (const s of SURFACES) {
      const list = templatesForSurface(s)
      expect(list.map((t) => t.id).sort()).toEqual(
        [`${s}-bold`, `${s}-classic`, `${s}-minimal`],
      )
    }
    expect(TEMPLATES).toHaveLength(18)
  })

  it('every template is structurally complete (repair is a no-op)', () => {
    for (const t of TEMPLATES) {
      const built = t.build()
      expect(repairBlocks(t.surface, built).map((b) => b.type)).toEqual(built.map((b) => b.type))
    }
  })

  it('builds fresh ids on every call', () => {
    const t = TEMPLATES[0]!
    expect(t.build().map((b) => b.id)).not.toEqual(t.build().map((b) => b.id))
  })
})
