/**
 * Inputs and the one write path shared by the packages editor's pieces
 * (`edit-packages.tsx`, `edit-package-card.tsx`, `package-card-menu.tsx`),
 * in their own module so none of them has to import another to reach
 * the section's `options`.
 *
 * @module features/proposals/editor/data/package-args
 */
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { PackagesData } from '../../model/layout'
import type { PackageOption } from '../../model/packages'
import type { ProposalTheme } from '../../model/theme'

import type { EditSlotArgs } from './edit-slot-args'

/** Inputs shared by every card in one packages section. */
export interface PackageCardArgs extends EditSlotArgs<PackagesData> {
  /** The section's resolved packages (`data.options`, or the starters for a template that predates them). */
  options: PackageOption[]
  branding: PublicBranding
  /** The canvas theme, handed to each field's `TextBar` (`InlineField`'s `richTextBar`). */
  theme: ProposalTheme
  /** Brand swatches offered by each field's `TextBar` colour picker. */
  swatches: readonly string[]
}

/** Writes a whole new `options` array to the section. */
export function setPackageOptions({ sectionId, data, dispatch }: EditSlotArgs<PackagesData>, options: PackageOption[], commit: boolean): void {
  dispatch({ type: 'setData', id: sectionId, data: { kind: 'packages', packages: { ...data, options } } }, { commit })
}
