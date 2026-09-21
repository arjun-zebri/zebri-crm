/**
 * A small illustrated mockup for one `SectionKind`, standing in for
 * `LayoutThumbnail` on `LibraryItemCard`'s Sections tab (Qwilr-parity
 * pass): a freshly-built section has no content yet, so its real render
 * is a blank white box that tells the user nothing. Each shape below is
 * a plain div drawn from design tokens, not the `Skeleton` primitive -
 * `Skeleton`'s `animate-pulse` means "this is still loading," the wrong
 * message for a static preview that never resolves into real content.
 *
 * @module features/proposals/editor/library/section-preview-art
 */
import { ChevronDown, ImageIcon, Play, Quote } from 'lucide-react'

import type { SectionKind } from '../../model/layout'

/** Props for {@link SectionPreviewArt}. */
export interface SectionPreviewArtProps {
  kind: SectionKind
}

/** One illustrated mockup, sized to fill its parent's `aspect-[4/3]` box. */
export function SectionPreviewArt({ kind }: SectionPreviewArtProps) {
  switch (kind) {
    case 'content':
      return (
        <div aria-hidden="true" className="flex h-full w-full flex-col justify-center gap-1.5 p-3">
          <div className="h-2 w-1/2 rounded-pill bg-border-strong" />
          <div className="h-1.5 w-full rounded-pill bg-border" />
          <div className="h-1.5 w-full rounded-pill bg-border" />
          <div className="h-1.5 w-2/3 rounded-pill bg-border" />
        </div>
      )
    case 'packages':
      return (
        <div aria-hidden="true" className="flex h-full w-full items-center justify-center p-3">
          <div className="flex w-4/5 flex-col gap-1.5 rounded-control border border-border-strong p-2">
            <div className="h-1.5 w-1/2 rounded-pill bg-border-strong" />
            <div className="h-2.5 w-1/3 rounded-pill bg-border-strong" />
            <div className="mt-1 h-2 w-full rounded-pill bg-text" />
          </div>
        </div>
      )
    case 'gallery':
      return (
        <div aria-hidden="true" className="grid h-full w-full grid-cols-2 gap-1 p-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-center rounded-control bg-border">
              <ImageIcon size={12} strokeWidth={1.5} className="text-text-subtle" />
            </div>
          ))}
        </div>
      )
    case 'video':
      return (
        <div aria-hidden="true" className="flex h-full w-full items-center justify-center p-2.5">
          <div className="flex h-full w-full items-center justify-center rounded-control bg-text">
            <div className="flex h-6 w-6 items-center justify-center rounded-pill bg-surface">
              <Play size={11} className="ml-0.5 fill-text text-text" />
            </div>
          </div>
        </div>
      )
    case 'testimonials':
      return (
        <div aria-hidden="true" className="flex h-full w-full flex-col justify-center gap-2 p-3">
          <Quote size={14} strokeWidth={1.5} className="text-text-subtle" />
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-pill bg-border" />
            <div className="h-1.5 w-3/4 rounded-pill bg-border" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-pill bg-border-strong" />
            <div className="h-1.5 w-1/3 rounded-pill bg-border-strong" />
          </div>
        </div>
      )
    case 'faq':
      return (
        <div aria-hidden="true" className="flex h-full w-full flex-col justify-center gap-1.5 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-control border border-border px-2 py-1">
              <div className="h-1.5 w-2/3 rounded-pill bg-border-strong" />
              <ChevronDown size={10} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
            </div>
          ))}
        </div>
      )
    case 'accept':
      return (
        <div aria-hidden="true" className="flex h-full w-full items-center justify-center p-3">
          <span className="rounded-pill bg-text px-4 py-1.5 text-body font-medium text-text-inverse">Accept</span>
        </div>
      )
    case 'pageBreak':
      // Two stacked sheets with a dashed cut between: the break itself.
      return (
        <div aria-hidden="true" className="flex h-full w-full flex-col justify-center gap-1.5 p-3">
          <div className="h-1/3 w-full rounded-control bg-border" />
          <div className="border-t border-dashed border-border-strong" />
          <div className="h-1/3 w-full rounded-control bg-border" />
        </div>
      )
  }
}
