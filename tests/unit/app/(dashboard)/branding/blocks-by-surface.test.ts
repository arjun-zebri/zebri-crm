import { describe, expect, it } from 'vitest'
import { BLOCKS_BY_SURFACE, blocksForSurface } from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import type { SurfaceTab } from '@/types/branding-preview'

describe('BLOCKS_BY_SURFACE', () => {
  it('has entries for all four surfaces', () => {
    expect(BLOCKS_BY_SURFACE.proposal).toBeDefined()
    expect(BLOCKS_BY_SURFACE.invoice).toBeDefined()
    expect(BLOCKS_BY_SURFACE.contract).toBeDefined()
    expect(BLOCKS_BY_SURFACE.portal).toBeDefined()
  })

  it('proposal includes the correct addable block types', () => {
    expect(BLOCKS_BY_SURFACE.proposal).toEqual([
      'headerBanner',
      'businessName',
      'tagline',
      'text',
      'divider',
      'spacer',
      'image',
      'footer',
      'action',
    ])
  })

  it('invoice includes all structure, content, and action blocks', () => {
    expect(BLOCKS_BY_SURFACE.invoice).toEqual([
      'headerBanner',
      'businessName',
      'tagline',
      'text',
      'divider',
      'spacer',
      'image',
      'footer',
      'title',
      'lineItems',
      'totals',
      'paymentDetails',
      'action',
    ])
  })

  it('invoice includes lineItems, totals, and paymentDetails', () => {
    expect(BLOCKS_BY_SURFACE.invoice).toContain('lineItems')
    expect(BLOCKS_BY_SURFACE.invoice).toContain('totals')
    expect(BLOCKS_BY_SURFACE.invoice).toContain('paymentDetails')
  })

  it('proposal excludes lineItems, totals, and paymentDetails', () => {
    expect(BLOCKS_BY_SURFACE.proposal).not.toContain('lineItems')
    expect(BLOCKS_BY_SURFACE.proposal).not.toContain('totals')
    expect(BLOCKS_BY_SURFACE.proposal).not.toContain('paymentDetails')
  })

  it('contract includes the correct addable block types', () => {
    expect(BLOCKS_BY_SURFACE.contract).toEqual([
      'headerBanner',
      'businessName',
      'tagline',
      'text',
      'divider',
      'spacer',
      'image',
      'footer',
      'title',
      'action',
    ])
  })

  it('portal includes the correct addable block types', () => {
    expect(BLOCKS_BY_SURFACE.portal).toEqual([
      'headerBanner',
      'businessName',
      'tagline',
      'text',
      'divider',
      'spacer',
      'image',
      'footer',
    ])
  })

  it('portal excludes action block', () => {
    expect(BLOCKS_BY_SURFACE.portal).not.toContain('action')
  })

  it('does not include fixed marker blocks (proposalBody, paymentSchedule, contractBody, couplePortal)', () => {
    const allBlocks = Object.values(BLOCKS_BY_SURFACE).flat()
    expect(allBlocks).not.toContain('proposalBody')
    expect(allBlocks).not.toContain('paymentSchedule')
    expect(allBlocks).not.toContain('contractBody')
    expect(allBlocks).not.toContain('couplePortal')
  })
})

describe('blocksForSurface', () => {
  it('returns the correct blocks for each surface', () => {
    expect(blocksForSurface('proposal')).toEqual(BLOCKS_BY_SURFACE.proposal)
    expect(blocksForSurface('invoice')).toEqual(BLOCKS_BY_SURFACE.invoice)
    expect(blocksForSurface('contract')).toEqual(BLOCKS_BY_SURFACE.contract)
    expect(blocksForSurface('portal')).toEqual(BLOCKS_BY_SURFACE.portal)
  })

  it('returns blocks for a passed surface parameter', () => {
    const surface: SurfaceTab = 'invoice'
    const blocks = blocksForSurface(surface)
    expect(blocks).toContain('lineItems')
    expect(blocks).toContain('totals')
    expect(blocks).toContain('paymentDetails')
  })
})
