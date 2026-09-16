/**
 * The v1 → v2 migration is one-way and automatic (spec D13, §7): every
 * saved proposal tree must come out as a valid v2 layout that still says
 * what the MC built. Fixtures are the real role starters plus hand-made
 * edge cases.
 *
 * @module tests/unit/features/proposals/model/migrate-v1
 */
import { describe, expect, it } from 'vitest'

import { blockTemplate, defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import { proposalStarterBlocks } from '@/app/(dashboard)/branding/blocks/proposal-starters'
import type { Block, FooterBlock, HeroBlock, HowItWorksBlock, TextBlock } from '@/app/(dashboard)/branding/blocks/types'
import { isLayoutV2, migrateProposalTreeToLayout, parseProposalLayout } from '@/features/proposals'

function hero(overrides: Partial<HeroBlock> = {}): HeroBlock {
  return { ...(blockTemplate('hero') as HeroBlock), ...overrides }
}

describe('migrateProposalTreeToLayout', () => {
  it('turns every role starter and the neutral default into a valid v2 layout', () => {
    for (const blocks of [defaultBlocksFor('proposal'), proposalStarterBlocks('mc'), proposalStarterBlocks('celebrant'), proposalStarterBlocks('both')]) {
      const layout = migrateProposalTreeToLayout(blocks)
      const parsed = parseProposalLayout(layout)
      expect(parsed, JSON.stringify((parsed as { issues?: string[] }).issues)).toEqual(expect.objectContaining({ ok: true }))
      expect(layout.sections.filter((s) => s.kind === 'accept')).toHaveLength(1)
    }
  })

  it('maps the hero to a full-height content section with white text over media', () => {
    const layout = migrateProposalTreeToLayout([hero({ background: { kind: 'image', url: 'https://x/bg.jpg' }, overlay: 40 })])
    const [s] = layout.sections
    expect(s?.kind).toBe('content')
    expect(s?.style).toMatchObject({ height: 'full', textColor: '#FFFFFF', align: 'center', background: { image: 'https://x/bg.jpg', overlay: 40 } })
    expect(s?.content?.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } })
    expect(s?.content?.content?.[1]).toMatchObject({ type: 'paragraph' })
  })

  it('turns an embed hero cover into an embed node first, with no background media', () => {
    const layout = migrateProposalTreeToLayout([hero({ background: { kind: 'embed', url: 'https://www.youtube.com/watch?v=abc123' } })])
    const s = layout.sections[0]!
    expect(s.style.background).toBeUndefined()
    expect(s.content?.content?.[0]).toMatchObject({ type: 'embed', attrs: { url: 'https://www.youtube.com/watch?v=abc123' } })
    // The heading still follows the embed, same position as any other hero.
    expect(s.content?.content?.[1]).toMatchObject({ type: 'heading' })
  })

  it('applies a per-proposal embed override the same way as a block-level embed background', () => {
    const layout = migrateProposalTreeToLayout([hero()], { heroOverride: { embedUrl: 'https://vimeo.com/123456' } })
    const s = layout.sections[0]!
    expect(s.style.background).toBeUndefined()
    expect(s.content?.content?.[0]).toMatchObject({ type: 'embed', attrs: { url: 'https://vimeo.com/123456' } })
  })

  it('keeps a video hero\'s poster image on the migrated background', () => {
    const layout = migrateProposalTreeToLayout([hero({ background: { kind: 'video', url: 'https://x/cover.mp4', posterUrl: 'https://x/cover-poster.jpg' } })])
    expect(layout.sections[0]?.style.background).toMatchObject({ video: 'https://x/cover.mp4', poster: 'https://x/cover-poster.jpg' })
  })

  it('drops the poster when a per-proposal override replaces the video (the override carries none)', () => {
    const layout = migrateProposalTreeToLayout(
      [hero({ overlay: 0, background: { kind: 'video', url: 'https://x/cover.mp4', posterUrl: 'https://x/cover-poster.jpg' } })],
      { heroOverride: { videoPath: 'https://x/override.mp4' } },
    )
    expect(layout.sections[0]?.style.background).toEqual({ video: 'https://x/override.mp4' })
  })

  it('applies a per-proposal hero override and inlines the intro note', () => {
    const blocks: Block[] = [hero(), blockTemplate('introNote')]
    const layout = migrateProposalTreeToLayout(blocks, {
      heroOverride: { imagePath: 'https://x/override.jpg' },
      introNote: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi Anna & Jake' }] }] },
    })
    expect(layout.sections[0]?.style.background?.image).toBe('https://x/override.jpg')
    const note = layout.sections[1]
    expect(note?.kind).toBe('content')
    expect(JSON.stringify(note?.content)).toContain('Hi Anna & Jake')
  })

  it('respects hidden heading / subheading and a dragged height', () => {
    const layout = migrateProposalTreeToLayout([hero({ showSubheading: false, heightVh: 60 })])
    const s = layout.sections[0]!
    expect(s.style.height).toBe('fit')
    expect(s.content?.content?.map((n) => n.type)).toEqual(['heading'])
  })

  it('clamps a dragged hero height to the schema padding cap', () => {
    const clamped = migrateProposalTreeToLayout([hero({ heightVh: 80 })])
    expect(clamped.sections[0]?.style.height).toBe('fit')
    expect(clamped.sections[0]?.style.padding).toBe(240)

    const unclamped = migrateProposalTreeToLayout([hero({ heightVh: 60 })])
    expect(unclamped.sections[0]?.style.padding).toBe(216)
  })

  it('splits more than 3 how-it-works steps into balanced rows of columns', () => {
    const how = blockTemplate('howItWorks') as HowItWorksBlock
    const steps = ['One', 'Two', 'Three', 'Four'].map((title, i) => ({
      id: `st-${i}`, title, description: `Step ${title} description`, icon: 'check' as const,
    }))
    const layout = migrateProposalTreeToLayout([{ ...how, steps }])
    const content = layout.sections[0]?.content?.content ?? []
    const columnsNodes = content.filter((n) => n.type === 'columns')
    expect(columnsNodes).toHaveLength(2)
    expect(columnsNodes.every((n) => n.content?.length === 2)).toBe(true)
    const json = JSON.stringify(content)
    for (const title of ['One', 'Two', 'Three', 'Four']) expect(json).toContain(title)
  })

  it('never leaves a leading separator when the first footer flag is off', () => {
    // No closingNote, so the section's only content node is the identity
    // paragraph: content[0] must be the first *enabled* group, not a
    // leftover ` · ` from the disabled business-name group.
    const footer: FooterBlock = { id: 'ft', type: 'footer', showBusinessName: false }
    const layout = migrateProposalTreeToLayout([footer])
    const paragraphNode = layout.sections[0]?.content?.content?.[0]
    expect(paragraphNode?.content?.[0]).toMatchObject({ type: 'variable', attrs: { id: 'business_phone' } })
  })

  it('merges consecutive chrome blocks into one content section', () => {
    const t = (id: string, value: string): TextBlock => ({ id, type: 'text', text: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] } })
    const layout = migrateProposalTreeToLayout([t('a', 'One'), { id: 'd', type: 'divider' }, t('b', 'Two'), blockTemplate('packages'), t('c', 'Three')])
    expect(layout.sections.map((s) => s.kind)).toEqual(['content', 'packages', 'content'])
    expect(layout.sections[0]?.content?.content?.map((n) => n.type)).toEqual(['paragraph', 'horizontalRule', 'paragraph'])
  })

  it('skips hidden blocks and drops title / business name / tagline', () => {
    const layout = migrateProposalTreeToLayout([{ ...blockTemplate('packages'), hidden: true }, blockTemplate('title'), blockTemplate('businessName'), blockTemplate('tagline'), blockTemplate('accept')])
    expect(layout.sections.map((s) => s.kind)).toEqual(['accept'])
  })

  it('carries a section background onto the data section', () => {
    const layout = migrateProposalTreeToLayout([{ ...blockTemplate('faq'), sectionBackground: { color: '#112233', overlay: 10 } }])
    expect(layout.sections[0]?.style.background).toEqual({ color: '#112233', overlay: 10 })
  })

  it('isLayoutV2 recognises a v2 layout and nothing else', () => {
    expect(isLayoutV2({ version: 2, sections: [] })).toBe(true)
    expect(isLayoutV2(defaultBlocksFor('proposal'))).toBe(false)
    expect(isLayoutV2(null)).toBe(false)
  })
})
