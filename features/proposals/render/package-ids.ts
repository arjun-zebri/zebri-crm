/**
 * Stamping a sent proposal's own row ids onto the layout's package cards.
 *
 * A proposal created from a template carries the template's `layout`, and
 * the couple's page renders that layout's own package cards (their CTA
 * label and colours, price frequency, decimals and the section's styling
 * all live on the card, and are lost the moment you render the DB rows
 * instead). The cards' ids, though, are the ones the template editor
 * minted (`pk-starter-1`, `pi-…`), while `POST /api/proposal/accept`
 * takes uuids and `finalize_proposal_acceptance` works from
 * `proposal_options` / `proposal_option_items`. Rendered as authored, the
 * couple can read the proposal and cannot accept it (live bug, 2026-09-23).
 *
 * So the page keeps the layout's presentation and swaps in the proposal's
 * own ids, matched BY POSITION: `packageOptionsToInputs`
 * (`model/seed-options.ts`) writes card `i` as the row at position `i + 1`
 * and item `j` as that row's item at position `j + 1`, so position is the
 * only link the two sides genuinely share (the ids deliberately differ,
 * and titles are free text an MC may have edited on either side since).
 *
 * Position is a link, not a guarantee: an MC who edits the template after
 * sending, or the proposal's options after creating it, breaks it. Hence
 * the strict count guard and the caller's fallback to the rows themselves
 * - a plainer card the couple can still accept beats a pretty one they
 * cannot.
 *
 * Pure and React-free on purpose: the rule lives here and is unit-tested
 * without a render.
 *
 * @module features/proposals/render/package-ids
 */
import type { PublicProposalItem, PublicProposalOption } from '@/lib/proposals/public-types'

/**
 * Where a rendered packages section takes its card ids from. `'layout'` is
 * every template surface (the editor canvas, the Preview overlay, the
 * thumbnail, the Send modal's preview), which has no proposal rows to
 * borrow from; `'proposal'` is a real, sent proposal's page and its PDF.
 */
export type PackageIdSource = 'layout' | 'proposal'

/**
 * The outcome of {@link withProposalOptionIds}. `ok: false` is not an
 * error to swallow: the caller renders the proposal's own option rows
 * instead (correct ids, plainer presentation) and reports `reason`.
 */
export type PackageIdMapping =
  | { ok: true; options: PublicProposalOption[] }
  | { ok: false; reason: string }

/**
 * Re-id one card's priced lines from its option row.
 *
 * Add-ons and inclusions are matched within their own kind rather than
 * across the whole list, because the two sides only have to agree on what
 * each line *is*: `addonIds` in the accept schema must be real
 * `proposal_option_items` uuids for add-on lines specifically, and an
 * inclusion id that landed on an add-on line would be accepted by the
 * schema and charged as the wrong thing.
 *
 * Row items are read in `position` order: `PublicProposalOption.items`
 * arrives straight from the RPC and only the options themselves are
 * sorted on the way in (`toPublicDoc`).
 */
function itemIdsFromRow(
  card: PublicProposalOption,
  row: PublicProposalOption,
  position: number,
): { items: PublicProposalItem[] } | { reason: string } {
  const rowItems = [...row.items].sort((a, b) => a.position - b.position)
  const rowAddons = rowItems.filter((i) => i.is_addon)
  const rowInclusions = rowItems.filter((i) => !i.is_addon)
  const cardAddons = card.items.filter((i) => i.is_addon).length
  const cardInclusions = card.items.filter((i) => !i.is_addon).length
  if (cardAddons !== rowAddons.length) {
    return { reason: `card ${position} has ${cardAddons} add-on lines against ${rowAddons.length} on its option row` }
  }
  if (cardInclusions !== rowInclusions.length) {
    return { reason: `card ${position} has ${cardInclusions} inclusion lines against ${rowInclusions.length} on its option row` }
  }
  let addon = 0
  let inclusion = 0
  // Both counters stay in range: the two guards above proved each kind has
  // exactly as many rows as the card has lines of that kind.
  const items = card.items.map((item) => ({ ...item, id: item.is_addon ? rowAddons[addon++]!.id : rowInclusions[inclusion++]!.id }))
  return { items }
}

/**
 * The layout's package cards carrying the proposal's own option and item
 * ids, or a reason the two could not be lined up.
 *
 * Everything else about each card is kept exactly as authored, so the
 * couple sees the template's presentation and the accept path sees ids it
 * can close on. Nothing is partially substituted: one mismatched card
 * fails the whole mapping, since a page where some cards can be accepted
 * and others silently cannot is worse than a plain one that works.
 *
 * @param cards - The section's own packages, already adapted with `toPublicOption`, in canvas order.
 * @param rows - The proposal's `proposal_options`, in position order (`doc.proposal.options`).
 */
export function withProposalOptionIds(
  cards: readonly PublicProposalOption[],
  rows: readonly PublicProposalOption[] | undefined,
): PackageIdMapping {
  if (!rows || rows.length === 0) return { ok: false, reason: 'the proposal has no option rows' }
  if (cards.length !== rows.length) return { ok: false, reason: `${cards.length} layout cards against ${rows.length} option rows` }
  const options: PublicProposalOption[] = []
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!
    const row = rows[i]!
    const mapped = itemIdsFromRow(card, row, i + 1)
    if ('reason' in mapped) return { ok: false, reason: mapped.reason }
    options.push({ ...card, id: row.id, items: mapped.items })
  }
  return { ok: true, options }
}
