import { describe, it, expect } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { repairBlocks } from '@/lib/branding/validate-blocks'

const types = (bs: Block[]) => bs.map((b) => b.type)

describe('repairBlocks (redesign)', () => {
  it('does NOT reinsert a deleted required block', () => {
    // invoice missing lineItems/totals: stays missing (readiness flags it)
    const input: Block[] = [{ id: 'a', type: 'businessName' }, { id: 'b', type: 'title', title: 'Invoice', subtitle: '', showRef: true, showExpires: true, showAbn: true }]
    expect(types(repairBlocks('invoice', input))).toEqual(['businessName', 'title'])
  })

  it('migrates headerBanner to image, preserving the image', () => {
    const input: Block[] = [{ id: 'h', type: 'headerBanner', heightPx: 200 } as Block]
    const out = repairBlocks('invoice', input)
    expect(out[0]!.type).toBe('image')
  })

  it('drops an unknown legacy block type', () => {
    const input: Block[] = [
      { id: 'bn', type: 'businessName' },
      { id: 'pb', type: 'proposalBody', locked: true } as unknown as Block,
      { id: 'ac', type: 'action', primary: 'Pay now', secondary: null },
    ]
    const out = types(repairBlocks('invoice', input))
    expect(out).toEqual(['businessName', 'action'])
  })

  it('is idempotent', () => {
    const once = repairBlocks('invoice', [{ id: 'h', type: 'headerBanner', heightPx: 200 } as Block, { id: 'ac', type: 'action', primary: 'A', secondary: null }])
    const twice = repairBlocks('invoice', once)
    expect(types(twice)).toEqual(types(once))
  })

  it('dedups a surviving marker', () => {
    const input: Block[] = [{ id: 'c1', type: 'contractBody', locked: true }, { id: 'c2', type: 'contractBody', locked: true }]
    expect(repairBlocks('contract', input).filter((b) => b.type === 'contractBody')).toHaveLength(1)
  })

  it('round-trips a contractSign marker with its overrides through repair', () => {
    const input: Block[] = [
      { id: 'bn', type: 'businessName' },
      { id: 'cb', type: 'contractBody', locked: true },
      {
        id: 'cs',
        type: 'contractSign',
        locked: true,
        heading: 'Sign here',
        primaryLabel: 'Accept',
        buttonColor: '#111827',
      } as Block,
    ]
    const out = repairBlocks('contract', input)
    expect(types(out)).toEqual(['businessName', 'contractBody', 'contractSign'])
    expect(out.find((b) => b.type === 'contractSign')).toEqual({
      id: 'cs',
      type: 'contractSign',
      locked: true,
      heading: 'Sign here',
      primaryLabel: 'Accept',
      buttonColor: '#111827',
    })
  })

  it('dedups a surviving contractSign marker (keep first)', () => {
    const input: Block[] = [
      { id: 's1', type: 'contractSign', locked: true },
      { id: 's2', type: 'contractSign', locked: true },
    ]
    const out = repairBlocks('contract', input).filter((b) => b.type === 'contractSign')
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe('s1')
  })

  it('does NOT reinsert a deleted contractSign marker (readiness flags it)', () => {
    const input: Block[] = [
      { id: 'bn', type: 'businessName' },
      { id: 'cb', type: 'contractBody', locked: true },
    ]
    expect(types(repairBlocks('contract', input))).toEqual(['businessName', 'contractBody'])
  })
})
