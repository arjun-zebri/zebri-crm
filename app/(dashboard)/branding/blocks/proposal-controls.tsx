'use client'

import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { publicBrandingFromEditorState } from '../editor-branding'

import { AcceptControls, PackagesControls } from './proposal/controls-commerce'
import { IntroNoteControls, TestimonialsControls, AboutMeControls, FaqControls } from './proposal/controls-content'
import { HowItWorksControls } from './proposal/controls-how-it-works'
import { HeroControls } from './proposal/controls-media'
import { VideoControls, GalleryControls } from './proposal/controls-video-gallery'
import { SectionBackgroundControls } from './proposal/section-background-controls'
import type { UpdateBlock } from './render-proposal'
import type { Block } from './types'

/**
 * Toolbar control dispatcher for every proposal block type: the per-type
 * controls (hero height, packages layout, and so on) followed by the
 * section-background controls every proposal block shares. Returns `null`
 * for any block type this document doesn't render on the proposal surface,
 * so `block-toolbar.tsx`'s grouped `case` can hand it the block unfiltered.
 *
 * @module app/(dashboard)/branding/blocks/proposal-controls
 */
export function ProposalBlockControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: Block
  state: BrandPreviewState
  /** Accepted for parity with `BlockSpecificControls`'s other dispatch targets; no proposal control needs it today. */
  surface: SurfaceTab
  updateBlock: UpdateBlock
  /** The `data-subtarget` the MC clicked in the preview, for blocks with more than one styled part. */
  activeSubTarget: string | null
  expanded?: boolean | undefined
}) {
  const branding = publicBrandingFromEditorState(state)
  const typeControls = (() => {
    switch (block.type) {
      case 'hero':
        return <HeroControls block={block} branding={branding} updateBlock={updateBlock} activeSubTarget={activeSubTarget} expanded={expanded} />
      case 'video':
        return <VideoControls block={block} updateBlock={updateBlock} />
      case 'gallery':
        return <GalleryControls block={block} updateBlock={updateBlock} />
      case 'introNote':
        return <IntroNoteControls block={block} branding={branding} updateBlock={updateBlock} activeSubTarget={activeSubTarget} expanded={expanded} />
      case 'testimonials':
        return <TestimonialsControls block={block} branding={branding} updateBlock={updateBlock} expanded={expanded} />
      case 'aboutMe':
        return <AboutMeControls block={block} branding={branding} updateBlock={updateBlock} expanded={expanded} />
      case 'howItWorks':
        return <HowItWorksControls block={block} branding={branding} updateBlock={updateBlock} expanded={expanded} />
      case 'faq':
        return <FaqControls block={block} branding={branding} updateBlock={updateBlock} expanded={expanded} />
      case 'packages':
        return <PackagesControls block={block} branding={branding} updateBlock={updateBlock} expanded={expanded} />
      case 'accept':
        return <AcceptControls block={block} branding={branding} updateBlock={updateBlock} expanded={expanded} />
      default:
        return null
    }
  })()

  if (typeControls === null) return null

  return (
    // Bottom-aligned: the blocks whose controls still carry captions are
    // taller than the caption-less section-background group, and every
    // control is 32px, so aligning bottoms lines the inputs up.
    <div className="flex flex-wrap items-end gap-1 w-full">
      {typeControls}
      {/* The hero fills its section with its own media and overlay, so a
          section background behind it would never show; offering it only
          put a second "Overlay" field on screen. */}
      {block.type !== 'hero' && <SectionBackgroundControls block={block} updateBlock={updateBlock} />}
    </div>
  )
}
