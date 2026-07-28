import { describe, it, expect } from 'vitest'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

const types = (bs: Block[]) => bs.map((b) => b.type)

describe('repairBlocks (redesign)', () => {
  it('does NOT reinsert a deleted required block', () => {
    // invoice missing lineItems/totals: stays missing (readiness flags it)
    const input: Block[] = [{ id: 'a', type: 'businessName' }, { id: 'b', type: 'title', title: 'Invoice', subtitle: '', showRef: true, showExpires: true, showAbn: true }]
    expect(types(repairBlocks('invoice', input))).toEqual(['businessName', 'title'])
  })

  it('migrates headerBanner to image, preserving the image', () => {
    const input: Block[] = [{ id: 'h', type: 'headerBanner', heightPx: 200 } as Block]
    const out = repairBlocks('proposal', input)
    expect(out[0]!.type).toBe('image')
  })

  it('expands a legacy proposalBody marker into four package blocks', () => {
    const input: Block[] = [
      { id: 'bn', type: 'businessName' },
      { id: 'pb', type: 'proposalBody', locked: true },
      { id: 'ac', type: 'action', primary: 'Accept', secondary: null },
    ]
    const out = types(repairBlocks('proposal', input))
    expect(out).toEqual(['businessName', 'packageHeader', 'packageDetails', 'packageLineItems', 'packageInclusions', 'packageTotals', 'action'])
  })

  it('is idempotent', () => {
    const once = repairBlocks('proposal', [{ id: 'pb', type: 'proposalBody', locked: true }, { id: 'ac', type: 'action', primary: 'A', secondary: null }])
    const twice = repairBlocks('proposal', once)
    expect(types(twice)).toEqual(types(once))
  })

  it('dedups a surviving marker', () => {
    const input: Block[] = [{ id: 'c1', type: 'contractBody', locked: true }, { id: 'c2', type: 'contractBody', locked: true }]
    expect(repairBlocks('contract', input).filter((b) => b.type === 'contractBody')).toHaveLength(1)
  })
})
