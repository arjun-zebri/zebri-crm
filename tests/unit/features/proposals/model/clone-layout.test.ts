/**
 * `cloneLayoutWithFreshIds` backs `duplicateTemplateAction`: a copied
 * template must never share section ids (or a stale internal jump target)
 * with the original.
 *
 * @module tests/unit/features/proposals/model/clone-layout
 */
import { describe, expect, it } from 'vitest'

import {
  button, cloneLayoutWithFreshIds, doc, heading, paragraph, parseProposalLayout, text,
} from '@/features/proposals'
import type { ProposalLayout } from '@/features/proposals'

const LAYOUT: ProposalLayout = {
  version: 2,
  sections: [
    { id: 'sec-a', kind: 'content', name: 'Hero', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' }, content: doc(heading(1, text('Hi'))) },
    {
      id: 'sec-b', kind: 'content', name: 'Close', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' },
      content: doc(paragraph(button({ label: 'Jump up', action: { kind: 'jump', sectionId: 'sec-a' }, variant: 'fill', size: 'md', align: 'left' }))),
    },
  ],
}

describe('cloneLayoutWithFreshIds', () => {
  it('gives every section a fresh id, none matching the original', () => {
    const clone = cloneLayoutWithFreshIds(LAYOUT)
    const originalIds = new Set(LAYOUT.sections.map((s) => s.id))
    for (const section of clone.sections) expect(originalIds.has(section.id)).toBe(false)
  })

  it('two clones of the same layout never share ids with each other', () => {
    const a = cloneLayoutWithFreshIds(LAYOUT)
    const b = cloneLayoutWithFreshIds(LAYOUT)
    expect(a.sections.map((s) => s.id)).not.toEqual(b.sections.map((s) => s.id))
  })

  it('rewrites an internal jump button to follow its target section to its new id', () => {
    const clone = cloneLayoutWithFreshIds(LAYOUT)
    const newHeroId = clone.sections[0]!.id
    const closeContent = clone.sections[1]!.content as { content: { content: { attrs: { action: { sectionId: string } } }[] }[] }
    expect(closeContent.content[0]!.content[0]!.attrs.action.sectionId).toBe(newHeroId)
  })

  it('preserves everything else (names, content text, style)', () => {
    const clone = cloneLayoutWithFreshIds(LAYOUT)
    expect(clone.sections[0]?.name).toBe('Hero')
    expect(clone.sections[0]?.style).toEqual(LAYOUT.sections[0]?.style)
  })

  it('the clone still validates as a proposal layout', () => {
    expect(parseProposalLayout(cloneLayoutWithFreshIds(LAYOUT)).ok).toBe(true)
  })
})
