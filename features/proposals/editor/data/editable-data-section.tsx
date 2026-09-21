'use client'

/**
 * The data-section editing surface (Proposal Layout v2 Slice E1, UX audit
 * 3.4: "everything in every block can be clicked and edited"). Renders
 * the section through the same `SectionView` the public page uses, with
 * `slots` built for its own kind swapped in, so a FAQ/testimonials/
 * accept/packages/gallery/video section reads as live-editable everywhere
 * instead of the static block Phase 2 shipped. Slice E2 finishes the set:
 * gallery (photo upload/remove/reorder-lite), video (embed or upload,
 * caption), packages edited in place on their cards (`edit-package-card.tsx`)
 * and testimonial photos. Section-level settings (packages layout/CTA,
 * gallery layout) live in the section's Style popover
 * (`bars/section-style-popover.tsx`).
 *
 * @module features/proposals/editor/data/editable-data-section
 */
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { Section } from '../../model/layout'
import type { ProposalTheme } from '../../model/theme'
import type { DataSectionSlots } from '../../render/data-section'
import { SectionView } from '../../render/section'
import type { LayoutAction } from '../state'

import { acceptSlots } from './edit-accept'
import { AddFaqItem, faqSlots } from './edit-faq'
import { gallerySlots } from './edit-gallery'
import { packagesSlots } from './edit-packages'
import { AddTestimonialItem, testimonialsSlots } from './edit-testimonials'
import { videoSlots } from './edit-video'

/** Props for {@link EditableDataSection}. */
export interface EditableDataSectionProps {
  section: Section
  index: number
  branding: PublicBranding
  /** The layout's canvas theme, handed to `SectionView` exactly as the public page does. */
  theme: ProposalTheme
  /** Sample document data data sections render against while editing; never sent anywhere (mirrors `EditableSectionProps.doc`). */
  doc: PublicDocData
  values: Record<string, string>
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  externalVersion: number
  /** Brand swatches offered by the accept button's colour popover (mirrors `EditableSectionProps.swatches`). Defaults to none. */
  swatches?: readonly string[]
}

/** One editable data section: builds the kind-specific `slots` and hands the section to `SectionView`, exactly like the read-only render only with those slots filled in. */
export function EditableDataSection({ section, index, branding, theme, doc, values, dispatch, externalVersion, swatches = [] }: EditableDataSectionProps) {
  const slots = dataSlotsFor(section, branding, theme, dispatch, externalVersion, swatches)
  // `defaultSelection={false}`: the canvas edits a template, not a real
  // proposal - no couple has picked anything, so a packages card should
  // never show its "Selected" CTA state here (`resolveSelection`'s doc
  // comment).
  return <SectionView section={section} index={index} branding={branding} theme={theme} doc={doc} mode="edit" values={values} slots={slots} defaultSelection={false} />
}

/** Builds the `DataSectionSlots` for `section`'s own kind, or `undefined` for a kind this slice does not make editable (or a section with no data yet). */
function dataSlotsFor(
  section: Section,
  branding: PublicBranding,
  theme: ProposalTheme,
  dispatch: EditableDataSectionProps['dispatch'],
  externalVersion: number,
  swatches: readonly string[],
): DataSectionSlots | undefined {
  if (!section.data) return undefined
  const data = section.data
  const sectionId = section.id
  // Selects the owning section on focus - see `InlineField`'s own doc for
  // why this must be driven explicitly rather than falling out of
  // `editable-section.tsx`'s click-anywhere-selects handler.
  const onFocus = () => dispatch({ type: 'select', sectionId })

  switch (data.kind) {
    case 'faq':
      return {
        faq: faqSlots({ sectionId, data: data.faq, dispatch, externalVersion, onFocus, theme, swatches }),
        after: <AddFaqItem sectionId={sectionId} data={data.faq} dispatch={dispatch} />,
      }
    case 'testimonials':
      return {
        testimonials: testimonialsSlots({ sectionId, data: data.testimonials, dispatch, externalVersion, onFocus, branding, theme, swatches }),
        after: <AddTestimonialItem sectionId={sectionId} data={data.testimonials} dispatch={dispatch} />,
      }
    case 'accept':
      return { accept: acceptSlots({ sectionId, data: data.accept, dispatch, externalVersion, onFocus, branding, swatches }) }
    case 'packages':
      return { packages: packagesSlots({ sectionId, data: data.packages, dispatch, externalVersion, onFocus, branding, theme, swatches }) }
    case 'gallery':
      return { gallery: gallerySlots({ sectionId, data: data.gallery, dispatch, externalVersion, onFocus }) }
    case 'video':
      return { video: videoSlots({ sectionId, data: data.video, dispatch, externalVersion, onFocus, branding }) }
    default:
      return undefined
  }
}
