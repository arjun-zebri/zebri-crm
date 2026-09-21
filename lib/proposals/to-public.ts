/**
 * Map the dashboard's full print row to the public `PublicProposal` shape,
 * so the "Download PDF" path on `/proposals/[id]` renders through the exact
 * same `ProposalPage` the couple's `/proposal/[token]` link uses. There is
 * no second PDF layout: the file is the link.
 *
 * @module lib/proposals/to-public
 */
// eslint-disable-next-line no-restricted-imports -- type-only; the block AST lives with the editor
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
// eslint-disable-next-line no-restricted-imports -- type-only; the print row is owned by the dashboard data hook
import type { ProposalPrintRow } from '@/app/(dashboard)/proposals/use-proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';
import type { PublicProposal, PublicProposalItem, PublicProposalOption } from '@/lib/proposals/public-types';
import type { ProposalPricingMode } from '@/lib/proposals/types';

/** One DB option row (with its nested item rows) to the public option shape, items sorted by position. */
function toPublicOption(o: ProposalPrintRow['proposal_options'][number]): PublicProposalOption {
  return {
    id: o.id,
    position: o.position,
    title: o.title,
    description: o.description,
    pricing_mode: o.pricing_mode as ProposalPricingMode,
    fixed_price: o.fixed_price,
    gst_inclusive: o.gst_inclusive,
    weekend_loading_percent: o.weekend_loading_percent,
    is_popular: o.is_popular,
    subtotal: o.subtotal,
    items: [...o.proposal_option_items]
      .sort((a, b) => a.position - b.position)
      .map(
        (i): PublicProposalItem => ({
          id: i.id,
          description: i.description,
          note: i.note,
          amount: i.amount,
          quantity: i.quantity,
          is_addon: i.is_addon,
          default_included: i.default_included,
          position: i.position,
        }),
      ),
  };
}

/**
 * Build the public payload the couple's page renders from the dashboard's
 * full row, for the "Download PDF" path.
 *
 * `expired` mirrors `get_public_proposal` exactly: no status clause. That
 * looks like it would re-open an accepted proposal once its `expires_at`
 * passes, but `deriveState` (which the page actually branches on) already
 * ranks `accepted` above `expired`, so the couple never sees this as
 * lapsed; the RPC's own derivation carries the same quirk.
 */
export function toPublicProposal(row: ProposalPrintRow, branding: PublicBranding, blocks: Block[]): PublicProposal {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...branding,
    id: row.id,
    title: row.title,
    proposal_number: row.proposal_number,
    status: row.status,
    version: row.version,
    intro_note: row.intro_note,
    hero_override: row.hero_override,
    expires_at: row.expires_at,
    expired: row.expires_at !== null && row.expires_at < today,
    deposit_percent: row.deposit_percent,
    accepted_option_id: row.accepted_option_id,
    accepted_addon_selection: row.accepted_addon_selection,
    accepted_at: row.accepted_at,
    declined_at: row.declined_at,
    couple_name: row.couple?.name ?? '',
    event_date: row.couple?.event_date ?? null,
    venue: row.couple?.venue ?? null,
    options: [...row.proposal_options].sort((a, b) => a.position - b.position).map(toPublicOption),
    branding_blocks: blocks,
    // The PDF print path never signs a contract or takes a payment, so the
    // close-flow fields are always empty: the rendered page is a snapshot,
    // not a live session the couple can act on.
    pending_contract: null,
    invoice: null,
    stripe_connect_enabled: false,
  };
}
