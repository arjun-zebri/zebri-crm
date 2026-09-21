// tests/unit/features/proposals/render/data-section-align.test.tsx
/**
 * A data section's `style.align` (the Style popover's Alignment pill)
 * reaches the text a data section renders. The column carries it
 * (`section-style.ts`); item text in the v1 blocks (an FAQ question/
 * answer, a testimonial's quote/names/detail) inherits it instead of
 * pinning the role default `left` (`inheritAlign`), which is what the
 * editor's inline fields for the same text already did. Live bug
 * 2026-09-19: the pill highlighted, nothing moved, on every data kind.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataSectionView, newSectionFor, type Section, type SectionStyle } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

/** A fresh section of `kind` with `align` set on its style, plus an optional data patch. */
function aligned(kind: Section['kind'], align: SectionStyle['align'], patch: Record<string, unknown> = {}): Section {
  const section = newSectionFor(kind)
  const data = section.data as unknown as { kind: string } & Record<string, Record<string, unknown>>
  const style: SectionStyle = align ? { ...section.style, align } : section.style
  return {
    ...section,
    style,
    data: { ...data, [data.kind]: { ...data[data.kind], ...patch } } as unknown as NonNullable<Section['data']>,
  }
}

function renderSection(section: Section) {
  return render(
    <DataSectionView section={section} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" proposal={undefined} values={{}} />,
  )
}

describe('DataSectionView item text follows the section alignment', () => {
  it('faq: question and answer text inherit the column alignment; the question fills its row so there is room to align in', () => {
    const { container } = renderSection(aligned('faq', 'right'))
    const question = container.querySelector('h3 button') as HTMLElement
    expect(question.style.textAlign).toBe('inherit')
    // UA buttons centre their text and the old `text-left` pinned it; the
    // inline `inherit` now decides.
    expect(question.className).not.toContain('text-left')
    expect(question.querySelector('span')?.className).toContain('flex-1')
    const answer = container.querySelector('[id^="faq-panel-"] .pb-4') as HTMLElement
    expect(answer.style.textAlign).toBe('inherit')
  })

  it('testimonials: quote, names and detail inherit the column alignment', () => {
    const section = aligned('testimonials', 'center', {
      items: [{ id: 't1', quote: 'Best MC ever', names: 'Sam & Alex', detail: 'Married 2026' }],
    })
    const { getByText } = renderSection(section)
    expect((getByText('Best MC ever').closest('[style]') as HTMLElement).style.textAlign).toBe('inherit')
    expect((getByText('Sam & Alex').closest('p') as HTMLElement).style.textAlign).toBe('inherit')
    expect((getByText('Married 2026').closest('p') as HTMLElement).style.textAlign).toBe('inherit')
  })

  it('with no section alignment nothing is pinned either way (the column is `start`, item text inherits it)', () => {
    const { container } = renderSection(aligned('faq', undefined))
    expect((container.querySelector('h3 button') as HTMLElement).style.textAlign).toBe('inherit')
  })
})
