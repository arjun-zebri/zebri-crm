/**
 * The whole-page renderer (spec §6): one `<section>` per layout section
 * with its style applied, content sections through `RichDocView`, data
 * sections through the v1 adapter, `hideOnMobile` as a class, and the
 * first section never animated.
 *
 * @module tests/unit/features/proposals/render/layout
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import {
  defaultTheme, doc, heading, migrateProposalTreeToLayout, paragraph, ProposalLayoutView, text, type ProposalLayout, type ProposalTheme, type Section,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function layout(): ProposalLayout {
  const migrated = migrateProposalTreeToLayout([blockTemplate('packages'), blockTemplate('accept')])
  return {
    version: 2,
    sections: [
      { id: 'hero', kind: 'content', name: 'Hero', style: { height: 'full', contentWidth: 'medium', padding: 'roomy', background: { color: '#112233' }, textColor: '#FFFFFF', align: 'center' }, content: doc(heading(1, text('Anna & Jake')), paragraph(text('A proposal'))) },
      { id: 'hidden', kind: 'content', hideOnMobile: true, style: { height: 'fit', contentWidth: 'narrow', padding: 'compact' }, content: doc(paragraph(text('Desktop only'))) },
      ...migrated.sections,
    ],
  }
}

describe('ProposalLayoutView', () => {
  it('renders one section per layout section with the style applied', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    const sections = container.querySelectorAll('section[data-section-id]')
    expect(sections).toHaveLength(4)
    const hero = sections[0]!
    expect(hero.getAttribute('data-section-kind')).toBe('content')
    expect(hero.getAttribute('style')).toContain('min-height: 100svh')
    expect(hero.getAttribute('style')).toContain('rgb(17, 34, 51)')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anna & Jake')
    expect(hero.querySelector('[class*="max-w-doc-prose"]')).not.toBeNull()
  })

  it('marks hide-on-mobile sections with the responsive class and never animates the first section', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    const sections = container.querySelectorAll('section[data-section-id]')
    expect(sections[1]!.className).toContain('@max-3xl/doc:hidden')
    expect(sections[0]!.getAttribute('data-reveal')).toBeNull()
    // The default theme animates the rest by section: pending until seen
    // (jsdom has no IntersectionObserver, so `useReveal` reveals at once).
    expect(sections[1]!.getAttribute('data-reveal')).toBe('in')
    expect(sections[1]!.getAttribute('data-anim')).toBe('slide')
  })

  it('renders data sections through the v1 components and wires accept to onAction', () => {
    const onAction = vi.fn()
    render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" onAction={onAction} proposal={{ onAccept: () => onAction({ kind: 'accept' }) }} />)
    // The v1 packages block renders the sample proposal's option titles.
    expect(screen.getAllByText(SAMPLE_PROPOSAL_DOC.proposal!.options[0]!.title).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
  })

  it('print mode renders full sections at 480px and skips the reveal attributes', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="print" />)
    const hero = container.querySelector('section[data-section-id]')!
    expect(hero.getAttribute('style')).toContain('min-height: 480px')
    expect(container.querySelector('[data-reveal]')).toBeNull()
  })
})

describe('ProposalLayoutView with a canvas theme', () => {
  const themed = (patch: Partial<ProposalTheme>): ProposalLayout => ({ ...layout(), theme: { ...defaultTheme(branding), ...patch } })

  it('paints the theme background and duration on the root, and the gap between sections', () => {
    const { container } = render(<ProposalLayoutView layout={themed({ background: '#ABCDEF', sectionGap: 32, animation: { mode: 'section', type: 'fade', speed: 'fast' } })} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('style')).toContain('rgb(171, 205, 239)')
    expect(root.getAttribute('style')).toContain('--doc-anim-ms: 400ms')
    const sections = container.querySelectorAll<HTMLElement>('section[data-section-id]')
    expect(sections[0]!.style.marginTop).toBe('')
    expect(sections[1]!.style.marginTop).toBe('32px')
    expect(sections[1]!.getAttribute('data-anim')).toBe('fade')
  })

  it('"together" animates every section including the first; "none" animates nothing', () => {
    const together = render(<ProposalLayoutView layout={themed({ animation: { mode: 'together', type: 'slide', speed: 'slow' } })} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    expect(together.container.querySelectorAll('[data-reveal="in"]')).toHaveLength(4)
    together.unmount()
    const none = render(<ProposalLayoutView layout={themed({ animation: { mode: 'none', type: 'slide', speed: 'medium' } })} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    expect(none.container.querySelector('[data-reveal]')).toBeNull()
  })

  /** `layout()` plus a break after the hero, then another before the accept section: three pages. */
  const paged = (patch: Partial<ProposalTheme>): ProposalLayout => {
    const l = themed(patch)
    const [hero, hidden, packages, accept] = l.sections
    const pb = (id: string): Section => ({ id, kind: 'pageBreak', style: { height: 'fit', contentWidth: 'medium' } })
    return { ...l, sections: [hero!, pb('pb1'), hidden!, packages!, pb('pb2'), accept!] }
  }

  it('step flow marks the root and splits the sections into screen-tall snapping pages, with one dot per page', () => {
    const { container } = render(<ProposalLayoutView layout={paged({ flow: 'step', sectionGap: 24 })} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    expect((container.firstElementChild as HTMLElement).getAttribute('data-flow')).toBe('step')
    const pages = container.querySelectorAll<HTMLElement>('[data-page-id]')
    expect(Array.from(pages).map((p) => p.getAttribute('data-page-id'))).toEqual(['page-first', 'pb1', 'pb2'])
    for (const p of pages) {
      expect(p.className).toContain('snap-start')
      expect(p.getAttribute('style')).toContain('min-height: var(--doc-screen, 100svh)')
    }
    expect(pages[1]!.querySelectorAll('section[data-section-id]')).toHaveLength(2)
    // The page is the screen; a section inside it keeps its natural height
    // and never snaps by itself. Only a section whose own Height is `full`
    // (the hero here) grows to fill its page.
    const sections = container.querySelectorAll<HTMLElement>('section[data-section-id]')
    expect(sections).toHaveLength(4)
    for (const s of sections) {
      expect(s.className).not.toContain('snap-start')
      expect(s.getAttribute('style') ?? '').not.toContain('min-height')
    }
    expect(sections[0]!.className).toContain('grow')
    expect(sections[1]!.className).not.toContain('grow')
    expect(sections[2]!.className).not.toContain('grow')
    // The gap sits between sections on a page, never above a page's first section.
    expect(sections[1]!.style.marginTop).toBe('')
    expect(sections[2]!.style.marginTop).toBe('24px')
    // Breaks never render as sections.
    expect(container.querySelector('[data-section-kind="pageBreak"]')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Pages' }).querySelectorAll('button')).toHaveLength(3)
  })

  it('step flow skips a page with nothing on it', () => {
    const l = paged({ flow: 'step' })
    const pb: Section = { id: 'pb0', kind: 'pageBreak', style: { height: 'fit', contentWidth: 'medium' } }
    const { container } = render(<ProposalLayoutView layout={{ ...l, sections: [pb, ...l.sections, pb, { ...pb, id: 'pb9' }] }} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    expect(Array.from(container.querySelectorAll('[data-page-id]')).map((p) => p.getAttribute('data-page-id'))).toEqual(['pb0', 'pb1', 'pb2'])
  })

  it('stack flow renders the flat list and drops the page breaks', () => {
    const { container } = render(<ProposalLayoutView layout={paged({ flow: 'stack' })} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    expect(container.querySelector('[data-page-id]')).toBeNull()
    expect(container.querySelectorAll('section[data-section-id]')).toHaveLength(4)
    expect(container.querySelector('[data-section-kind="pageBreak"]')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
  })

  it('step flow never applies in print', () => {
    const { container } = render(<ProposalLayoutView layout={paged({ flow: 'step' })} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="print" />)
    expect((container.firstElementChild as HTMLElement).getAttribute('data-flow')).toBeNull()
    expect(container.querySelector('[data-page-id]')).toBeNull()
    expect(container.querySelector('.snap-start')).toBeNull()
    expect(container.querySelectorAll('section[data-section-id]')).toHaveLength(4)
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
  })

  it('the theme text roles reach the rendered headings and paragraphs; sections inherit theme padding', () => {
    const theme = defaultTheme(branding)
    theme.text.heading1.size = 61
    theme.text.paragraph.color = '#123456'
    const l: ProposalLayout = { version: 2, theme: { ...theme, sectionPadding: 'roomy' }, sections: [{ id: 's', kind: 'content', style: { height: 'fit', contentWidth: 'medium' }, content: doc(heading(1, text('Hi')), paragraph(text('Body'))) }] }
    const { container } = render(<ProposalLayoutView layout={l} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('style')).toContain('61px')
    expect(screen.getByText('Body').getAttribute('style')).toContain('rgb(18, 52, 86)')
    expect(container.querySelector<HTMLElement>('[data-content-column]')!.style.paddingTop).toBe('64px')
  })
})
