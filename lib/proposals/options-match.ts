/**
 * Comparing the `proposal_options` rows a proposal already has with the
 * options its own layout now describes.
 *
 * A proposal's options are seeded once, at create time, from the template's
 * packages section. The MC then edits packages in the proposal's own
 * design, and those rows have to follow: the layout is what the couple
 * reads, but the rows are what the contract and the invoice are built from,
 * so a stale row is a wrong price rather than a cosmetic mismatch.
 *
 * Re-seeding means delete-and-reinsert (see `./write-options`), which mints
 * new row ids. The editor autosaves every 800ms, so doing that on every
 * keystroke would churn ids under a couple who has the page open, for no
 * gain. Hence this comparison: rewrite the rows only when the layout
 * actually says something different. Ids are deliberately not compared,
 * since the stored rows carry database uuids and the layout's cards carry
 * `pk-…` / `pi-…` editor ids that could never match.
 *
 * @module lib/proposals/options-match
 */
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types';
import type { Database } from '@/types/database';

/** The `proposal_option_items` columns that come from the layout, and so are worth comparing. */
export type StoredProposalOptionItem = Pick<
  Database['public']['Tables']['proposal_option_items']['Row'],
  'position' | 'description' | 'amount' | 'quantity' | 'is_addon' | 'default_included'
>;

/**
 * The `proposal_options` columns that come from the layout, with their
 * items embedded. `subtotal` is left out on purpose: it is derived from the
 * price fields by `replaceOptions`, so comparing it would only ever repeat
 * what the fields already said.
 */
export type StoredProposalOption = Pick<
  Database['public']['Tables']['proposal_options']['Row'],
  'position' | 'title' | 'description' | 'pricing_mode' | 'fixed_price' | 'gst_inclusive' | 'weekend_loading_percent' | 'is_popular'
> & { proposal_option_items: StoredProposalOptionItem[] };

/**
 * True when `stored` already says exactly what `desired` says, so there is
 * nothing to rewrite.
 *
 * @param stored - The proposal's current option rows, items embedded. Any order.
 * @param desired - What `packageOptionsToInputs(layoutPackageOptions(layout))` produced.
 */
export function optionsMatchLayout(
  stored: readonly StoredProposalOption[],
  desired: readonly ProposalOptionInput[],
): boolean {
  if (stored.length !== desired.length) return false;
  const rows = byPosition(stored);
  const wanted = byPosition(desired);
  return rows.every((row, index) => {
    const want = wanted[index];
    return want !== undefined && optionMatches(row, want);
  });
}

/** A copy sorted by `position`, so the two lists are compared in the order the couple reads them. */
function byPosition<T extends { position: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

/** One option's own fields plus every one of its items. */
function optionMatches(row: StoredProposalOption, want: ProposalOptionInput): boolean {
  if (row.title !== want.title) return false;
  if (text(row.description) !== text(want.description)) return false;
  if (row.pricing_mode !== want.pricingMode) return false;
  if (num(row.fixed_price) !== num(want.fixedPrice)) return false;
  if (row.gst_inclusive !== want.gstInclusive) return false;
  if (num(row.weekend_loading_percent) !== num(want.weekendLoadingPercent)) return false;
  if (row.is_popular !== want.isPopular) return false;
  const items = byPosition(row.proposal_option_items);
  const wantedItems = byPosition(want.items);
  if (items.length !== wantedItems.length) return false;
  return items.every((item, index) => {
    const wantItem = wantedItems[index];
    return wantItem !== undefined && itemMatches(item, wantItem);
  });
}

/** One line inside an option. `note` is not compared: nothing in the layout can set it. */
function itemMatches(row: StoredProposalOptionItem, want: ProposalItemInput): boolean {
  return row.description === want.description
    && num(row.amount) === num(want.amount)
    && num(row.quantity) === num(want.quantity)
    && row.is_addon === want.isAddon
    && row.default_included === want.defaultIncluded
    && row.position === want.position;
}

/** An empty description and no description are the same thing here, and the layout only ever produces the latter. */
function text(value: string | null): string {
  return value ?? '';
}

/**
 * A number column as a number. Postgres `numeric` reaches us as a JSON
 * number, but a driver or a view that hands back `"1400.00"` would
 * otherwise read as a difference on every single save.
 */
function num(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}
