import { describe, expect, it } from 'vitest'

import { DOC_SPECIFIC_BY_SURFACE } from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import { BLOCK_LABELS } from '@/app/(dashboard)/branding/blocks/types'
import { BLOCK_TYPE_LABELS } from '@/lib/proposals/engagement-labels'

/**
 * m4: `BLOCK_TYPE_LABELS` is a hand-copied duplicate of `BLOCK_LABELS`
 * restricted to the proposal surface. Nothing enforced that the two agree,
 * so a rename in the block editor (or a new block added to the proposal
 * surface) could silently leave the engagement panel speaking the old
 * name. Diffing the two objects directly means a future drift fails this
 * test instead of only being caught by eyeballing the panel.
 */
describe('BLOCK_TYPE_LABELS', () => {
  it('matches BLOCK_LABELS for every block type on the proposal surface', () => {
    const expected = Object.fromEntries(
      DOC_SPECIFIC_BY_SURFACE.proposal.map((type) => [type, BLOCK_LABELS[type]]),
    )
    expect(BLOCK_TYPE_LABELS).toEqual(expected)
  })
})
