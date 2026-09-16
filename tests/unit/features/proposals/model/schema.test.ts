/**
 * The layout validator is the write boundary for templates and proposals
 * (spec §10): unknown nodes, disallowed embed hosts, unsafe links and
 * oversize layouts must never reach the database.
 *
 * @module tests/unit/features/proposals/model/schema
 */
import { describe, expect, it } from 'vitest'

import {
  button, doc, embed, heading, image, MARK_TYPES, paragraph, parseProposalLayout, text, variable,
  type ProposalLayout, type Section,
} from '@/features/proposals'

function contentSection(content = doc(paragraph(text('Hello')))): Section {
  return { id: 's1', kind: 'content', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' }, content }
}
function layout(sections: Section[]): ProposalLayout {
  return { version: 2, sections }
}

describe('parseProposalLayout', () => {
  it('accepts a minimal content layout and returns it typed', () => {
    const result = parseProposalLayout(layout([contentSection()]))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.layout.sections[0]?.kind).toBe('content')
  })

  it('accepts every node the spec lists', () => {
    const rich = doc(
      heading(1, text('Anna & Jake'), variable('couple_name')),
      paragraph(text('Bold', [{ type: 'bold' }]), { type: 'hardBreak' }),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('One'))] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Two'))] }] },
      { type: 'blockquote', content: [paragraph(text('Quote'))] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('H'))] }, { type: 'tableCell', content: [paragraph(text('C'))] }] }] },
      { type: 'horizontalRule' },
      image({ src: 'https://x/a.jpg', alt: 'A', layout: 'full', widthPct: 100 }),
      button({ label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'center' }),
      embed('https://vimeo.com/123'),
      { type: 'audio', attrs: { src: 'https://x/a.mp3', title: 'Demo', durationSec: 12 } },
      { type: 'columns', attrs: { count: 2 }, content: [
        { type: 'column', attrs: { ratio: 0.5 }, content: [paragraph(text('L'))] },
        { type: 'column', attrs: { ratio: 0.5 }, content: [paragraph(text('R'))] },
      ] },
      { type: 'spacer', attrs: { heightPx: 32 } },
    )
    const result = parseProposalLayout(layout([contentSection(rich)]))
    expect(result).toEqual(expect.objectContaining({ ok: true }))
  })

  it('accepts every mark the spec lists', () => {
    // A spec addition to MARK_TYPES that isn't also handled in
    // markSchema/tested here must surface as a failure, not a silent gap.
    expect(MARK_TYPES.length).toBe(8)
    const marked = paragraph(
      text('bold', [{ type: 'bold' }]),
      text('italic', [{ type: 'italic' }]),
      text('underline', [{ type: 'underline' }]),
      text('strike', [{ type: 'strike' }]),
      text('link', [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }]),
      text('textStyle', [{ type: 'textStyle', attrs: { color: '#112233' } }]),
      text('highlight', [{ type: 'highlight' }]),
      text('textCase', [{ type: 'textCase', attrs: { value: 'uppercase' } }]),
    )
    const result = parseProposalLayout(layout([contentSection(doc(marked))]))
    expect(result.ok).toBe(true)
  })

  it('rejects an unknown node type', () => {
    const result = parseProposalLayout(layout([contentSection(doc({ type: 'iframe', attrs: { src: 'https://x' } }))]))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join('\n')).toMatch(/iframe/)
  })

  it('rejects an embed whose host is not allowlisted', () => {
    const result = parseProposalLayout(layout([contentSection(doc(embed('https://evil.example/watch?v=1')))]))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join('\n')).toMatch(/embed/i)
  })

  it('rejects javascript: links and button hrefs', () => {
    const bad = doc(paragraph(text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])))
    expect(parseProposalLayout(layout([contentSection(bad)])).ok).toBe(false)
    const badButton = doc(button({ label: 'Go', action: { kind: 'link', href: 'javascript:alert(1)' }, variant: 'fill', size: 'md', align: 'left' }))
    expect(parseProposalLayout(layout([contentSection(badButton)])).ok).toBe(false)
  })

  it('rejects an image with an unsafe src', () => {
    const bad = doc(image({ src: 'javascript:alert(1)', layout: 'full', widthPct: 100 }))
    expect(parseProposalLayout(layout([contentSection(bad)])).ok).toBe(false)
  })

  it('rejects more than 40 sections and more than 200 nodes in one doc', () => {
    const many = Array.from({ length: 41 }, (_, i) => ({ ...contentSection(), id: `s${i}` }))
    expect(parseProposalLayout(layout(many)).ok).toBe(false)
    const big = doc(...Array.from({ length: 201 }, () => paragraph(text('x'))))
    expect(parseProposalLayout(layout([contentSection(big)])).ok).toBe(false)
  })

  it('requires content on content sections and data on data sections', () => {
    expect(parseProposalLayout(layout([{ ...contentSection(), content: undefined }])).ok).toBe(false)
    const accept: Section = { id: 'a', kind: 'accept', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' } }
    expect(parseProposalLayout(layout([accept])).ok).toBe(false)
  })

  it('rejects a version other than 2', () => {
    expect(parseProposalLayout({ version: 1, sections: [] }).ok).toBe(false)
  })

  it('rejects duplicate section ids', () => {
    const dup = layout([contentSection(), { ...contentSection(), style: { height: 'fit', contentWidth: 'narrow', padding: 'compact' } }])
    const result = parseProposalLayout(dup)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.includes('unique'))).toBe(true)
  })
})
