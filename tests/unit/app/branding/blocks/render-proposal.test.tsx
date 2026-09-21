/**
 * Unit tests for the proposal FAQ editor renderer, dispatched through
 * `renderProposalBlock`: typing a question, adding a question, and removing
 * one all mutate the block through `updateBlock` in place. Exercises the
 * dispatcher itself (not just `EditFaq` directly) so the `block-renderer.tsx`
 * wiring stays covered.
 *
 * @module tests/unit/app/branding/blocks/render-proposal
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { renderProposalBlock, type UpdateBlock } from '@/app/(dashboard)/branding/blocks/render-proposal'
import type { FaqBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { BrandPreviewState } from '@/types/branding-preview'

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

/** Renders `renderProposalBlock`'s output directly, as `BlockRenderer` would. */
function Host({ block, updateBlock }: { block: FaqBlock; updateBlock: UpdateBlock }) {
  return <>{renderProposalBlock(block, state, updateBlock, {}, 'proposal')}</>
}

function faqBlock(): FaqBlock {
  const block = blockTemplate('faq')
  if (block.type !== 'faq') throw new Error('expected a faq block template')
  return block
}

describe('renderProposalBlock: faq', () => {
  it('renders a rich-text question and answer field per item', async () => {
    // The FAQ fields are now full RichText editors (variables + inline
    // formatting), not plain single-line inputs; each is a labelled TipTap
    // textbox that mounts on an effect (immediatelyRender: false).
    const block = faqBlock()
    const updateBlock = vi.fn() as unknown as UpdateBlock
    render(<Host block={block} updateBlock={updateBlock} />)

    await waitFor(() =>
      expect(screen.getAllByRole('textbox', { name: 'Question' })).toHaveLength(block.items.length),
    )
    expect(screen.getAllByRole('textbox', { name: 'Answer' })).toHaveLength(block.items.length)
    expect(screen.getAllByRole('textbox', { name: 'Question' })[0]!.classList).toContain('ProseMirror')
  })

  it('adds a blank question after the list', () => {
    const block = faqBlock()
    const updateBlock = vi.fn() as unknown as UpdateBlock
    render(<Host block={block} updateBlock={updateBlock} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))

    expect(updateBlock).toHaveBeenCalledTimes(1)
    const [, patch] = (updateBlock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { items: unknown[] }]
    expect(patch.items).toHaveLength(3)
  })

  it('removes the second question, leaving one', () => {
    const block = faqBlock()
    const updateBlock = vi.fn() as unknown as UpdateBlock
    render(<Host block={block} updateBlock={updateBlock} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove question 2' }))

    expect(updateBlock).toHaveBeenCalledWith(block.id, { items: [block.items[0]] })
  })
})
