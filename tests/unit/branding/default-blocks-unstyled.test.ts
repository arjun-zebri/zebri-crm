import { describe, expect, it } from 'vitest'

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'

const SURFACES = ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'] as const

/** Keys on a block that carry baked styling. */
const STYLE_KEYS = ['titleStyle', 'subtitleStyle', 'textStyle', 'totalStyle', 'labelStyle', 'style']

describe('default block trees carry no baked styling', () => {
  it.each(SURFACES)('%s blocks inherit everything from global styles', (surface) => {
    for (const block of defaultBlocksFor(surface)) {
      for (const key of STYLE_KEYS) {
        expect(block as unknown as Record<string, unknown>).not.toHaveProperty(key)
      }
    }
  })

  it('does not bake a divider colour', () => {
    for (const surface of SURFACES) {
      for (const block of defaultBlocksFor(surface)) {
        if (block.type === 'divider') {
          expect(block as unknown as Record<string, unknown>).not.toHaveProperty('color')
        }
      }
    }
  })
})
