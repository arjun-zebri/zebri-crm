// tests/unit/features/proposals/editor/data-section-slots.test.tsx
/**
 * Slice E1 deliverable 2: `slots` threaded through `SectionView` ->
 * `DataSectionView` -> each v1 public component. A pure plumbing change -
 * `slots` is `undefined` on every existing (public-page/print) call site,
 * so this only asserts that when it *is* passed, the right node lands in
 * the v1 component for each kind, and that the public page's own
 * un-slotted call is unaffected. The slots used here are the ones the
 * builder really supplies: no data kind has a heading/caption/text-below
 * slot any more (2026-09-19: no text above or below the main content).
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  DataSectionView, newSectionFor, SectionView, type DataSectionSlots, type Section, defaultTheme,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const theme = defaultTheme(branding)

/** Renders `DataSectionView` for a fresh section of `kind`, with `slots` passed straight through. */
function renderKind(kind: Section['kind'], slots: DataSectionSlots) {
  const section = newSectionFor(kind)
  render(
    <DataSectionView section={section} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="edit" proposal={undefined} values={{}} slots={slots} />,
  )
}

describe('DataSectionView slots', () => {
  it('renders the faq item slot in place of each default question', () => {
    renderKind('faq', { faq: { item: (item) => <span key={item.id}>FAQ SLOT ITEM</span> } })
    expect(screen.getAllByText('FAQ SLOT ITEM').length).toBeGreaterThan(0)
  })

  it('renders the testimonials item slot even with zero items', () => {
    // `RenderTestimonials` renders nothing for a zero-item block unless a
    // slot is present at all (`slots?.item`), which the editor always
    // supplies since it must show "Add testimonial" even with none yet.
    const section = { ...newSectionFor('testimonials') }
    const data = section.data as Extract<Section['data'], { kind: 'testimonials' }>
    section.data = { kind: 'testimonials', testimonials: { ...data.testimonials, items: [] } }
    const { container } = render(
      <DataSectionView section={section} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="edit" proposal={undefined} values={{}} slots={{ testimonials: { item: () => null } }} />,
    )
    expect(container.firstElementChild).not.toBeNull()
  })

  it('renders the accept slot button in place of the default button', () => {
    renderKind('accept', { accept: { button: <span>ACCEPT SLOT BUTTON</span> } })
    expect(screen.getByText('ACCEPT SLOT BUTTON')).toBeInTheDocument()
  })

  it('renders the packages slot trailing node after the cards', () => {
    renderKind('packages', { packages: { trailing: <span>PACKAGES SLOT TRAILING</span> } })
    expect(screen.getByText('PACKAGES SLOT TRAILING')).toBeInTheDocument()
  })

  it('renders the gallery slot trailing node even with zero images (Slice E2)', () => {
    renderKind('gallery', { gallery: { trailing: <span>GALLERY SLOT TRAILING</span> } })
    expect(screen.getByText('GALLERY SLOT TRAILING')).toBeInTheDocument()
  })

  it('renders the video slot media node in place of the default player (Slice E2)', () => {
    renderKind('video', { video: { media: <span>VIDEO SLOT MEDIA</span> } })
    expect(screen.getByText('VIDEO SLOT MEDIA')).toBeInTheDocument()
  })

  it('SectionView threads slots through to DataSectionView and renders `after` in the content column', () => {
    const section = newSectionFor('faq')
    render(
      <SectionView
        section={section}
        index={0}
        branding={branding}
        theme={theme}
        doc={SAMPLE_PROPOSAL_DOC}
        mode="edit"
        values={{}}
        slots={{ faq: { item: (item) => <span key={item.id}>VIA SECTIONVIEW</span> }, after: <button type="button">Add question</button> }}
      />,
    )
    expect(screen.getAllByText('VIA SECTIONVIEW').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument()
  })

  it('the public page never passes slots and renders the default markup: questions, and no heading', () => {
    const section = newSectionFor('faq')
    render(<DataSectionView section={section} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" proposal={undefined} values={{}} />)
    // The fresh faq default section has at least one sample item; its
    // question renders as a real `RenderFaq` toggle, proving the unslotted
    // branch still runs the default markup. No `<h2>`: a data section has
    // no heading of its own.
    expect(document.querySelectorAll('h3').length).toBeGreaterThan(0)
    expect(document.querySelector('h2')).toBeNull()
  })
})
