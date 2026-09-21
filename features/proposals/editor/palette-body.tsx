'use client'

/**
 * The add-section palette's actual content (Task 8, split out for the
 * final review's Finding 4; redesigned to a visual card grid per the
 * Qwilr-parity pass): a `LibraryItemCard` grid of the seven
 * `SectionKind`s (`library/library-items.ts`), so a user sees what a
 * section looks like before adding it instead of a bare label. The
 * Presets tab that used to sit above this grid was removed (design
 * feedback: presets added a second, rarely-used tab to a palette whose
 * only job is picking a section shape); `presetLibraryEntries` still
 * exists in `library-items.ts` but nothing calls it. `add-palette.tsx`
 * renders this bare inside `Modal` (no `MenuPanel` around it there - see
 * that file's module doc for why) and inside `MenuPanel` for the Popover
 * branch, so the two presentations never drift out of sync with each
 * other.
 *
 * @module features/proposals/editor/palette-body
 */
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { ProposalRole } from '@/lib/proposals/types'

import type { Section } from '../model/layout'

import { LibraryItemCard } from './library/library-item-card'
import { sectionLibraryEntries } from './library/library-items'

/** Props for {@link PaletteBody}. */
export interface PaletteBodyProps {
  /** Flavours the about/how-it-works section starters. */
  role: ProposalRole
  /** Fed straight to each card's `LayoutThumbnail`. */
  branding: PublicBranding
  /** Disables every card once the layout is at `LAYOUT_LIMITS.maxSections`, same cap `AddLine`/`LibraryItemCard` already enforce. Defaults to false for callers that don't track the cap. */
  atCap?: boolean
  onChoose: (section: Section) => void
}

/** The section card grid. Presentation only: never dispatches, just hands the chosen section to `onChoose`. */
export function PaletteBody({ role, branding, atCap = false, onChoose }: PaletteBodyProps) {
  const entries = sectionLibraryEntries(role)

  return (
    // No horizontal padding here or on `LibraryItemCard`'s root: this
    // grid renders with zero side inset of its own, so its left edge
    // lands exactly on whatever inset the caller wraps `PaletteBody` in -
    // the Modal branch's own `px-4 sm:px-6` (matching its title), or the
    // Popover branch's own padding wrapper.
    <div className="grid grid-cols-2 gap-2 py-2">
      {entries.map((entry) => (
        <LibraryItemCard key={entry.id} entry={entry} branding={branding} disabled={atCap} onInsert={onChoose} />
      ))}
    </div>
  )
}
