// tests/unit/features/proposals/editor/editable-data-section.test.tsx
/**
 * Slice E1 deliverable 4: the data-section editors (UX audit 3.4,
 * "everything in every block can be clicked and edited"). Two layers:
 *
 * - The `edit-*.tsx` slot builders (`faqSlots`, `testimonialsSlots`,
 *   `acceptSlots`, `packagesSlots`) are plain functions returning plain
 *   React elements - calling them directly and reading a field's own
 *   `onChange`/`onClick` prop is a fast, precise way to prove the
 *   `commit: false` (streamed text) vs `commit: true` (structural: add,
 *   remove, the accept button's label/colour) wiring the spec calls for,
 *   with no dependency on jsdom's limited contenteditable typing support
 *   (the same limitation `inline-field.test.tsx` works around with
 *   `onReady`).
 * - `EditableDataSection` itself is rendered for real (through
 *   `SectionView`), to prove the whole thing reads right on the canvas:
 *   the right fields exist with the right placeholders/labels, the "Add
 *   ..." button appears after the list and hides at the FAQ cap, and a
 *   remove button actually removes on click.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import type { JSONContent } from '@tiptap/core'
import { describe, expect, it, vi } from 'vitest'

import {
  acceptSlots, AddFaqItem, AddTestimonialItem, doc, EditableDataSection, faqSlots, InlineField,
  newSectionFor, packagesSlots, paragraph, testimonialsSlots, text, type AcceptData, type FaqData,
  type LayoutAction, type PackagesData, type Section, type TestimonialsData, defaultTheme,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const theme = defaultTheme(branding)

/**
 * Depth-first search over an un-rendered element tree for the first
 * `InlineField` whose `placeholder` matches - a plain-object walk (no
 * DOM, no TipTap), so a slot builder's `onChange` wiring can be asserted
 * directly, even when the field is nested a few layers deep (the
 * testimonials card).
 */
function findInlineField(node: React.ReactNode, placeholder: string): React.ReactElement<{ onChange: (json: JSONContent) => void }> | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findInlineField(child, placeholder)
      if (found) return found
    }
    return null
  }
  const el = node as React.ReactElement<{ children?: React.ReactNode; placeholder?: string }>
  if (el.type === InlineField && el.props.placeholder === placeholder) return el as React.ReactElement<{ onChange: (json: JSONContent) => void }>
  return findInlineField(el.props?.children ?? null, placeholder)
}

/** A `data.faq`/`.testimonials`/`.accept`/`.packages` slice pulled off a fresh default section of that kind. */
function faqData(): FaqData {
  return (newSectionFor('faq').data as Extract<Section['data'], { kind: 'faq' }>).faq
}
function testimonialsData(): TestimonialsData {
  const data = (newSectionFor('testimonials').data as Extract<Section['data'], { kind: 'testimonials' }>).testimonials
  return { ...data, items: [{ id: 't-1', quote: doc(paragraph(text('Lovely'))), names: 'A & B' }] }
}
function acceptData(): AcceptData {
  return (newSectionFor('accept').data as Extract<Section['data'], { kind: 'accept' }>).accept
}
function packagesData(): PackagesData {
  return (newSectionFor('packages').data as Extract<Section['data'], { kind: 'packages' }>).packages
}

describe('faqSlots', () => {
  it('has no heading slot: only the per-item editor (2026-09-19: no text above or below the main content)', () => {
    const slots = faqSlots({ sectionId: 's1', data: faqData(), dispatch: vi.fn(), externalVersion: 0, onFocus: vi.fn(), theme, swatches: [] })
    expect(Object.keys(slots)).toEqual(['item'])
  })

  it('streams a question edit with commit: false, patching only that item', () => {
    const dispatch = vi.fn()
    const data = faqData()
    const slots = faqSlots({ sectionId: 's1', data, dispatch, externalVersion: 0, onFocus: vi.fn(), theme, swatches: [] })
    const first = data.items[0]!
    const nextQuestion: JSONContent = doc(paragraph(text('New question')))
    findInlineField(slots.item!(first, 0), 'Question')!.props.onChange(nextQuestion)
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'faq', faq: { ...data, items: data.items.map((it, i) => (i === 0 ? { ...it, question: nextQuestion } : it)) } } },
      { commit: false },
    )
  })

  it('removing an item commits, dropping only that item', () => {
    const dispatch = vi.fn()
    const data = faqData()
    const first = data.items[0]!
    render(<div>{faqSlots({ sectionId: 's1', data, dispatch, externalVersion: 0, onFocus: vi.fn(), theme, swatches: [] }).item!(first, 0)}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'faq', faq: { ...data, items: data.items.filter((i) => i.id !== first.id) } } },
      { commit: true },
    )
  })
})

describe('AddFaqItem', () => {
  it('appends a blank item and commits', () => {
    const dispatch = vi.fn()
    const data = faqData()
    render(<AddFaqItem sectionId="s1" data={data} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    const [action, opts] = dispatch.mock.calls[0]!
    expect(opts).toEqual({ commit: true })
    expect(action.type).toBe('setData')
    expect(action.data.faq.items).toHaveLength(data.items.length + 1)
    const added = action.data.faq.items.at(-1)
    expect(added).toMatchObject({ question: '', answer: '' })
  })

  it('moves focus into the new question once it is painted', () => {
    // Live check: typing straight after "Add question" went nowhere because
    // the caret stayed on the button. The item is looked up by the id the
    // add handler minted, inside its section, after the next frame.
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 1 })
    const dispatch = vi.fn()
    const data = faqData()
    const host = document.createElement('div')
    host.setAttribute('data-canvas-section-id', 's1')
    document.body.appendChild(host)
    const { unmount } = render(<AddFaqItem sectionId="s1" data={data} dispatch={dispatch} />)
    // Simulate the section re-rendering with the new item before the frame fires.
    dispatch.mockImplementation((action) => {
      const id = action.data.faq.items.at(-1).id
      host.innerHTML = `<div data-item-id="${id}"><div class="ProseMirror" contenteditable="true" tabindex="0"></div></div>`
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    expect(document.activeElement).toBe(host.querySelector('.ProseMirror'))
    raf.mockRestore(); unmount(); host.remove()
  })

  it('hides once the item count reaches the 12-question cap', () => {
    const atCap: FaqData = {
      ...faqData(),
      items: Array.from({ length: 12 }, (_, i) => ({ id: `fi-${i}`, question: '', answer: '' })),
    }
    const { container } = render(<AddFaqItem sectionId="s1" data={atCap} dispatch={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('testimonialsSlots', () => {
  it('streams a quote edit with commit: false, patching only that item', () => {
    const dispatch = vi.fn()
    const data = testimonialsData()
    const item = data.items[0]!
    const slots = testimonialsSlots({ sectionId: 's1', data, dispatch, externalVersion: 0, onFocus: vi.fn(), branding, theme, swatches: [] })
    const quoteField = findInlineField(slots.item!(item, 0), 'Add a quote')
    expect(quoteField).not.toBeNull()
    const nextQuote: JSONContent = doc(paragraph(text('Amazing!')))
    quoteField!.props.onChange(nextQuote)
    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'setData',
        id: 's1',
        data: { kind: 'testimonials', testimonials: { ...data, items: [{ ...item, quote: nextQuote }] } },
      },
      { commit: false },
    )
  })

  it('every card field mounts the formatting bar, so highlighting text offers bold/italic like a package card', () => {
    const data = testimonialsData()
    const item = data.items[0]!
    const slots = testimonialsSlots({ sectionId: 's1', data, dispatch: vi.fn(), externalVersion: 0, onFocus: vi.fn(), branding, theme, swatches: [] })
    const card = slots.item!(item, 0)
    for (const placeholder of ['Add a quote', 'Names', 'Role or wedding, optional']) {
      const field = findInlineField(card, placeholder) as React.ReactElement<{ richTextBar?: unknown }> | null
      expect(field, placeholder).not.toBeNull()
      expect(field!.props.richTextBar, placeholder).toBeDefined()
    }
  })

  it('removing an item commits, dropping only that item', () => {
    const dispatch = vi.fn()
    const data = testimonialsData()
    const item = data.items[0]!
    render(<div>{testimonialsSlots({ sectionId: 's1', data, dispatch, externalVersion: 0, onFocus: vi.fn(), branding, theme, swatches: [] }).item!(item, 0)}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove testimonial 1' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'testimonials', testimonials: { ...data, items: [] } } },
      { commit: true },
    )
  })
})

describe('AddTestimonialItem', () => {
  it('appends a blank item and commits, with no cap', () => {
    const dispatch = vi.fn()
    const data = testimonialsData()
    render(<AddTestimonialItem sectionId="s1" data={data} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add testimonial' }))
    const [action, opts] = dispatch.mock.calls[0]!
    expect(opts).toEqual({ commit: true })
    expect(action.data.testimonials.items).toHaveLength(data.items.length + 1)
  })
})

describe('acceptSlots', () => {
  it('has no heading or reassurance slot: only the button (2026-09-19: no text above or below the main content)', () => {
    const slots = acceptSlots({ sectionId: 's1', data: acceptData(), dispatch: vi.fn(), externalVersion: 0, onFocus: vi.fn(), branding, swatches: [] })
    expect(Object.keys(slots)).toEqual(['button'])
  })

  it('the button label/colour edits commit, and opening the popover selects the section', () => {
    const dispatch = vi.fn()
    const onFocus = vi.fn()
    const data = acceptData()
    const slots = acceptSlots({ sectionId: 's1', data, dispatch, externalVersion: 0, onFocus, branding, swatches: [] })
    render(<div>{slots.button}</div>)
    fireEvent.click(screen.getByRole('button', { name: data.buttonLabel }))
    expect(onFocus).toHaveBeenCalledTimes(1)
    const label = screen.getByLabelText('Button label')
    // Typing is buffered locally (one undo step per label, not per
    // keystroke, the same as the packages CTA label); blur commits.
    fireEvent.change(label, { target: { value: 'Sign' } })
    fireEvent.change(label, { target: { value: 'Sign now' } })
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.blur(label)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'accept', accept: { ...data, buttonLabel: 'Sign now' } } },
      { commit: true },
    )
  })

  it('the button never fires the real accept action', () => {
    const data = acceptData()
    const slots = acceptSlots({ sectionId: 's1', data, dispatch: vi.fn(), externalVersion: 0, onFocus: vi.fn(), branding, swatches: [] })
    render(<div>{slots.button}</div>)
    const button = screen.getByRole('button', { name: data.buttonLabel })
    expect(button).toHaveAttribute('type', 'button')
  })
})

describe('packagesSlots', () => {
  it('exposes per-card slots and the add tile - no heading or text-below field (2026-09-19 feedback)', () => {
    const slots = packagesSlots({ sectionId: 's1', data: packagesData(), dispatch: vi.fn(), externalVersion: 0, onFocus: vi.fn(), branding, theme, swatches: [] })
    expect(Object.keys(slots)).toEqual(['card', 'trailing'])
  })
})

describe('EditableDataSection', () => {
  const dispatchAction = (dispatch: ReturnType<typeof vi.fn>) => dispatch.mock.calls.at(-1)?.[0] as LayoutAction | undefined

  it('renders the FAQ question/answer fields and an Add question control after the list, and no heading field', () => {
    const dispatch = vi.fn()
    const section = newSectionFor('faq')
    render(
      <EditableDataSection
        section={section}
        index={0}
        branding={branding}
        theme={theme}
        doc={SAMPLE_PROPOSAL_DOC}
        values={{}}
        dispatch={dispatch}
        externalVersion={0}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Remove question/ })).toHaveLength(
      (section.data as Extract<Section['data'], { kind: 'faq' }>).faq.items.length,
    )
    expect(screen.queryByRole('textbox', { name: 'Heading' })).not.toBeInTheDocument()
    expect(document.querySelector('h2')).toBeNull()
  })

  it('clicking a FAQ field selects the section (onFocus -> dispatch select)', () => {
    const dispatch = vi.fn()
    const section = newSectionFor('faq')
    render(
      <EditableDataSection
        section={section}
        index={0}
        branding={branding}
        theme={theme}
        doc={SAMPLE_PROPOSAL_DOC}
        values={{}}
        dispatch={dispatch}
        externalVersion={0}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    expect(dispatchAction(dispatch)?.type).toBe('setData')
  })

  it('renders every package card editable, an Edit package menu per card and an Add package tile; section settings live on the toolbar, not here', () => {
    const dispatch = vi.fn()
    const section = newSectionFor('packages')
    render(
      <EditableDataSection
        section={section}
        index={0}
        branding={branding}
        theme={theme}
        doc={SAMPLE_PROPOSAL_DOC}
        values={{}}
        dispatch={dispatch}
        externalVersion={0}
      />,
    )
    // The three starter packages, each with a title field and its own menu.
    expect(screen.getAllByRole('textbox', { name: 'Package name' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /^Edit package/ })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Add package' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Options' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Packages' })).not.toBeInTheDocument()
  })

  it('renders the gallery Add photos tile; the Layout control lives in the Style popover, not the section (Slice E2)', () => {
    const dispatch = vi.fn()
    const section = newSectionFor('gallery')
    render(
      <EditableDataSection
        section={section}
        index={0}
        branding={branding}
        theme={theme}
        doc={SAMPLE_PROPOSAL_DOC}
        values={{}}
        dispatch={dispatch}
        externalVersion={0}
      />,
    )
    expect(screen.getByRole('button', { name: /Add photos|12 photos max/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Layout' })).not.toBeInTheDocument()
  })

  it('renders the video empty-state media slot alone: no heading or caption field (Slice E2; 2026-09-19 text removal)', () => {
    const dispatch = vi.fn()
    const section = newSectionFor('video')
    render(
      <EditableDataSection
        section={section}
        index={0}
        branding={branding}
        theme={theme}
        doc={SAMPLE_PROPOSAL_DOC}
        values={{}}
        dispatch={dispatch}
        externalVersion={0}
      />,
    )
    expect(screen.getByText('Add a video')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Heading' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Add a description' })).not.toBeInTheDocument()
  })
})
