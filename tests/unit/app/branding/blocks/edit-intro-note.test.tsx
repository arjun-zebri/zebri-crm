/**
 * Unit tests for the personal note's editor renderer (through
 * `renderProposalBlock`): the per-proposal note is a clearly captioned,
 * muted stand-in that the toolbar can target, with the heading still
 * inline-editable.
 *
 * @module tests/unit/app/branding/blocks/edit-intro-note
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { renderProposalBlock, type UpdateBlock } from '@/app/(dashboard)/branding/blocks/render-proposal'
import type { IntroNoteBlock } from '@/app/(dashboard)/branding/blocks/types'
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

function introNoteBlock(): IntroNoteBlock {
  const block = blockTemplate('introNote')
  if (block.type !== 'introNote') throw new Error('expected an intro note block template')
  return block
}

function Host({ block, updateBlock }: { block: IntroNoteBlock; updateBlock: UpdateBlock }) {
  return <>{renderProposalBlock(block, state, updateBlock, {}, 'proposal')}</>
}

describe('EditIntroNote', () => {
  it('captions the sample note up front as per-proposal content and drops the trailing chip', () => {
    const { container } = render(<Host block={introNoteBlock()} updateBlock={vi.fn()} />)
    const note = container.querySelector('[data-subtarget="note"]')!
    expect(note).not.toBeNull()
    const caption = screen.getByText(/written per proposal/i)
    // The caption comes before the sample text, not after it.
    expect(note.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy()
    expect(caption.compareDocumentPosition(screen.getByText(/Thank you for the call/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('{{ Note }}')).toBeNull()
  })

  it('renders the sample note muted so it reads as a stand-in, not a field', () => {
    render(<Host block={introNoteBlock()} updateBlock={vi.fn()} />)
    const sample = screen.getByText(/Thank you for the call/).closest('[data-sample-note]')
    expect(sample?.className).toContain('opacity-')
  })
})
