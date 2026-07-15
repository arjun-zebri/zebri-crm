/**
 * Template data and application — functional document templates.
 *
 * @module tests/unit/app/(dashboard)/branding/templates
 */

import { describe, expect, it } from 'vitest'

import { blocksForSurface } from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import { TEMPLATES, templatesForSurface } from '@/app/(dashboard)/branding/templates'
import type { SurfaceTab } from '@/types/branding-preview'

const FIXED_MARKERS: Record<SurfaceTab, string> = {
  proposal: 'proposalBody',
  invoice: 'paymentSchedule',
  contract: 'contractBody',
  portal: 'couplePortal',
}

describe('TEMPLATES', () => {
  it('exports at least 4 templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4)
  })

  it('each template has required fields', () => {
    for (const tpl of TEMPLATES) {
      expect(tpl.id).toBeTruthy()
      expect(tpl.name).toBeTruthy()
      expect(tpl.description).toBeTruthy()
      expect(['proposal', 'invoice', 'contract', 'portal']).toContain(tpl.surface)
      expect(typeof tpl.build).toBe('function')
    }
  })

  it('every template build() returns valid blocks for its surface', () => {
    for (const tpl of TEMPLATES) {
      const blocks = tpl.build()
      const validTypes = blocksForSurface(tpl.surface)
      const fixedMarker = FIXED_MARKERS[tpl.surface]

      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks.length).toBeGreaterThan(0)

      for (const block of blocks) {
        const isFixedMarker = block.type === fixedMarker
        const isValidType = validTypes.includes(block.type as any)

        expect(isFixedMarker || isValidType, `Template "${tpl.name}" block type "${block.type}" not valid for surface "${tpl.surface}"`).toBe(true)
      }
    }
  })

  it('each template includes its surface fixed marker', () => {
    for (const tpl of TEMPLATES) {
      const blocks = tpl.build()
      const fixedMarker = FIXED_MARKERS[tpl.surface]
      const hasMarker = blocks.some((b) => b.type === fixedMarker)

      expect(hasMarker, `Template "${tpl.name}" for surface "${tpl.surface}" missing fixed marker "${fixedMarker}"`).toBe(true)
    }
  })

  it('build() returns fresh blocks each time (unique ids)', () => {
    const tpl = TEMPLATES[0]
    if (!tpl) return

    const build1 = tpl.build()
    const build2 = tpl.build()

    const ids1 = build1.map((b) => b.id).sort()
    const ids2 = build2.map((b) => b.id).sort()

    expect(ids1).not.toEqual(ids2)
  })

  it('proposals have sensible wording', () => {
    const proposal = TEMPLATES.find((t) => t.surface === 'proposal')
    if (!proposal) return

    const blocks = proposal.build()
    const actionBlock = blocks.find((b) => b.type === 'action')
    expect(actionBlock).toBeTruthy()
  })

  it('invoices have sensible wording', () => {
    const invoice = TEMPLATES.find((t) => t.surface === 'invoice')
    if (!invoice) return

    const blocks = invoice.build()
    const titleBlock = blocks.find((b) => b.type === 'title')
    expect(titleBlock).toBeTruthy()
  })
})

describe('templatesForSurface', () => {
  it('returns templates for the given surface', () => {
    const proposalTemplates = templatesForSurface('proposal')
    expect(proposalTemplates.length).toBeGreaterThan(0)
    expect(proposalTemplates.every((t) => t.surface === 'proposal')).toBe(true)
  })

  it('returns empty for invalid surface', () => {
    const result = templatesForSurface('invalid' as any)
    expect(result).toEqual([])
  })
})
