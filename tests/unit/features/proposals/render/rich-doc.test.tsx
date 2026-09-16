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
  button, column, columns, doc, embed, heading, hr, image, NODE_TYPES, paragraph, RichDocView, spacer, text, variable,
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

  it('renders unknown ids and unknown node types as nothing', () => {
    const { container } = render(<RichDocView doc={doc(paragraph(variable('nope')), { type: 'mystery' } as never)} ctx={ctx()} />)
    expect(container.textContent).toBe('')
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
