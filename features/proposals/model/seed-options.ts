/**
 * Seeding a proposal's `proposal_options` rows from the template layout it
 * was created from (roadmap R3 §6.1, "Create").
 *
 * A template authors its packages inside the layout's `packages` section
 * (`./packages.ts`, founder ruling 2026-09-18). A proposal does not: its
 * cards are real `proposal_options` rows, because the couple accepts one
 * of them and the contract, invoice and totals are all built off that row.
 * These two pure functions are the bridge: read the cards out of a layout,
 * then map them to the option-input shape `replaceOptions` writes.
 *
 * Pure and React-free on purpose, so `createProposalFromTemplateAction`
 * stays a thin orchestration and the mapping itself is unit-testable
 * without a database.
 *
 * @module features/proposals/model/seed-options
 */
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types'

import { plainText } from './doc'
import type { ProposalLayout } from './layout'
import { resolvePackageOptions, type PackageOption } from './packages'

/** Matches a canonical v4 uuid, the only id shape `proposal_options` will accept as its own primary key. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The package cards a layout's first `packages` section carries, or `[]`
 * when it has none.
 *
 * First section only: a proposal has one set of options the couple chooses
 * between (D7), so a template with two packages sections seeds from the
 * one the couple meets first rather than concatenating both into a single,
 * meaningless list. `resolvePackageOptions` fills in the starters for a
 * section saved before packages lived in the block, which is what every
 * other surface renders for it too.
 */
export function layoutPackageOptions(layout: ProposalLayout): PackageOption[] {
  const section = layout.sections.find((s) => s.kind === 'packages')
  const data = section?.data
  if (!data || data.kind !== 'packages') return []
  return resolvePackageOptions(data.packages)
}

/**
 * Map template package cards to the builder's option-input shape, ready
 * for `replaceOptions`.
 *
 * Text is flattened to plain strings exactly as `toPublicOption` does:
 * `proposal_options.title` / `description` and
 * `proposal_option_items.description` are plain `text` columns, so the
 * card's rich doc cannot survive the copy. An empty title becomes
 * `'Untitled option'`, the same stand-in `toInput` in
 * `lib/proposals/form-mapping.ts` uses, since the column and the save
 * schema both want a non-empty title.
 *
 * @param options - The cards from {@link layoutPackageOptions}, in the order they appear on the canvas.
 */
export function packageOptionsToInputs(options: PackageOption[]): ProposalOptionInput[] {
  return options.map((option, index) => ({
    id: rowId(option.id),
    position: index + 1,
    title: plainText(option.title).trim() === '' ? 'Untitled option' : plainText(option.title),
    description: plainText(option.description) || null,
    // Nothing links these cards back to the packages library: they were
    // authored in the template, not picked from it.
    sourcePackageId: null,
    pricingMode: option.pricingMode,
    fixedPrice: option.fixedPrice,
    gstInclusive: option.gstInclusive,
    weekendLoadingPercent: option.weekendLoadingPercent,
    isPopular: option.isPopular,
    items: option.items.map((item, itemIndex): ProposalItemInput => ({
      id: rowId(item.id),
      description: plainText(item.description),
      // The card model has no per-line note; the MC adds one in the
      // proposal editor if they want it.
      note: null,
      amount: item.amount,
      quantity: item.quantity,
      isAddon: item.isAddon,
      defaultIncluded: item.defaultIncluded,
      position: itemIndex + 1,
    })),
  }))
}

/**
 * The id to carry into the option (or item) row: the card's own id when it
 * is already a uuid, else a `new-` sentinel the write path reads as
 * "insert me". Package ids are minted as `pk-…` / `pi-…`
 * (`newPackageOption`), so in practice this always mints, but reusing a
 * real uuid when one is there keeps a re-seed stable instead of churning
 * ids for no reason.
 */
function rowId(id: string): string {
  return UUID.test(id) ? id : `new-${crypto.randomUUID()}`
}
