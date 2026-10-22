'use client'

/**
 * Packages slot builder: one editable card per package
 * (`edit-package-card.tsx`), and an "Add package" button under the grid
 * (`packagesAfter`, through `DataSectionSlots.after`, as Add testimonial
 * is). It was a card-sized tile in the grid until 2026-10-11: the tile
 * took a whole column, so two packages sat in thirds and their words
 * wrapped one to a line ("this looks terrible"). No heading and no text-below field (2026-09-19 feedback: "remove
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
import type { ReactNode } from 'react'

import type { PackagesSlots } from '@/lib/branding/public-blocks/proposal/packages'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { PackagesData } from '../../model/layout'
import { PACKAGE_LIMITS, newPackageOption, resolvePackageOptions } from '../../model/packages'
import type { ProposalTheme } from '../../model/theme'

import { packageCardSlots } from './edit-package-card'
import type { EditSlotArgs } from './edit-slot-args'
import { focusNewItem } from './focus-new-item'
import { setPackageOptions, type PackageCardArgs } from './package-args'

/** Builds the packages block's `PackagesSlots`: the per-card editors. Adding is {@link packagesAfter}, under the grid. */
export function packagesSlots(base: EditSlotArgs<PackagesData> & { branding: PublicBranding; theme: ProposalTheme; swatches: readonly string[] }): PackagesSlots {
  const options = resolvePackageOptions(base.data)
  const args: PackageCardArgs = { ...base, options }
  return {
    card: (publicOption, index, isSelected) => {
      const option = options.find((o) => o.id === publicOption.id)
      return option ? packageCardSlots(args, option, index, isSelected) : {}
    },
  }
}

/** The "Add package" button under the cards, or `null` at the card cap. */
export function packagesAfter(base: EditSlotArgs<PackagesData> & { branding: PublicBranding; theme: ProposalTheme; swatches: readonly string[] }): ReactNode {
  const { sectionId, data } = base
  const options = resolvePackageOptions(data)
  if (options.length >= PACKAGE_LIMITS.maxOptions) return null
  const args: PackageCardArgs = { ...base, options }
  return (
    <AddPackageButton
      empty={options.length === 0}
      onAdd={() => {
        const option = newPackageOption()
        setPackageOptions(args, [...options, option], true)
        // The new card's first field is its title, the first `.ProseMirror` under the card's own `data-option-id`.
        focusNewItem(sectionId, option.id, 'data-option-id')
      }}
    />
  )
}

/** Props for {@link AddPackageButton}. */
export interface AddPackageButtonProps {
  /** True when the section has no packages: a line above it then explains that the section is hidden on the sent proposal. */
  empty: boolean
  onAdd: () => void
}

/** The small "Add package" button under the grid, in Add testimonial's style. */
export function AddPackageButton({ empty, onAdd }: AddPackageButtonProps) {
  return (
    <>
      {empty ? <p className="mt-2 text-body text-text-subtle">No packages yet. This section is hidden on the sent proposal while empty.</p> : null}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAdd() }}
        className="mt-3 inline-flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-control bg-surface-emphasis px-3 text-body text-text hover:bg-surface-muted"
      >
        <Plus size={14} strokeWidth={1.5} />
        Add package
      </button>
    </>
  )
}
