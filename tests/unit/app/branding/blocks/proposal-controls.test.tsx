/**
 * Unit tests for `ProposalBlockControls`, the toolbar control dispatcher for
 * every proposal block type: a hero's Position grid, Include dropdown,
 * overlay and per-part typography controls, a packages block's Show inclusions toggle,
 * and the null fallback for a non-proposal block type. The hero's embed link
 * is covered in `embed-url-popover.test.tsx`, where it now lives.
 *
 * @module tests/unit/app/branding/blocks/proposal-controls
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { ProposalBlockControls } from '@/app/(dashboard)/branding/blocks/proposal-controls'
import type { Block, HeroBlock, IntroNoteBlock, PackagesBlock, VideoBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { BrandPreviewState } from '@/types/branding-preview'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

// Radix Select needs these two in jsdom before it will open (see
// tests/unit/components/ui/select.test.tsx).
Element.prototype.hasPointerCapture = () => false
Element.prototype.scrollIntoView = () => {}

const state: BrandPreviewState = {
  logoUrl: '',
  faviconUrl: '',
  headerImageUrl: '',
  brandColor: '#111827',
  headingColor: '#111827',
  subheadingColor: '#6B7280',
  surfaceColor: '#FFFFFF',
  textColor: '#111827',
  secondaryColor: '#FFFFFF',
  borderColor: '#E5E7EB',
  tagline: '',
  footerText: '',
  abn: '',
  showContactOnDocuments: false,
  fontHeading: 'poppins',
  fontBody: 'inter',
  fontWeight: 600,
  fontBodyWeight: 400,
  density: 'cozy',
  cornerRadius: 16,
  docPadding: 32,
  headingSize: 32,
  bodySize: 14,
  headingCase: 'none',
  bodyCase: 'none',
  subheadingSize: 14,
  subheadingWeight: 600,
  subheadingCase: 'uppercase',
  headingLetterSpacing: 0,
  bodyLineHeight: 1.5,
  linkColor: '#111827',
  buttonVariant: 'fill',
  buttonSize: 'md',
  buttonRadius: 8,
  sectionSpacing: 24,
  businessName: 'Test Business',
  phone: '',
  website: '',
  instagramUrl: '',
  facebookUrl: '',
  twitterUrl: '',
  pinterestUrl: '',
  bankAccountName: '',
  bankBsb: '',
  bankAccountNumber: '',
}

function heroBlock(): HeroBlock {
  const block = blockTemplate('hero')
  if (block.type !== 'hero') throw new Error('expected a hero block template')
  return block
}

function introNoteBlock(): IntroNoteBlock {
  const block = blockTemplate('introNote')
  if (block.type !== 'introNote') throw new Error('expected an intro note block template')
  return block
}

function packagesBlock(): PackagesBlock {
  const block = blockTemplate('packages')
  if (block.type !== 'packages') throw new Error('expected a packages block template')
  return block
}

function videoBlock(): VideoBlock {
  const block = blockTemplate('video')
  if (block.type !== 'video') throw new Error('expected a video block template')
  return block
}

describe('ProposalBlockControls: hero', () => {
  beforeEach(() => toastMock.mockClear())

  it('has no Height control and no captions: height is dragged on the canvas', () => {
    render(<ProposalBlockControls block={heroBlock()} state={state} surface="proposal" updateBlock={vi.fn()} activeSubTarget={null} />)
    expect(screen.queryByRole('combobox', { name: 'Height' })).toBeNull()
    expect(screen.queryByText(/^height$/i)).toBeNull()
    expect(screen.queryByText(/^text position$/i)).toBeNull()
  })

  it('has no embed URL field and no section background row (those live elsewhere)', () => {
    render(<ProposalBlockControls block={heroBlock()} state={state} surface="proposal" updateBlock={vi.fn()} activeSubTarget={null} />)
    expect(screen.queryByRole('textbox', { name: 'Embed URL' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Section overlay' })).toBeNull()
  })

  it('Position opens a 3x3 grid that writes both alignments in one patch', async () => {
    const block = heroBlock()
    const updateBlock = vi.fn()
    render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'Position' }))
    const cells = await screen.findAllByRole('radio')
    expect(cells.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Top left', 'Top centre', 'Top right',
      'Middle left', 'Middle centre', 'Middle right',
      'Bottom left', 'Bottom centre', 'Bottom right',
    ])
    expect(screen.getByRole('radio', { name: 'Middle centre' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Top right' }))
    expect(updateBlock).toHaveBeenCalledWith(block.id, { textAlign: 'right', verticalAlign: 'top', headingStyle: {}, subheadingStyle: {} })
  })

  it('Include toggles the heading and subheading off and on', async () => {
    const block = heroBlock()
    const updateBlock = vi.fn()
    const { rerender } = render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'Include' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Subheading' }))
    expect(updateBlock).toHaveBeenCalledWith(block.id, { showSubheading: false })
    // The list stays open for further toggles; it reflects the block's state.
    rerender(<ProposalBlockControls block={{ ...block, showHeading: false }} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)
    const heading = await screen.findByRole('button', { name: 'Heading' })
    expect(heading).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(heading)
    expect(updateBlock).toHaveBeenCalledWith(block.id, { showHeading: true })
  })

  it('shows the overlay slider only when the hero has media', () => {
    const { rerender } = render(<ProposalBlockControls block={heroBlock()} state={state} surface="proposal" updateBlock={vi.fn()} activeSubTarget={null} />)
    expect(screen.queryByRole('slider', { name: 'Overlay' })).toBeNull()
    const withImage: HeroBlock = { ...heroBlock(), background: { kind: 'image', url: 'https://example.com/hero.jpg' } }
    rerender(<ProposalBlockControls block={withImage} state={state} surface="proposal" updateBlock={vi.fn()} activeSubTarget={null} />)
    expect(screen.getByRole('slider', { name: 'Overlay' })).toBeInTheDocument()
  })

  it('styles the heading by default and the subheading when that part is clicked', () => {
    const block = heroBlock()
    const updateBlock = vi.fn()
    const { rerender } = render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)
    expect(screen.getByText('Heading', { selector: 'span' })).toBeInTheDocument()
    // The size stepper shows the size the hero renders at, not the document title's.
    expect(screen.getByRole('spinbutton', { name: /size/i })).toHaveValue(56)

    rerender(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget="subheading" />)
    expect(screen.getByText('Subheading', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /size/i })).toHaveValue(20)
    fireEvent.click(screen.getByRole('button', { name: /increase/i }))
    const [, patch] = updateBlock.mock.calls.at(-1) as [string, Partial<HeroBlock>]
    expect(patch.subheadingStyle?.fontSize).toBe(21)
    expect(patch.headingStyle).toBeUndefined()
  })
})

describe('ProposalBlockControls: personal note', () => {
  it('styles the heading by default and the note when that part is clicked, one group at a time', () => {
    const block = introNoteBlock()
    const updateBlock = vi.fn()
    const { rerender } = render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)
    expect(screen.getByText('Heading', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByText(/^note$/i)).toBeNull()
    expect(screen.getAllByRole('spinbutton', { name: /size/i })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /increase/i }))
    let [, patch] = updateBlock.mock.calls.at(-1) as [string, Partial<IntroNoteBlock>]
    expect(patch.headingStyle?.fontSize).toBeDefined()
    expect(patch.textStyle).toBeUndefined()

    rerender(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget="note" />)
    expect(screen.getByText('Note', { selector: 'span' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /increase/i }))
    ;[, patch] = updateBlock.mock.calls.at(-1) as [string, Partial<IntroNoteBlock>]
    expect(patch.textStyle?.fontSize).toBeDefined()
    expect(patch.headingStyle).toBeUndefined()
  })

  it('has no captions above its controls', () => {
    render(<ProposalBlockControls block={introNoteBlock()} state={state} surface="proposal" updateBlock={vi.fn()} activeSubTarget={null} />)
    for (const caption of [/^section colour$/i, /^section image$/i, /^overlay$/i]) {
      expect(screen.queryByText(caption)).toBeNull()
    }
  })
})

describe('ProposalBlockControls: section background (every non-hero proposal block)', () => {
  it('offers colour and image, and the overlay only once an image is set', () => {
    const block = introNoteBlock()
    const { rerender } = render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={vi.fn()} activeSubTarget={null} />)
    expect(screen.getByRole('button', { name: 'Section colour' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Section image' })).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Section overlay' })).toBeNull()
    rerender(
      <ProposalBlockControls block={{ ...block, sectionBackground: { imageUrl: 'https://x/bg.jpg' } }} state={state} surface="proposal" updateBlock={vi.fn()} activeSubTarget={null} />,
    )
    expect(screen.getByRole('slider', { name: 'Section overlay' })).toBeInTheDocument()
  })

  it('removing the only image clears the section background back to undefined', () => {
    const block: IntroNoteBlock = { ...introNoteBlock(), sectionBackground: { imageUrl: 'https://x/bg.jpg', overlay: 30 } }
    const updateBlock = vi.fn()
    render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove section image' }))
    // The overlay only ever darkened that image, so it goes with it.
    expect(updateBlock).toHaveBeenCalledWith(block.id, { sectionBackground: undefined })
  })
})

describe('ProposalBlockControls: video', () => {
  beforeEach(() => toastMock.mockClear())

  it('blurring an empty embed field does not wipe an uploaded video source', () => {
    const block: VideoBlock = { ...videoBlock(), source: { kind: 'upload', url: 'https://example.com/clip.mp4' } }
    const updateBlock = vi.fn()
    render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)

    const input = screen.getByRole('textbox', { name: 'Embed URL' })
    fireEvent.focus(input)
    fireEvent.blur(input)

    expect(updateBlock).not.toHaveBeenCalled()
  })
})

describe('ProposalBlockControls: packages', () => {
  it('toggling Show inclusions calls updateBlock with the flipped value', () => {
    const block = packagesBlock()
    const updateBlock = vi.fn()
    render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Show inclusions' }))

    expect(updateBlock).toHaveBeenCalledWith(block.id, { showInclusions: false })
  })
})

describe('ProposalBlockControls: non-proposal block', () => {
  it('returns null for a divider block', () => {
    const block = blockTemplate('divider') as Block
    const updateBlock = vi.fn()
    const { container } = render(<ProposalBlockControls block={block} state={state} surface="proposal" updateBlock={updateBlock} activeSubTarget={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
