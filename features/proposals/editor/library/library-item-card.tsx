'use client'

/**
 * One block/preset card in the add-section palette's Sections/Presets
 * grid (`../palette-body.tsx`): a preview, the label, and (presets only)
 * a one-line description. The preview is `SectionPreviewArt` for a bare
 * `SectionKind` entry (a fresh section has no content to thumbnail) and
 * `LayoutThumbnail` of the one-section layout for a preset, which already
 * has real content to render. A plain `div role="button"`, not a real
 * `<button>`: the print-mode thumbnail of an
 * Accept preset renders a real `<button>` for its accept action, and a
 * hero preset can render an `<a>` link, so nesting either inside a
 * `<button>` would be invalid HTML (a button already disallows
 * interactive descendants).
 *
 * @module features/proposals/editor/library/library-item-card
 */
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { Section } from '../../model/layout'
import { LayoutThumbnail } from '../../render/layout-thumbnail'

import type { LibraryEntry } from './library-items'
import { SectionPreviewArt } from './section-preview-art'

/** Shown on a disabled card once the layout is at `LAYOUT_LIMITS.maxSections`. Distinct copy from `AddLine`'s `SECTION_CAP_MESSAGE` tooltip - a short in-card note reads better here than that longer sentence would at card width. */
export const LIBRARY_CAP_MESSAGE = 'Section limit reached'

/** Props for {@link LibraryItemCard}. */
export interface LibraryItemCardProps {
  entry: LibraryEntry
  branding: PublicBranding
  /** Disables the card once the layout is at `LAYOUT_LIMITS.maxSections` - the same cap `AddLine`/`AddPalette` already enforce. */
  disabled: boolean
  onInsert: (section: Section) => void
}

/** One card. Presentation + the click/keyboard activation only - `onInsert` decides what happens next. */
export function LibraryItemCard({ entry, branding, disabled, onInsert }: LibraryItemCardProps) {
  const activate = () => {
    if (disabled) return
    onInsert(entry.build())
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`Add ${entry.label}`}
      onClick={activate}
      onKeyDown={(e) => {
        // Space also scrolls the panel in a plain div; suppress that default
        // the same way a real `<button>` would, then activate like Enter.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      title={disabled ? LIBRARY_CAP_MESSAGE : undefined}
      // No horizontal padding: the grid cell it sits in already carries
      // none of its own (`palette-body.tsx`), so the first column's
      // illustration lands flush with the caller's own left inset -
      // matching, in the Modal branch, the "Add a section" title. No
      // entrance animation either (dropped 2026-09-19): a per-card
      // staggered pop-in read as the grid flickering open one tile at a
      // time rather than the popover/modal's own single fade doing the
      // whole job.
      className={`group flex flex-col gap-1 rounded-control py-1.5 text-left transition-colors ${
        disabled ? 'opacity-50' : 'cursor-pointer hover:bg-surface-muted'
      }`}
    >
      {/* Hover is a border-strong tint only, the same card hover the rest of
          the app uses (`proposal-role-chooser.tsx`, `surface-tabs.tsx`). An
          earlier `scale-[1.03]` + shadow lift grew the thumbnail past the
          grid cell, and the palette's scroll container clipped the right
          column's outer border on hover. */}
      {entry.kind ? (
        <div
          className={`aspect-[4/3] overflow-hidden rounded-control border border-border bg-surface-muted transition-colors ${
            disabled ? '' : 'group-hover:border-border-strong'
          }`}
        >
          <SectionPreviewArt kind={entry.kind} />
        </div>
      ) : (
        <LayoutThumbnail
          layout={entry.layout}
          branding={branding}
          className={`transition-colors ${disabled ? '' : 'group-hover:border-border-strong'}`}
        />
      )}
      <span className="text-body text-text">{entry.label}</span>
      {entry.description ? (
        <span className="line-clamp-2 text-body text-text-muted">{entry.description}</span>
      ) : null}
      {disabled ? <span className="text-body text-text-subtle">{LIBRARY_CAP_MESSAGE}</span> : null}
    </div>
  )
}
