import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { repairBlocks, repairAllSurfaces, type BlocksByDoc } from '@/lib/branding/validate-blocks'

describe('repairBlocks', () => {
  it('re-inserts deleted required blocks on invoices', () => {
    const repaired = repairBlocks('invoice', [
      { id: 'a', type: 'headerBanner' },
    ])
    const types = repaired.map((b) => b.type)
    expect(types).toContain('lineItems')
    expect(types).toContain('totals')
    expect(types).toContain('paymentDetails')
    expect(types).toContain('paymentSchedule')
  })

  it('dedupes doubled markers, keeping the first', () => {
    const repaired = repairBlocks('proposal', [
      { id: 'p1', type: 'proposalBody', locked: true },
      { id: 'p2', type: 'proposalBody', locked: true },
    ])
    expect(repaired.filter((b) => b.type === 'proposalBody')).toHaveLength(1)
    expect(repaired[0]?.id).toBe('p1')
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

  it('leaves a healthy tree untouched (same references)', () => {
    const input: Block[] = [
      { id: 'h', type: 'headerBanner' },
      { id: 'cb', type: 'contractBody', locked: true },
    ]
    const repaired = repairBlocks('contract', input)
    expect(repaired[0]).toBe(input[0])
    expect(repaired[1]).toBe(input[1])
  })

  it('inserts invoice financial blocks in document order', () => {
    const repaired = repairBlocks('invoice', [{ id: 'a', type: 'headerBanner' }])
    const types = repaired.map((b) => b.type)
    const lineItemsIdx = types.indexOf('lineItems')
    const totalsIdx = types.indexOf('totals')
    const paymentDetailsIdx = types.indexOf('paymentDetails')
    const paymentScheduleIdx = types.indexOf('paymentSchedule')

    expect(paymentScheduleIdx).toBeLessThan(lineItemsIdx)
    expect(lineItemsIdx).toBeLessThan(totalsIdx)
    expect(totalsIdx).toBeLessThan(paymentDetailsIdx)
  })
})

describe('repairAllSurfaces', () => {
  it('returns all six surface keys when input has all six', () => {
    const input: BlocksByDoc = {
      proposal: [{ id: 'p', type: 'proposalBody', locked: true }],
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
      'proposal',
      'questionnaire',
      'vendorTimeline',
    ])
  })

  it('preserves empty arrays without resurrecting required blocks', () => {
    const input: Partial<BlocksByDoc> = {
      proposal: [],
      invoice: [{ id: 'i', type: 'headerBanner' }],
      contract: [],
    }
    const result = repairAllSurfaces(input)

    // Empty arrays stay empty, never get markers or required blocks added.
    expect(result.proposal).toEqual([])
    expect(result.contract).toEqual([])

    // Non-empty invoice tree gets repaired with required blocks.
    expect(result.invoice.map((b) => b.type)).toContain('paymentSchedule')
    expect(result.invoice.map((b) => b.type)).toContain('lineItems')
    expect(result.invoice.map((b) => b.type)).toContain('totals')
  })

  it('repairs non-empty trees and inserts required blocks', () => {
    const input: Partial<BlocksByDoc> = {
      proposal: [{ id: 'h', type: 'headerBanner' }],
    }
    const result = repairAllSurfaces(input)

    // Proposal tree should be repaired with proposalBody marker.
    expect(result.proposal.map((b) => b.type)).toContain('proposalBody')
  })

  it('seeds missing keys as empty arrays for lossless round-trip', () => {
    // Old data without vendorTimeline and questionnaire.
    const input: Partial<BlocksByDoc> = {
      proposal: [{ id: 'p', type: 'proposalBody', locked: true }],
      invoice: [{ id: 'i', type: 'paymentSchedule', locked: true }],
      contract: [{ id: 'c', type: 'contractBody', locked: true }],
      portal: [{ id: 'pt', type: 'couplePortal', locked: true }],
    }
    const result = repairAllSurfaces(input)

    // New surfaces should be empty arrays, not dropped or seeded with defaults.
    expect(result.vendorTimeline).toEqual([])
    expect(result.questionnaire).toEqual([])

    // Existing surfaces should be preserved.
    expect(result.proposal[0]?.id).toBe('p')
    expect(result.invoice[0]?.id).toBe('i')
    expect(result.contract[0]?.id).toBe('c')
    expect(result.portal[0]?.id).toBe('pt')
  })
})
