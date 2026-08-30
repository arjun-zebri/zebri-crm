import { describe, expect, it } from 'vitest'

import { documentHeading } from '@/lib/branding/document-heading'

const header = (title: string) => [{ id: 'tt', type: 'title', title }] as never

describe('documentHeading', () => {
  it('uses the Contract header block when the contract has no title', () => {
    expect(documentHeading(header('Contract'), null)).toBe('Contract')
  })

  it('lets a per-contract title override the block', () => {
    expect(documentHeading(header('Contract'), 'Wedding Service Agreement')).toBe(
      'Wedding Service Agreement',
    )
  })

  it('treats a blank per-contract title as unset', () => {
    expect(documentHeading(header('Contract'), '   ')).toBe('Contract')
  })

  it('returns empty when neither supplies one, so no empty heading renders', () => {
    expect(documentHeading([], null)).toBe('')
    expect(documentHeading(null, null)).toBe('')
    expect(documentHeading(header('   '), null)).toBe('')
  })

  it('ignores non-title blocks', () => {
    const blocks = [{ id: 'bn', type: 'businessName' }, { id: 'tt', type: 'title', title: 'Contract' }] as never
    expect(documentHeading(blocks, null)).toBe('Contract')
  })
})
