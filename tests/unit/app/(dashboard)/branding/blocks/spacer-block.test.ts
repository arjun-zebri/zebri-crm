import { describe, expect, it } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'

describe('spacer block', () => {
  it('blockTemplate creates a spacer with default height of 32px', () => {
    const block = blockTemplate('spacer')
    expect(block).toMatchObject({
      type: 'spacer',
      heightPx: 32,
    })
    expect(block.id).toBeTruthy()
    expect(block.id).toMatch(/^sp-/)
  })
})
