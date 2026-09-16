'use client'

/**
 * Phase 1 adapter: a v2 data section rendered by the v1 public component
 * for its kind. The section's `data.<kind>` is the v1 block minus chrome,
 * so rebuilding a v1 block is a spread plus `id` / `type`. Phase 3
 * replaces every branch with a v2-native component and deletes this file.
 *
 * @module features/proposals/render/data-section
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { RenderAccept } from '@/lib/branding/public-blocks/proposal/accept'
import { RenderFaq } from '@/lib/branding/public-blocks/proposal/faq'
import { RenderGallery } from '@/lib/branding/public-blocks/proposal/gallery'
import { RenderPackages } from '@/lib/branding/public-blocks/proposal/packages'
import { RenderTestimonials } from '@/lib/branding/public-blocks/proposal/testimonials'
import { RenderVideo } from '@/lib/branding/public-blocks/proposal/video'
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { Section } from '../model/layout'

import type { RenderMode } from './rich-doc'

/** The v1 block a data section stands for. Throws on a content section: callers branch on `kind` first. */
export function toV1Block(section: Section): Block {
  if (section.kind === 'content' || !section.data) throw new Error(`Section ${section.id} is not a data section`)
  const data = section.data
  // `keyof (A | B | ...)` is the *intersection* of each member's keys (here
  // just `kind`), so indexing by `data.kind` directly would type as the kind
  // literal, not the data object; go through `unknown` to look it up by name.
  const fields = (data as unknown as Record<string, Record<string, unknown>>)[data.kind]
  return { id: section.id, type: section.kind, ...fields } as Block
}

/** Renders a v2 data section (`packages` / `accept` / `gallery` / `video` / `testimonials` / `faq`) through its v1 public component. */
export function DataSectionView({
  section, branding, doc, mode, proposal, values,
}: {
  section: Section
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  proposal: ProposalSlotProps | undefined
  values: Record<string, string>
}) {
  const block = toV1Block(section)
  // The v1 components take the old frame names; edit behaves like page here.
  const frame = mode === 'print' ? 'print' : 'page'
  switch (block.type) {
    case 'packages': return <RenderPackages block={block} branding={branding} doc={doc} proposal={proposal} variableValues={values} />
    case 'accept': return <RenderAccept block={block} branding={branding} doc={doc} proposal={proposal} variableValues={values} />
    case 'gallery': return <RenderGallery block={block} branding={branding} />
    case 'video': return <RenderVideo block={block} branding={branding} frame={frame} variableValues={values} />
    case 'testimonials': return <RenderTestimonials block={block} branding={branding} variableValues={values} />
    case 'faq': return <RenderFaq block={block} branding={branding} variableValues={values} />
    default: return null
  }
}
