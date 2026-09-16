/**
 * Payload type for `get_public_proposal(token)` plus the page state
 * machine. The RPC is the security boundary; nothing here re-checks.
 *
 * Moved from `app/proposal/[token]/_components/public-proposal.ts` (Phase B
 * Task 3) so `lib/branding` renderers can build a `PublicDocData.proposal`
 * from this shape without reaching into `app/`. That file now re-exports
 * from here for the page and its existing imports.
 *
 * Note: this module imports `PublicDocData` from
 * `@/lib/branding/public-blocks/shared`, and `shared.ts` imports
 * `PublicProposalOption` from here. Both imports are `import type`, so the
 * cycle is erased at compile time and never exists at runtime.
 *
 * @module lib/proposals/public-types
 */
import type { JSONContent } from '@tiptap/core';

// eslint-disable-next-line no-restricted-imports -- type-only; the block AST lives with the editor
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import type { PublicDocData } from '@/lib/branding/public-blocks/shared';
import type { PublicBranding } from '@/lib/branding/public-surface';
import type { PendingContract, PublicProposalInvoice } from '@/lib/proposals/close-types';
import type { HeroOverride, ProposalPricingMode, ProposalStatus } from '@/lib/proposals/types';

export interface PublicProposalItem {
  id: string;
  description: string;
  note: string | null;
  amount: number;
  quantity: number;
  is_addon: boolean;
  default_included: boolean;
  position: number;
}

export interface PublicProposalOption {
  id: string;
  position: number;
  title: string;
  description: string | null;
  pricing_mode: ProposalPricingMode;
  fixed_price: number | null;
  gst_inclusive: boolean;
  weekend_loading_percent: number | null;
  is_popular: boolean;
  subtotal: number;
  items: PublicProposalItem[];
}

export interface PublicProposal extends PublicBranding {
  id: string;
  title: string;
  proposal_number: string;
  status: ProposalStatus;
  version: number;
  intro_note: JSONContent | null;
  hero_override: HeroOverride | null;
  expires_at: string | null;
  expired: boolean;
  deposit_percent: number | null;
  accepted_option_id: string | null;
  accepted_addon_selection: string[] | null;
  accepted_at: string | null;
  declined_at: string | null;
  couple_name: string;
  event_date: string | null;
  venue: string | null;
  options: PublicProposalOption[];
  branding_blocks: Block[] | null;
  /** Draft contract awaiting signature, once an option is accepted; null until then and null again once signed. */
  pending_contract: PendingContract | null;
  /** The invoice `finalize_proposal_acceptance` created, once the contract is signed. */
  invoice: PublicProposalInvoice | null;
  /** Whether the MC has Stripe Connect wired up, so the pay step can offer a card payment. */
  stripe_connect_enabled: boolean;
}

/** The couple-facing lifecycle state {@link deriveState} computes from a `PublicProposal`. */
export type ProposalPageState = 'active' | 'signing' | 'paying' | 'accepted' | 'expired' | 'declined';

/**
 * Rank the couple-facing lifecycle state from the raw payload.
 *
 * Once accepted, the deal is done, so accepted-vs-declined-vs-expired never
 * matters again: the only question left is whether the deposit stage is
 * still unpaid (`'paying'`) or fully settled (`'accepted'`). Before
 * acceptance, declined and expired are terminal and outrank a lingering
 * unsigned contract, so a declined proposal never shows a sign prompt even
 * if `pending_contract` was left set.
 */
export function deriveState(p: PublicProposal): ProposalPageState {
  if (p.accepted_at) {
    const stage = p.invoice?.first_stage;
    return p.invoice && !p.invoice.paid_at && stage && !stage.paid_at ? 'paying' : 'accepted';
  }
  if (p.declined_at) return 'declined';
  if (p.expired) return 'expired';
  if (p.pending_contract) return 'signing';
  return 'active';
}

/**
 * The proposal slice of `PublicDocData`. Built once per page from the RPC
 * payload; the packages / accept / introNote renderers read it and the hero
 * reads `heroOverride`.
 */
export function toPublicDoc(p: PublicProposal): PublicDocData {
  const state = deriveState(p);
  return {
    title: p.title,
    refNumber: p.proposal_number,
    coupleName: p.couple_name,
    eventDate: p.event_date,
    venue: p.venue,
    expiresAt: p.expires_at,
    expiresLabel: 'Expires',
    items: [],
    subtotal: 0,
    taxRate: 0,
    proposal: {
      options: [...p.options].sort((a, b) => a.position - b.position),
      introNote: p.intro_note,
      depositPercent: p.deposit_percent,
      heroOverride: p.hero_override,
      expired: p.expired,
      state: state === 'active' ? 'open' : state,
      proposalNumber: p.proposal_number,
      acceptedOptionId: p.accepted_option_id,
      acceptedAddonIds: p.accepted_addon_selection ?? [],
      acceptedAt: p.accepted_at,
    },
  };
}
