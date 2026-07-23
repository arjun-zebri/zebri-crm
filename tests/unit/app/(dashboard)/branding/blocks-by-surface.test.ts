import { describe, expect, it } from 'vitest'
import { blocksForSurface } from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import type { SurfaceTab } from '@/types/branding-preview'

describe('blocksForSurface', () => {
  it('returns blocks for proposal surface including general + doc-specific', () => {
    const blocks = blocksForSurface('proposal')
    expect(blocks).toContain('text')
    expect(blocks).toContain('divider')
    expect(blocks).toContain('packageHeader')
    expect(blocks).toContain('packageDetails')
    expect(blocks).toContain('action')
  })

  it('proposal excludes old headerBanner', () => {
    const blocks = blocksForSurface('proposal')
    expect(blocks).not.toContain('headerBanner')
  })

  it('invoice includes all structure, content, and action blocks', () => {
    const blocks = blocksForSurface('invoice')
    expect(blocks).toContain('text')
    expect(blocks).toContain('title')
    expect(blocks).toContain('lineItems')
    expect(blocks).toContain('totals')
    expect(blocks).toContain('paymentSchedule')
    expect(blocks).toContain('paymentDetails')
    expect(blocks).toContain('action')
  })

  it('invoice includes lineItems, totals, and paymentDetails', () => {
    const blocks = blocksForSurface('invoice')
    expect(blocks).toContain('lineItems')
    expect(blocks).toContain('totals')
    expect(blocks).toContain('paymentDetails')
  })

  it('proposal excludes lineItems, totals, and paymentDetails', () => {
    const blocks = blocksForSurface('proposal')
    expect(blocks).not.toContain('lineItems')
    expect(blocks).not.toContain('totals')
    expect(blocks).not.toContain('paymentDetails')
  })

  it('contract includes the correct addable block types', () => {
    const blocks = blocksForSurface('contract')
    expect(blocks).toContain('text')
    expect(blocks).toContain('title')
    expect(blocks).toContain('action')
  })

  it('portal includes general blocks and couplePortal', () => {
    const blocks = blocksForSurface('portal')
    expect(blocks).toContain('text')
    expect(blocks).toContain('couplePortal')
  })

  it('portal excludes action block', () => {
    const blocks = blocksForSurface('portal')
    expect(blocks).not.toContain('action')
  })

  it('does not include old fixed marker blocks (headerBanner, proposalBody, contractBody)', () => {
    const allBlocks = ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'] as const
    const allBlocksFlat = allBlocks.flatMap(s => blocksForSurface(s))
    expect(allBlocksFlat).not.toContain('headerBanner')
    expect(allBlocksFlat).not.toContain('proposalBody')
  })

  it('returns blocks for a passed surface parameter', () => {
    const surface: SurfaceTab = 'invoice'
    const blocks = blocksForSurface(surface)
    expect(blocks).toContain('lineItems')
    expect(blocks).toContain('totals')
    expect(blocks).toContain('paymentDetails')
  })
})
