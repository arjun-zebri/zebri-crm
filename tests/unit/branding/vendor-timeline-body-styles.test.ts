/**
 * Unit tests for run-sheet body typography overrides round-tripping through the
 * block pipeline.
 *
 * Why this matters: the run sheet's title / subtitle / body typography lives as
 * `titleStyle` / `subtitleStyle` / `bodyStyle` / `noteStyle` directly on the
 * `vendorTimelineBody` marker block. That tree passes through `migrateBlocks`
 * and `repairBlocks` on every read of the run-sheet branding. If either step
 * dropped these unknown-to-the-migration fields, an MC's deliberate run-sheet
 * styling would silently vanish. A bare marker (no overrides) must equally stay
 * bare — the feature never fabricates a style, which is what keeps every run
 * sheet sent before this feature existed byte-identical.
 */
import { describe, expect, it } from 'vitest'

import { migrateBlocks } from '@/app/(dashboard)/branding/blocks/defaults'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { repairBlocks } from '@/lib/branding/validate-blocks'

const withStyles: Block[] = [
  { id: 'bn_1', type: 'businessName' },
  {
    id: 'vt_1',
    type: 'vendorTimelineBody',
    locked: true,
    titleStyle: { fontFamily: 'playfair', fontSize: 40, fontWeight: 700, color: '#0f172a' },
    subtitleStyle: { color: '#64748b', letterSpacing: 0.02 },
    bodyStyle: { fontSize: 15, lineHeight: 1.7, textTransform: 'none' },
    noteStyle: { fontSize: 13, color: '#94a3b8', italic: true },
  } as Block,
  { id: 'ft_1', type: 'footer' },
]

describe('vendorTimelineBody typography overrides', () => {
  it('migrateBlocks preserves titleStyle / subtitleStyle / bodyStyle / noteStyle unchanged', () => {
    const result = migrateBlocks(withStyles, 'vendorTimeline')
    expect(result.find((b) => b.type === 'vendorTimelineBody')).toEqual({
      id: 'vt_1',
      type: 'vendorTimelineBody',
      locked: true,
      titleStyle: { fontFamily: 'playfair', fontSize: 40, fontWeight: 700, color: '#0f172a' },
      subtitleStyle: { color: '#64748b', letterSpacing: 0.02 },
      bodyStyle: { fontSize: 15, lineHeight: 1.7, textTransform: 'none' },
      noteStyle: { fontSize: 13, color: '#94a3b8', italic: true },
    })
  })

  it('repairBlocks preserves the four style overrides unchanged', () => {
    const result = repairBlocks('vendorTimeline', withStyles)
    expect(result.find((b) => b.type === 'vendorTimelineBody')).toEqual({
      id: 'vt_1',
      type: 'vendorTimelineBody',
      locked: true,
      titleStyle: { fontFamily: 'playfair', fontSize: 40, fontWeight: 700, color: '#0f172a' },
      subtitleStyle: { color: '#64748b', letterSpacing: 0.02 },
      bodyStyle: { fontSize: 15, lineHeight: 1.7, textTransform: 'none' },
      noteStyle: { fontSize: 13, color: '#94a3b8', italic: true },
    })
  })

  it('a bare marker round-trips unchanged (no overrides ever fabricated)', () => {
    // A run sheet with no typography overrides must stay exactly a bare marker,
    // which is what keeps every already-sent run sheet byte-identical.
    const bare: Block[] = [
      { id: 'bn_1', type: 'businessName' },
      { id: 'vt_1', type: 'vendorTimelineBody', locked: true },
      { id: 'ft_1', type: 'footer' },
    ]
    expect(repairBlocks('vendorTimeline', bare).find((b) => b.type === 'vendorTimelineBody')).toEqual({
      id: 'vt_1',
      type: 'vendorTimelineBody',
      locked: true,
    })
  })

  it('is idempotent — repairing twice yields the same shape and overrides', () => {
    const once = repairBlocks('vendorTimeline', withStyles)
    const twice = repairBlocks('vendorTimeline', once)
    expect(twice).toEqual(once)
  })
})
