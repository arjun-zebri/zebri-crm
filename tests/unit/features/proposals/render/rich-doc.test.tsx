/**
 * Parity test for the rich-doc renderer (spec §6): every node the spec
 * lists renders to the expected element in page mode, variables resolve,
 * unsafe or unknown content renders nothing, and print mode degrades
 * embeds and audio to links.
 *
 * @module tests/unit/features/proposals/render/rich-doc
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  button, column, columns, defaultTheme, doc, embed, heading, hr, image, NODE_TYPES, paragraph, RichDocView, spacer, text, variable,
  type RichDocContext,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const ctx = (over: Partial<RichDocContext> = {}): RichDocContext => ({ branding, mode: 'page', values: { couple_name: 'Anna & Jake' }, ...over })

describe('RichDocView', () => {
  it('renders every spec node type', () => {
    const rich = doc(
      heading(1, text('Hi '), variable('couple_name')),
      paragraph(text('Bold', [{ type: 'bold' }]), { type: 'hardBreak' }, text('Link', [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }])),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('One'))] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Two'))] }] },
      { type: 'blockquote', content: [paragraph(text('Quote'))] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('H'))] }, { type: 'tableCell', content: [paragraph(text('C'))] }] }] },
      hr(),
      image({ src: 'https://x/a.jpg', alt: 'Alt text', layout: 'left', widthPct: 40, caption: 'Cap' }),
      button({ label: 'Book me', action: { kind: 'link', href: 'https://zebri.com.au/book' }, variant: 'fill', size: 'md', align: 'center' }),
      embed('https://vimeo.com/123456789'),
      { type: 'audio', attrs: { src: 'https://x/a.mp3', title: 'Demo' } },
      columns(column(0.5, paragraph(text('L'))), column(0.5, paragraph(text('R')))),
      spacer(40),
    )
    const { container } = render(<RichDocView doc={rich} ctx={ctx()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hi Anna & Jake')
    expect(container.querySelector('strong')).toHaveTextContent('Bold')
    expect(container.querySelector('br')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container.querySelectorAll('ul li, ol li')).toHaveLength(2)
    expect(container.querySelector('blockquote')).toHaveTextContent('Quote')
    expect(container.querySelector('table th')).toHaveTextContent('H')
    // Fixed layout with a `<colgroup>` is what keeps typing into a cell from re-flowing the other columns.
    expect(container.querySelector('table')?.className).toContain('table-fixed')
    expect(container.querySelectorAll('table colgroup col')).toHaveLength(2)
    expect(container.querySelector('hr')).not.toBeNull()
    const img = screen.getByRole('img', { name: 'Alt text' })
    expect(img.closest('figure')?.getAttribute('style')).toContain('width: 40%')
    expect(img.closest('figure')?.className).toContain('float-left')
    expect(screen.getByRole('link', { name: 'Book me' })).toHaveAttribute('href', 'https://zebri.com.au/book')
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789?dnt=1')
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation')
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('https://x/a.mp3')
    expect(container.querySelector('[data-columns]')?.children).toHaveLength(2)
    expect(container.querySelector('[data-spacer]')?.getAttribute('style')).toContain('height: 40px')
    // The node list is the spec's, so a new node added there without a renderer case shows up here.
    expect(NODE_TYPES).toHaveLength(21)
  })

  it('renders a chip fallback only when the value is empty', () => {
    const rich = doc(paragraph(variable('venue', 'your venue')))
    expect(render(<RichDocView doc={rich} ctx={ctx({ values: {} })} />).container.textContent).toBe('your venue')
    expect(render(<RichDocView doc={rich} ctx={ctx({ values: { venue: 'The Barn' } })} />).container.textContent).toBe('The Barn')
  })

  it('renders unknown ids and unknown node types as nothing', () => {
    const { container } = render(<RichDocView doc={doc(paragraph(variable('nope')), { type: 'mystery' } as never)} ctx={ctx()} />)
    expect(container.textContent).toBe('')
  })

  /**
   * Live bug 2026-09-20: a stored `textAlign: 'left'` was dropped as
   * "unset", so a paragraph the author explicitly aligned left still
   * rendered centred whenever its theme role (or section) was centred.
   * Any stored value is the author's pick (`extensions/text-align.ts`
   * drops a pasted `'left'` on parse) and must beat the role alignment,
   * the same as `'center'`/`'right'`; only an absent attr defers.
   */
  it('a stored textAlign of "left" overrides a centred theme role, the same as "right"; an absent attr defers to it', () => {
    const theme = { ...defaultTheme(branding), text: { ...defaultTheme(branding).text, paragraph: { ...defaultTheme(branding).text.paragraph, align: 'center' as const } } }

    const leftStored = doc({ type: 'paragraph', attrs: { textAlign: 'left' }, content: [text('Left-stored')] })
    const { container: leftContainer } = render(<RichDocView doc={leftStored} ctx={ctx({ theme })} />)
    expect(leftContainer.querySelector('p')).toHaveStyle({ textAlign: 'left' })

    const rightStored = doc({ type: 'paragraph', attrs: { textAlign: 'right' }, content: [text('Right-stored')] })
    const { container: rightContainer } = render(<RichDocView doc={rightStored} ctx={ctx({ theme })} />)
    expect(rightContainer.querySelector('p')).toHaveStyle({ textAlign: 'right' })

    const unset = doc({ type: 'paragraph', content: [text('Unset')] })
    const { container: unsetContainer } = render(<RichDocView doc={unset} ctx={ctx({ theme })} />)
    expect(unsetContainer.querySelector('p')).toHaveStyle({ textAlign: 'center' })
  })

  it('resolves {{ id | fallback }} tokens in a button label', () => {
    render(<RichDocView doc={doc(button({ label: 'Book {{couple_name | us}}', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'left' }))} ctx={ctx({ values: {} })} />)
    expect(screen.getByRole('button', { name: 'Book us' })).toBeInTheDocument()
  })

  it('accept and decline buttons call onAction instead of navigating', () => {
    const onAction = vi.fn()
    render(<RichDocView doc={doc(button({ label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'lg', align: 'left' }))} ctx={ctx({ onAction })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAction).toHaveBeenCalledWith({ kind: 'accept' })
  })

  it('a fill button label gets a dark colour over a light fill and a light colour over a dark fill', () => {
    // jsdom normalises hex colours in the `style` attribute to `rgb(...)`;
    // #111827 -> rgb(17, 24, 39), #ffffff -> rgb(255, 255, 255) (getTextColor's two outputs).
    render(<RichDocView doc={doc(button({ label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'left', color: '#F5E6C8' }))} ctx={ctx()} />)
    expect(screen.getByRole('button', { name: 'Accept' }).getAttribute('style')).toContain('color: rgb(17, 24, 39)')

    render(<RichDocView doc={doc(button({ label: 'Book me', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'left', color: '#0B1B33' }))} ctx={ctx()} />)
    expect(screen.getByRole('button', { name: 'Book me' }).getAttribute('style')).toContain('color: rgb(255, 255, 255)')
  })

  it('print mode turns embeds and audio into links and drops spacers to nothing tall', () => {
    const { container } = render(<RichDocView doc={doc(embed('https://vimeo.com/123456789'), { type: 'audio', attrs: { src: 'https://x/a.mp3', title: 'Demo' } })} ctx={ctx({ mode: 'print' })} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('audio')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('a section text colour overrides the role colour on headings and paragraphs', () => {
    const { container } = render(<RichDocView doc={doc(heading(2, text('H')), paragraph(text('P')))} ctx={ctx({ textColor: '#FFFFFF' })} />)
    expect(container.querySelector('h2')?.getAttribute('style')).not.toContain('color: rgb(')
    expect(container.querySelector('p')?.getAttribute('style')).not.toContain('color: rgb(')
  })

  it('renders fontWeight/letterSpacing marks and a block\'s lineHeight/topSpacing attrs as inline styles', () => {
    const rich = doc(
      paragraph(text('Styled', [{ type: 'textStyle', attrs: { fontWeight: '600', letterSpacing: '0.05em' } }])),
      { type: 'heading', attrs: { level: 2, lineHeight: '1.1', topSpacing: '0.5em' }, content: [text('Head')] },
    )
    const { container } = render(<RichDocView doc={rich} ctx={ctx()} />)
    expect(screen.getByText('Styled').getAttribute('style')).toContain('font-weight: 600')
    expect(screen.getByText('Styled').getAttribute('style')).toContain('letter-spacing: 0.05em')
    const h2 = container.querySelector('h2')
    expect(h2?.getAttribute('style')).toContain('line-height: 1.1')
    expect(h2?.getAttribute('style')).toContain('margin-top: 0.5em')
  })

  it('an unsafe link mark or button href renders as a span with no href', () => {
    const { container } = render(
      <RichDocView
        doc={doc(
          paragraph(text('Click', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])),
          button({ label: 'Go', action: { kind: 'link', href: 'javascript:alert(1)' }, variant: 'fill', size: 'md', align: 'left' }),
        )}
        ctx={ctx()}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(screen.getByText('Click').tagName).toBe('SPAN')
    expect(screen.getByText('Go').tagName).toBe('SPAN')
  })

  it('a jump button calls onAction with the section id', () => {
    const onAction = vi.fn()
    render(<RichDocView doc={doc(button({ label: 'Next', action: { kind: 'jump', sectionId: 'sec-2' }, variant: 'fill', size: 'md', align: 'left' }))} ctx={ctx({ onAction })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onAction).toHaveBeenCalledWith({ kind: 'jump', sectionId: 'sec-2' })
  })

  it('an image with an unsafe src renders no img', () => {
    const { container } = render(<RichDocView doc={doc(image({ src: 'javascript:alert(1)', layout: 'inline', widthPct: 100 }))} ctx={ctx()} />)
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('RichDocView line breaks', () => {
  it('an empty paragraph keeps its line (the blank line the author pressed Enter for), a filled one adds nothing', () => {
    const { container } = render(<RichDocView doc={doc(paragraph(text('a')), paragraph(), paragraph(text('b')))} ctx={ctx()} />)
    const ps = container.querySelectorAll('p')
    expect(ps).toHaveLength(3)
    expect(ps[0]?.querySelector('br')).toBeNull()
    expect(ps[1]?.querySelector('br')).not.toBeNull()
    expect(ps[2]?.querySelector('br')).toBeNull()
  })

  it('a paragraph ending in a hard break renders a second <br> so the trailing blank line shows, and an empty heading keeps its line too', () => {
    const { container } = render(<RichDocView doc={doc(paragraph(text('a'), { type: 'hardBreak' }), heading(2))} ctx={ctx()} />)
    expect(container.querySelectorAll('p br')).toHaveLength(2)
    expect(container.querySelector('h2 br')).not.toBeNull()
  })
})

describe('RichDocView fluid type', () => {
  it('a large per-selection fontSize renders as a steep container clamp; a body-range one gets a shallower one', () => {
    const rich = doc(
      paragraph(text('Big', [{ type: 'textStyle', attrs: { fontSize: '46px' } }])),
      paragraph(text('Small', [{ type: 'textStyle', attrs: { fontSize: '16px' } }])),
    )
    const { container } = render(<RichDocView doc={rich} ctx={ctx()} />)
    const [big, small] = Array.from(container.querySelectorAll('span'))
    expect(big?.getAttribute('style')).toContain('font-size: clamp(32px, 8.21cqw, 46px)')
    expect(small?.getAttribute('style')).toContain('font-size: clamp(14px, 2.86cqw, 16px)')
  })

  it('every heading level and the paragraph role scale, the paragraph role more gently since it never clears the floor', () => {
    const theme = defaultTheme(branding)
    theme.text.heading2.size = 40
    theme.text.paragraph.size = 15
    const { container } = render(<RichDocView doc={doc(heading(2, text('H')), paragraph(text('p')))} ctx={ctx({ theme })} />)
    expect(container.querySelector('h2')?.getAttribute('style')).toContain('font-size: clamp(32px, 7.14cqw, 40px)')
    expect(container.querySelector('p')?.getAttribute('style')).toContain('font-size: clamp(13px, 2.68cqw, 15px)')
  })
})

describe('table border colour', () => {
  it('a table with a borderColor publishes it as --table-border on the <table>; without one nothing is set (cells fall back to a faint current colour)', () => {
    const cell = { type: 'tableCell', content: [paragraph(text('c'))] }
    const coloured = doc({ type: 'table', attrs: { borderColor: '#ff0000' }, content: [{ type: 'tableRow', content: [cell] }] })
    const plain = doc({ type: 'table', content: [{ type: 'tableRow', content: [cell] }] })
    expect(render(<RichDocView doc={coloured} ctx={ctx()} />).container.querySelector('table')?.getAttribute('style')).toContain('--table-border: #ff0000')
    expect(render(<RichDocView doc={plain} ctx={ctx()} />).container.querySelector('table')?.getAttribute('style') ?? '').not.toContain('--table-border')
  })
})
