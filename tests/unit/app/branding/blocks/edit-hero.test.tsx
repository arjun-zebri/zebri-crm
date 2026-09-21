/**
 * Unit tests for the hero's editor renderer (through `renderProposalBlock`,
 * so the dispatcher wiring stays covered): dragging the bottom-edge grip
 * writes `heightVh` as a share of the simulated 720px viewport, snapping to
 * a full screen near the top, and an empty hero offers its three background
 * sources from one Add background menu.
 *
 * @module tests/unit/app/branding/blocks/edit-hero
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { renderProposalBlock, type UpdateBlock } from '@/app/(dashboard)/branding/blocks/render-proposal'
import type { HeroBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { BrandPreviewState } from '@/types/branding-preview'

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const state: BrandPreviewState = {
  logoUrl: '', faviconUrl: '', headerImageUrl: '',
  brandColor: '#111827', headingColor: '#111827', subheadingColor: '#6B7280', surfaceColor: '#FFFFFF',
  textColor: '#111827', secondaryColor: '#FFFFFF', borderColor: '#E5E7EB',
  tagline: '', footerText: '', abn: '', showContactOnDocuments: false,
  fontHeading: 'poppins', fontBody: 'inter', fontWeight: 600, fontBodyWeight: 400,
  density: 'cozy', cornerRadius: 16, docPadding: 32, headingSize: 32, bodySize: 14,
  headingCase: 'none', bodyCase: 'none', subheadingSize: 14, subheadingWeight: 600, subheadingCase: 'uppercase',
  headingLetterSpacing: 0, bodyLineHeight: 1.5, linkColor: '#111827',
  buttonVariant: 'fill', buttonSize: 'md', buttonRadius: 8, sectionSpacing: 24,
  businessName: 'Test Business', phone: '', website: '', instagramUrl: '', facebookUrl: '', twitterUrl: '', pinterestUrl: '',
  bankAccountName: '', bankBsb: '', bankAccountNumber: '',
}

function heroBlock(): HeroBlock {
  const block = blockTemplate('hero')
  if (block.type !== 'hero') throw new Error('expected a hero block template')
  return block
}

function Host({ block, updateBlock }: { block: HeroBlock; updateBlock: UpdateBlock }) {
  return <>{renderProposalBlock(block, state, updateBlock, {}, 'proposal')}</>
}

function drag(grip: HTMLElement, dy: number) {
  fireEvent.mouseDown(grip, { clientY: 500 })
  fireEvent.mouseMove(window, { clientY: 500 + dy })
  fireEvent.mouseUp(window)
}

describe('EditHero: drag to resize', () => {
  it('dragging the grip up by a fifth of the canvas viewport takes 20 off the height', () => {
    const updateBlock = vi.fn()
    render(<Host block={heroBlock()} updateBlock={updateBlock} />)
    // The template is a full-screen hero: 100 of the 720px simulated viewport.
    drag(screen.getByTitle('Drag to resize'), -144)
    expect(updateBlock).toHaveBeenLastCalledWith(expect.any(String), { heightVh: 80 })
  })

  it('snaps back to a full screen when dragged within a few percent of it', () => {
    const updateBlock = vi.fn()
    render(<Host block={{ ...heroBlock(), heightVh: 60 }} updateBlock={updateBlock} />)
    // 60 + (36 / 720) * 100 = 65: no snap. 60 + (270 / 720) * 100 = 97.5: snaps to 100.
    drag(screen.getByTitle('Drag to resize'), 36)
    expect(updateBlock).toHaveBeenLastCalledWith(expect.any(String), { heightVh: 65 })
    drag(screen.getByTitle('Drag to resize'), 270)
    expect(updateBlock).toHaveBeenLastCalledWith(expect.any(String), { heightVh: 100 })
  })

  it('never goes below the minimum or above one screen', () => {
    const updateBlock = vi.fn()
    render(<Host block={{ ...heroBlock(), heightVh: 50 }} updateBlock={updateBlock} />)
    drag(screen.getByTitle('Drag to resize'), -2000)
    expect(updateBlock).toHaveBeenLastCalledWith(expect.any(String), { heightVh: 30 })
    drag(screen.getByTitle('Drag to resize'), 2000)
    expect(updateBlock).toHaveBeenLastCalledWith(expect.any(String), { heightVh: 100 })
  })
})

describe('EditHero: empty background', () => {
  it('offers image, video and link from one Add background menu', () => {
    render(<Host block={heroBlock()} updateBlock={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add background' }))
    expect(screen.getByRole('menuitem', { name: 'Upload image' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Upload video' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'YouTube or Vimeo link' })).toBeInTheDocument()
  })

  it('the link option swaps the menu for the URL form and sets an embed background', () => {
    const updateBlock = vi.fn()
    render(<Host block={heroBlock()} updateBlock={updateBlock} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add background' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'YouTube or Vimeo link' }))
    expect(screen.queryByRole('menuitem', { name: 'Upload image' })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Video link' }), { target: { value: 'https://vimeo.com/123456789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use video' }))
    expect(updateBlock).toHaveBeenCalledWith(expect.any(String), { background: { kind: 'embed', url: 'https://vimeo.com/123456789' } })
    expect(screen.queryByRole('textbox', { name: 'Video link' })).toBeNull()
  })

  it('has no menu once media is set', () => {
    render(<Host block={{ ...heroBlock(), background: { kind: 'image', url: 'https://x/bg.jpg' } }} updateBlock={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Add background' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove media' })).toBeInTheDocument()
  })
})
