/**
 * Regression coverage for the editor's page frame (Phase B Task 3, fix
 * round 1): `BlockFrame` used to apply the shared `docX` horizontal padding
 * unconditionally, which insets the `<PageSection>` `BlockRenderer` passes as
 * its child a second time and stops proposal section backgrounds reaching
 * the canvas edge. This asserts no ancestor of the rendered `<section>`
 * carries that padding class.
 *
 * @module tests/unit/app/branding/blocks/block-renderer-frame
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BlockRenderer } from '@/app/(dashboard)/branding/blocks/block-renderer'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
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

describe('BlockRenderer page frame', () => {
  it('does not double-inset the PageSection with the shared docX padding', () => {
    const noop = () => {}
    const blocks: Block[] = [{ id: 'd1', type: 'divider' }]
    const { container } = render(
      <BlockRenderer
        blocks={blocks}
        setBlocks={noop}
        state={state}
        surface="proposal"
        selectedBlockIds={[]}
        setSelectedBlockIds={noop}
        requestAddAfter={noop}
        updateBlock={noop}
        duplicateBlock={noop}
        deleteBlock={noop}
        resetBlock={noop}
        frame="page"
      />,
    )

    const section = container.querySelector('section')
    expect(section).not.toBeNull()

    // Walk every ancestor up to the container root: none may carry the
    // shared docX padding class (`px-4`, from DENSITY_PADDING[...].docX);
    // the PageSection's own inner column is the only gutter in page mode.
    let el: HTMLElement | null = section!.parentElement
    while (el && el !== container) {
      expect(el.className).not.toContain('px-4')
      el = el.parentElement
    }
  })

  it('applies a block maxWidthPx inside the section, not on the sortable wrapper', () => {
    const noop = () => {}
    const blocks: Block[] = [{ id: 'd1', type: 'divider', maxWidthPx: 480 }]
    const { container } = render(
      <BlockRenderer
        blocks={blocks}
        setBlocks={noop}
        state={state}
        surface="proposal"
        selectedBlockIds={[]}
        setSelectedBlockIds={noop}
        requestAddAfter={noop}
        updateBlock={noop}
        duplicateBlock={noop}
        deleteBlock={noop}
        resetBlock={noop}
        frame="page"
      />,
    )

    const section = container.querySelector('section')
    expect(section).not.toBeNull()

    // The sortable wrapper (the section's own parent chain up to the root)
    // must carry no max-width; only a descendant of the section may.
    let el: HTMLElement | null = section!.parentElement
    while (el && el !== container) {
      expect(el.style.maxWidth).toBe('')
      el = el.parentElement
    }
    const insideSection = section!.querySelector<HTMLElement>('[style*="max-width"]')
    expect(insideSection?.style.maxWidth).toBe('480px')
  })
})
