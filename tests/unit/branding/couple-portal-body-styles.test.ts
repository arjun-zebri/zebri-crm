/**
 * Unit tests for couple-portal body typography overrides round-tripping through
 * the block pipeline.
 *
 * Why this matters: the portal's title / subtitle / heading / body typography
 * lives as `titleStyle` / `subtitleStyle` / `headingStyle` / `bodyStyle` directly
 * on the `couplePortal` marker block. That tree passes through `migrateBlocks`
 * and `repairBlocks` on every read of the portal branding. If either step
 * dropped these unknown-to-the-migration fields, an MC's deliberate portal
 * styling would silently vanish. A bare marker (no overrides) must equally stay
 * bare — the feature never fabricates a style, which is what keeps every portal
 * sent before this feature existed byte-identical.
 */
import { describe, expect, it } from 'vitest'

import { migrateBlocks } from '@/app/(dashboard)/branding/blocks/defaults'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { repairBlocks } from '@/lib/branding/validate-blocks'

const withStyles: Block[] = [
  { id: 'bn_1', type: 'businessName' },
  {
    id: 'cp_1',
    type: 'couplePortal',
    locked: true,
    titleStyle: { fontFamily: 'playfair', fontSize: 44, fontWeight: 700, color: '#0f172a' },
    subtitleStyle: { color: '#64748b', letterSpacing: 0.02 },
    headingStyle: { fontSize: 22, lineHeight: 1.3, textTransform: 'none' },
    bodyStyle: { fontSize: 14, color: '#94a3b8', italic: true },
  } as Block,
  { id: 'ft_1', type: 'footer' },
]

describe('couplePortal typography overrides', () => {
  it('migrateBlocks preserves titleStyle / subtitleStyle / headingStyle / bodyStyle unchanged', () => {
    const result = migrateBlocks(withStyles, 'portal')
    expect(result.find((b) => b.type === 'couplePortal')).toEqual({
      id: 'cp_1',
      type: 'couplePortal',
      locked: true,
      titleStyle: { fontFamily: 'playfair', fontSize: 44, fontWeight: 700, color: '#0f172a' },
      subtitleStyle: { color: '#64748b', letterSpacing: 0.02 },
      headingStyle: { fontSize: 22, lineHeight: 1.3, textTransform: 'none' },
      bodyStyle: { fontSize: 14, color: '#94a3b8', italic: true },
    })
  })

  it('repairBlocks preserves the four style overrides unchanged', () => {
    const result = repairBlocks('portal', withStyles)
    expect(result.find((b) => b.type === 'couplePortal')).toEqual({
      id: 'cp_1',
      type: 'couplePortal',
      locked: true,
      titleStyle: { fontFamily: 'playfair', fontSize: 44, fontWeight: 700, color: '#0f172a' },
      subtitleStyle: { color: '#64748b', letterSpacing: 0.02 },
      headingStyle: { fontSize: 22, lineHeight: 1.3, textTransform: 'none' },
      bodyStyle: { fontSize: 14, color: '#94a3b8', italic: true },
    })
  })

  it('a bare marker round-trips unchanged (no overrides ever fabricated)', () => {
    // A portal with no typography overrides must stay exactly a bare marker,
    // which is what keeps every already-sent portal byte-identical.
    const bare: Block[] = [
      { id: 'bn_1', type: 'businessName' },
      { id: 'cp_1', type: 'couplePortal', locked: true },
      { id: 'ft_1', type: 'footer' },
    ]
    expect(repairBlocks('portal', bare).find((b) => b.type === 'couplePortal')).toEqual({
      id: 'cp_1',
      type: 'couplePortal',
      locked: true,
    })
  })

  it('is idempotent — repairing twice yields the same shape and overrides', () => {
    const once = repairBlocks('portal', withStyles)
    const twice = repairBlocks('portal', once)
    expect(twice).toEqual(once)
  })
})
