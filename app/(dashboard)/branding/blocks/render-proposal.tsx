'use client'

import type { ReactNode } from 'react'

import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { EditAboutMe } from './proposal/about-me'
import { EditAccept } from './proposal/accept'
import { EditFaq } from './proposal/faq'
import { EditGallery } from './proposal/gallery'
import { EditHero } from './proposal/hero'
import { EditHowItWorks } from './proposal/how-it-works'
import { EditIntroNote } from './proposal/intro-note'
import { EditPackages } from './proposal/packages'
import { EditTestimonials } from './proposal/testimonials'
import { EditVideo } from './proposal/video'
import type { Block } from './types'

/** Shared block-update callback signature every editor renderer receives. */
export type UpdateBlock = <B extends Block>(id: string, patch: Partial<B>) => void

/**
 * Editor-only extras the proposal block renderers need beyond `block` /
 * `state` / `updateBlock`: whether the block is the current selection, and
 * the three upload/removal callbacks that talk to Supabase Storage. Every
 * field is typed `| undefined` (not just `?:`) so building this object from
 * another optional field (as `block-renderer.tsx` does) type-checks under
 * `exactOptionalPropertyTypes` without needing every key to be present.
 */
export interface ProposalRenderExtras {
  selected?: boolean | undefined
  uploadBlockImage?: ((file: File, key: string) => Promise<string>) | undefined
  uploadVideo?: ((file: File, key: string, onProgress?: (pct: number) => void) => Promise<string>) | undefined
  removeAsset?: ((bucket: 'branding' | 'proposal-media', key: string) => Promise<void>) | undefined
}

/**
 * Dispatches a proposal block to its editor renderer. Returns `undefined`
 * for any block type this function doesn't recognise (the caller falls
 * through to its own switch for the rest of the block library).
 */
export function renderProposalBlock(
  block: Block,
  state: BrandPreviewState,
  updateBlock: UpdateBlock,
  extras: ProposalRenderExtras,
  surface: SurfaceTab
): ReactNode | undefined {
  switch (block.type) {
    case 'hero':
      return <EditHero block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'video':
      return <EditVideo block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'gallery':
      return <EditGallery block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'testimonials':
      return <EditTestimonials block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'aboutMe':
      return <EditAboutMe block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'howItWorks':
      return <EditHowItWorks block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'faq':
      return <EditFaq block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'introNote':
      return <EditIntroNote block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'packages':
      return <EditPackages block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'accept':
      return <EditAccept block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    default:
      return undefined
  }
}
