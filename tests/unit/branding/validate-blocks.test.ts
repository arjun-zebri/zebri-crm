import { describe, expect, it } from 'vitest'

import { repairBlocks } from '@/lib/branding/validate-blocks'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

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
