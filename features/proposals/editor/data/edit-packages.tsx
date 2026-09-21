'use client'

/**
 * Packages slot builder: one editable card per package
 * (`edit-package-card.tsx`) and a trailing "Add package" tile in the same
 * grid. No heading and no text-below field (2026-09-19 feedback: "remove
 * the text from all these sections... we can always add text sections
 * around them") - a heading, deposit or cancellation note belongs in its
 * own text section stacked above/below, not embedded in this block. (The
 * old hardcoded "A 25% deposit ($0.00) secures your date" line stays
 * removed either way.)
 *
 * The packages are the section's own (`model/packages.ts`,
 * founder ruling 2026-09-18); a template saved before that ruling has no
 * `options` yet and edits the starters, which land in the layout on the
 * first change. Section-level settings (layout, inclusions, CTA label)
 * live in the Style popover (`bars/section-style-popover.tsx`), not here.
 *
 * @module features/proposals/editor/data/edit-packages
 */
import { Plus } from 'lucide-react'

import type { PackagesSlots } from '@/lib/branding/public-blocks/proposal/packages'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { PackagesData } from '../../model/layout'
import { PACKAGE_LIMITS, newPackageOption, resolvePackageOptions } from '../../model/packages'
import type { ProposalTheme } from '../../model/theme'

import { packageCardSlots } from './edit-package-card'
import type { EditSlotArgs } from './edit-slot-args'
import { focusNewItem } from './focus-new-item'
import { setPackageOptions, type PackageCardArgs } from './package-args'

/** Builds the packages block's `PackagesSlots`: per-card editors and the add tile. */
export function packagesSlots(base: EditSlotArgs<PackagesData> & { branding: PublicBranding; theme: ProposalTheme; swatches: readonly string[] }): PackagesSlots {
  const { sectionId, data } = base
  const options = resolvePackageOptions(data)
  const args: PackageCardArgs = { ...base, options }

  return {
    card: (publicOption, index, isSelected) => {
      const option = options.find((o) => o.id === publicOption.id)
      return option ? packageCardSlots(args, option, index, isSelected) : {}
    },
    trailing: options.length >= PACKAGE_LIMITS.maxOptions ? null : (
      <AddPackageTile
        empty={options.length === 0}
        onAdd={() => {
          const option = newPackageOption()
          setPackageOptions(args, [...options, option], true)
          // The new card's first field is its title, the first `.ProseMirror` under the card's own `data-option-id`.
          focusNewItem(sectionId, option.id, 'data-option-id')
        }}
      />
    ),
  }
}

/** Props for {@link AddPackageTile}. */
export interface AddPackageTileProps {
  /** True when the section has no packages: the tile then also explains that the section is hidden on the sent proposal. */
  empty: boolean
  onAdd: () => void
}

/** A card-sized dashed tile that adds a package, sized by the same grid as the cards. */
export function AddPackageTile({ empty, onAdd }: AddPackageTileProps) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAdd() }}
      className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-control border border-dashed border-border-strong bg-surface-muted/40 p-6 text-body text-text-muted transition hover:bg-surface-emphasis hover:text-text"
    >
      <Plus size={20} strokeWidth={1.5} />
      Add package
      {empty ? <span className="text-text-subtle">No packages yet. This section is hidden on the sent proposal while empty.</span> : null}
    </button>
  )
}
