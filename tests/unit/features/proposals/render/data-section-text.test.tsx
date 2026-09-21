// tests/unit/features/proposals/render/data-section-text.test.tsx
/**
 * A v2 data section renders its data alone: no heading above, no
 * caption / text-below / reassurance under it (2026-09-19: "If we want
 * text, we can just add a text section above or below"). `toV1Block` is
 * the one seam every surface (canvas, public page, print, thumbnails)
 * goes through, so it strips `DATA_TEXT_FIELDS` whatever the stored data
 * says - including a template saved while those fields were still
 * editable, whose JSON still carries "Your options" and friends.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DATA_TEXT_FIELDS, DataSectionView, doc, newSectionFor, paragraph, text, toV1Block, type Section } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const TEXT_KINDS = ['packages', 'faq', 'testimonials', 'video', 'accept'] as const

/** A fresh section of `kind` whose stored data still carries every legacy text field, as a pre-2026-09-19 template would. */
function withLegacyText(kind: Section['kind']): Section {
  const section = newSectionFor(kind)
  const data = section.data as unknown as { kind: string } & Record<string, Record<string, unknown>>
  const legacy = {
    heading: doc(paragraph(text('LEGACY HEADING'))),
    headingStyle: { align: 'right' },
    caption: doc(paragraph(text('LEGACY CAPTION'))),
    captionStyle: { align: 'right' },
    textBelow: doc(paragraph(text('LEGACY TEXT BELOW'))),
    textBelowStyle: { align: 'right' },
    reassurance: doc(paragraph(text('LEGACY REASSURANCE'))),
  }
  return { ...section, data: { ...data, [data.kind]: { ...data[data.kind], ...legacy } } as unknown as NonNullable<Section['data']> }
}

describe('toV1Block strips the block-level text', () => {
  it.each(TEXT_KINDS)('%s: none of DATA_TEXT_FIELDS survive, the rest of the data does', (kind) => {
    const block = toV1Block(withLegacyText(kind)) as unknown as Record<string, unknown>
    for (const key of DATA_TEXT_FIELDS) expect(block, key).not.toHaveProperty(key)
    expect(block.type).toBe(kind)
    expect(typeof block.id).toBe('string')
  })

  it('a fresh section from the palette carries none of the text fields to begin with', () => {
    for (const kind of TEXT_KINDS) {
      const data = (newSectionFor(kind).data as unknown as Record<string, Record<string, unknown>>)[kind]!
      for (const key of DATA_TEXT_FIELDS) expect(data, `${kind}.${key}`).not.toHaveProperty(key)
    }
  })
})

describe('DataSectionView shows no text above or below the data', () => {
  it.each(TEXT_KINDS)('%s: no <h2>, no legacy copy, on the public page', (kind) => {
    const section = withLegacyText(kind)
    // The video default has no source; give it one so the block renders at all.
    if (kind === 'video') {
      const data = section.data as Extract<Section['data'], { kind: 'video' }>
      section.data = { kind: 'video', video: { ...data.video, source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } } }
    }
    const { container } = render(
      <DataSectionView section={section} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" proposal={undefined} values={{}} />,
    )
    expect(container.querySelector('h2')).toBeNull()
    expect(container.textContent).not.toMatch(/LEGACY/)
  })
})

describe('data-section rich text keeps blank lines and fluid sizes (the v1 `Rich` pipeline)', () => {
  it('an FAQ answer with an empty paragraph renders it as a line, and a 46px run as the container clamp', () => {
    const section = newSectionFor('faq')
    const data = section.data as unknown as { kind: 'faq'; faq: { items: unknown[]; collapsible?: boolean } }
    data.faq.collapsible = false
    data.faq.items = [{
      id: 'q1',
      question: doc(paragraph(text('Big?', [{ type: 'textStyle', attrs: { fontSize: '46px' } }]))),
      answer: doc(paragraph(text('Yes.')), paragraph(), paragraph(text('Really.'))),
    }]
    const { container } = render(<DataSectionView section={section} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" proposal={undefined} values={{}} />)
    expect(container.innerHTML).toContain('font-size:clamp(32px, 8.21cqw, 46px)')
    expect(container.innerHTML).toContain('<p><br></p>')
  })
})
