/**
 * Unit tests for the block toolbar's hero-specific chrome: the structural
 * row hides the spacing / radius / border controls (a full-bleed opening has
 * no box to pad or frame), and Duplicate is disabled because the proposal
 * allows at most one hero.
 *
 * @module tests/unit/app/branding/blocks/block-toolbar-hero
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BlockToolbar } from '@/app/(dashboard)/branding/blocks/block-toolbar'
import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
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

function renderToolbar(block: Block, surface: 'proposal' | 'invoice' = 'proposal') {
  return render(
    <BlockToolbar
      block={block}
      state={state}
      surface={surface}
      updateBlock={vi.fn()}
      activeSubTarget={null}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      onResetBlock={vi.fn()}
    />,
  )
}

describe('BlockToolbar: hero', () => {
  it('hides the box controls that a full-bleed hero cannot use', () => {
    renderToolbar(blockTemplate('hero'))
    for (const name of ['Spacing', 'Corner radius', 'Border']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })

  it('a text block on the same surface keeps those controls', () => {
    renderToolbar(blockTemplate('text'))
    for (const name of ['Spacing', 'Corner radius', 'Border']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('disables Duplicate because the proposal allows at most one hero', () => {
    renderToolbar(blockTemplate('hero'))
    const duplicate = screen.getByRole('button', { name: /only one hero/i })
    expect(duplicate).toBeDisabled()
    renderToolbar(blockTemplate('text'))
    expect(screen.getByRole('button', { name: 'Duplicate block' })).toBeEnabled()
  })
})
