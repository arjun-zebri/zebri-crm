import { describe, expect, it } from 'vitest'
import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import type { ImageBlock } from '@/app/(dashboard)/branding/blocks/types'

describe('Image block template', () => {
  it('creates a block with correct type and defaults', () => {
    const block = blockTemplate('image') as ImageBlock
    expect(block.type).toBe('image')
    expect(block.id).toBeTruthy()
    expect(block.id.startsWith('im-')).toBe(true)
    expect(block.fit).toBe('cover')
    expect(block.url).toBeUndefined()
    expect(block.imageX).toBeUndefined()
    expect(block.imageY).toBeUndefined()
    expect(block.imageScale).toBeUndefined()
    expect(block.heightPx).toBeUndefined()
  })
})
