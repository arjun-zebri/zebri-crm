import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'

const branding = buildPublicBranding({})
const doc = { title: '', refNumber: '', expiresAt: null, items: [], subtotal: 0, taxRate: 0 }
const blocks: Block[] = [{ id: 'd1', type: 'divider' }, { id: 's1', type: 'spacer', heightPx: 10 }]

describe('PublicBlockRenderer frame', () => {
  it('document frame renders no <section> wrappers (unchanged)', () => {
    const { container } = render(<PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />)
    expect(container.querySelectorAll('section')).toHaveLength(0)
  })
  it('page frame wraps every visible block in a section', () => {
    const { container } = render(<PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelectorAll('section[data-block-id]')).toHaveLength(2)
  })
  it('a hidden block renders nothing in either frame', () => {
    const { container } = render(<PublicBlockRenderer blocks={[{ ...blocks[0]!, hidden: true }]} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelectorAll('section')).toHaveLength(0)
  })
})
