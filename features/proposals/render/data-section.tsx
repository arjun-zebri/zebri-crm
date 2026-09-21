'use client'

/**
 * Phase 1 adapter: a v2 data section rendered by the v1 public component
 * for its kind. The section's `data.<kind>` is the v1 block minus chrome,
 * so rebuilding a v1 block is a spread plus `id` / `type`. Phase 3
 * replaces every branch with a v2-native component and deletes this file.
 *
 * @module features/proposals/render/data-section
 */
import type { ReactNode } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { RenderAccept, type AcceptSlots } from '@/lib/branding/public-blocks/proposal/accept'
import { RenderFaq, type FaqSlots } from '@/lib/branding/public-blocks/proposal/faq'
import { RenderGallery, type GallerySlots } from '@/lib/branding/public-blocks/proposal/gallery'
import { RenderPackages, type PackagesSlots } from '@/lib/branding/public-blocks/proposal/packages'
import { RenderTestimonials, type TestimonialsSlots } from '@/lib/branding/public-blocks/proposal/testimonials'
import { RenderVideo, type VideoSlots } from '@/lib/branding/public-blocks/proposal/video'
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { DATA_TEXT_FIELDS, type Section } from '../model/layout'
import { resolvePackageOptions, toPublicOption } from '../model/packages'

import type { RenderMode } from './rich-doc'

/**
 * Slice E1's editor slots, one optional bag per data kind plus `after` -
 * `SectionView`/`DataSectionView` are the only two components that need to
 * know all four kinds at once (every data-kind editor threads its own
 * kind's slots through here), so the per-kind `*Slots` interfaces
 * (`FaqSlots`, `TestimonialsSlots`, ...) stay exactly what each public
 * component already declared - nothing here changes their shape or the
 * public page's own call sites, which never pass `slots` at all.
 */
export interface DataSectionSlots {
  faq?: FaqSlots
  testimonials?: TestimonialsSlots
  accept?: AcceptSlots
  packages?: PackagesSlots
  /** Slice E2. */
  gallery?: GallerySlots
  /** Slice E2. */
  video?: VideoSlots
  /**
   * Rendered immediately after the data block's own content, still inside
   * the section's content column (`SectionView`). Neither `FaqSlots` nor
   * `TestimonialsSlots` has a slot for "after the whole list" - a sent
   * proposal never shows an "Add question"/"Add testimonial" control, so
   * the public components have nothing to hang one off - so the editor's
   * add-item button lives here instead, one level up.
   */
  after?: ReactNode
}

/**
 * The v1 block a data section stands for. Throws on a content section:
 * callers branch on `kind` first. The block's own text-above/text-below
 * fields (`DATA_TEXT_FIELDS`: heading, caption, text below, reassurance
 * and their styles) are stripped here, whatever the stored data says: a
 * v2 data section is the data alone, and any heading or note around it is
 * its own content section (2026-09-19 feedback). Stripping at this one
 * seam covers the canvas, the public page, print and thumbnails alike,
 * including a template saved while those fields were still editable. The
 * v1 renderers each hide a heading/caption/note that has no content, so
 * blank is enough - no per-renderer change is needed beyond `accept`,
 * which gates the same way now.
 */
export function toV1Block(section: Section): Block {
  if (section.kind === 'content' || !section.data) throw new Error(`Section ${section.id} is not a data section`)
  const data = section.data
  // `keyof (A | B | ...)` is the *intersection* of each member's keys (here
  // just `kind`), so indexing by `data.kind` directly would type as the kind
  // literal, not the data object; go through `unknown` to look it up by name.
  const fields = { ...(data as unknown as Record<string, Record<string, unknown>>)[data.kind] }
  for (const key of DATA_TEXT_FIELDS) delete fields[key]
  return { id: section.id, type: section.kind, ...fields } as Block
}

/** Renders a v2 data section (`packages` / `accept` / `gallery` / `video` / `testimonials` / `faq`) through its v1 public component. */
export function DataSectionView({
  section, branding, doc, mode, proposal, values, slots, defaultSelection,
}: {
  section: Section
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  proposal: ProposalSlotProps | undefined
  values: Record<string, string>
  /** Editor-only (Slice E1): `undefined` on every public-page/print call site, so this is a pure addition - the switch below hands each branch only its own kind's slice. */
  slots?: DataSectionSlots | undefined
  /** Forwarded to a `packages` section's `RenderPackages` - see its own doc comment. Every other kind ignores it. */
  defaultSelection?: boolean | undefined
}) {
  const block = toV1Block(section)
  // The v1 components take the old frame names; edit behaves like page here.
  const frame = mode === 'print' ? 'print' : 'page'
  // `slots?.<kind>` is only ever spread when set: each public component's
  // own `slots?` prop type omits `undefined` from its value
  // (`exactOptionalPropertyTypes`), so passing an explicit `slots={undefined}`
  // - which `slots?.packages` becomes whenever `slots` itself is absent -
  // is a type error distinct from the prop being absent altogether.
  switch (block.type) {
    case 'packages': {
      // The section's own packages (`model/packages.ts`, starters until it has any).
      const options = section.data?.kind === 'packages' ? resolvePackageOptions(section.data.packages).map(toPublicOption) : undefined
      return <RenderPackages block={block} branding={branding} doc={doc} proposal={proposal} variableValues={values} options={options} defaultSelection={defaultSelection} {...(slots?.packages ? { slots: slots.packages } : {})} />
    }
    case 'accept': return <RenderAccept block={block} branding={branding} doc={doc} proposal={proposal} variableValues={values} {...(slots?.accept ? { slots: slots.accept } : {})} />
    case 'gallery': return <RenderGallery block={block} branding={branding} {...(slots?.gallery ? { slots: slots.gallery } : {})} />
    case 'video': return <RenderVideo block={block} branding={branding} frame={frame} variableValues={values} {...(slots?.video ? { slots: slots.video } : {})} />
    case 'testimonials': return <RenderTestimonials block={block} branding={branding} variableValues={values} {...(slots?.testimonials ? { slots: slots.testimonials } : {})} />
    case 'faq': return <RenderFaq block={block} branding={branding} variableValues={values} {...(slots?.faq ? { slots: slots.faq } : {})} />
    default: return null
  }
}
