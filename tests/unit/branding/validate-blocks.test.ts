import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { repairBlocks, repairAllSurfaces, type BlocksByDoc } from '@/lib/branding/validate-blocks'

describe('repairBlocks', () => {
  it('does NOT re-insert deleted required blocks (readiness flags absence)', () => {
    const repaired = repairBlocks('invoice', [
      { id: 'a', type: 'headerBanner' },
    ])
    const types = repaired.map((b) => b.type)
    // headerBanner migrates to image; required blocks stay deleted
    expect(types).toEqual(['image'])
  })

  it('dedupes doubled render-split markers, keeping the first', () => {
    const repaired = repairBlocks('contract', [
      { id: 'c1', type: 'contractBody', locked: true },
      { id: 'c2', type: 'contractBody', locked: true },
    ])
    expect(repaired.filter((b) => b.type === 'contractBody')).toHaveLength(1)
    expect(repaired[0]?.id).toBe('c1')
  })

  it('drops unknown block types instead of crashing', () => {
    const repaired = repairBlocks('portal', [
      { id: 'x', type: 'hackedBlock' } as never,
      { id: 'cp', type: 'couplePortal', locked: true },
    ])
    expect(repaired.map((b) => b.type)).toEqual(['couplePortal'])
  })

  it('is idempotent', () => {
    const once = repairBlocks('invoice', [])
    expect(repairBlocks('invoice', once)).toEqual(once)
  })

  it('migrates legacy shapes and preserves current ones', () => {
    const input: Block[] = [
      { id: 'h', type: 'headerBanner' },
      { id: 'cb', type: 'contractBody', locked: true },
    ]
    const repaired = repairBlocks('contract', input)
    // headerBanner gets migrated to image
    expect(repaired[0]?.type).toBe('image')
    expect(repaired[0]?.id).toBe('h')
    // contractBody (a marker) is preserved
    expect(repaired[1]).toBe(input[1])
  })

  it('migrates legacy shapes without inserting required blocks', () => {
    const repaired = repairBlocks('invoice', [{ id: 'a', type: 'headerBanner' }])
    const types = repaired.map((b) => b.type)
    // headerBanner migrates to image; required blocks are NOT inserted
    expect(types).toEqual(['image'])
  })
})

describe('repairAllSurfaces', () => {
  it('returns all five surface keys when input has all five', () => {
    const input: BlocksByDoc = {
      invoice: [{ id: 'i', type: 'paymentSchedule', locked: true }],
      contract: [{ id: 'c', type: 'contractBody', locked: true }],
      portal: [{ id: 'pt', type: 'couplePortal', locked: true }],
      vendorTimeline: [{ id: 'vt', type: 'vendorTimelineBody', locked: true }],
      questionnaire: [{ id: 'q', type: 'questionnaireBody', locked: true }],
    }
    const result = repairAllSurfaces(input)
    expect(Object.keys(result).sort()).toEqual([
      'contract',
      'invoice',
      'portal',
      'questionnaire',
      'vendorTimeline',
    ])
  })

  it('preserves empty arrays; non-empty trees migrate but do not auto-insert required blocks', () => {
    const input: Partial<BlocksByDoc> = {
      invoice: [{ id: 'i', type: 'headerBanner' }],
      contract: [],
    }
    const result = repairAllSurfaces(input)

    // Empty arrays stay empty, never get markers or required blocks added.
    expect(result.contract).toEqual([])

    // Non-empty invoice tree migrates headerBanner->image but does NOT auto-insert required.
    expect(result.invoice.map((b) => b.type)).toEqual(['image'])
  })

  it('repairs non-empty trees (migrates legacy) without auto-inserting required', () => {
    const input: Partial<BlocksByDoc> = {
      vendorTimeline: [{ id: 'h', type: 'headerBanner' }],
    }
    const result = repairAllSurfaces(input)

    // Tree migrates headerBanner->image; no required blocks are auto-inserted.
    expect(result.vendorTimeline.map((b) => b.type)).toEqual(['image'])
  })

  it('seeds missing keys as empty arrays for lossless round-trip', () => {
    // Old data without vendorTimeline and questionnaire.
    const input: Partial<BlocksByDoc> = {
      invoice: [{ id: 'i', type: 'paymentSchedule', locked: true }],
      contract: [{ id: 'c', type: 'contractBody', locked: true }],
      portal: [{ id: 'pt', type: 'couplePortal', locked: true }],
    }
    const result = repairAllSurfaces(input)

    // New surfaces should be empty arrays, not dropped or seeded with defaults.
    expect(result.vendorTimeline).toEqual([])
    expect(result.questionnaire).toEqual([])

    // Existing surfaces are preserved as-is.
    expect(result.invoice[0]?.id).toBe('i')
    expect(result.invoice[0]?.type).toBe('paymentSchedule')
    expect(result.contract[0]?.id).toBe('c')
    expect(result.contract[0]?.type).toBe('contractBody')
    expect(result.portal[0]?.id).toBe('pt')
    expect(result.portal[0]?.type).toBe('couplePortal')
  })
})
