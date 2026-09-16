/**
 * Domain types for proposals, shared by the dashboard, the builder, and the
 * public page. Row shapes come from the generated `Database` types; these
 * are the camelCase view-model forms the UI works in.
 *
 * @module lib/proposals/types
 */
import type { JSONContent } from '@tiptap/core';

/** Lifecycle status. `expired` is stamped by the Phase C cron; the public
 *  page derives expiry from `expires_at` so it never trusts this alone. */
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

/** How a proposal option's base price is calculated: line items (itemised) or fixed amount (single). */
export type ProposalPricingMode = 'itemised' | 'single';

/** One line inside an option. `isAddon` lines are toggled by the couple. */
export interface ProposalItemInput {
  /** DB uuid, or a `new-<uuid>` sentinel the action strips before insert. */
  id: string;
  description: string;
  note: string | null;
  amount: number;
  quantity: number;
  isAddon: boolean;
  defaultIncluded: boolean;
  position: number;
}

/** A package snapshot the couple can choose (D7: one of up to three). */
export interface ProposalOptionInput {
  id: string;
  position: number;
  title: string;
  description: string | null;
  sourcePackageId: string | null;
  pricingMode: ProposalPricingMode;
  fixedPrice: number | null;
  gstInclusive: boolean;
  weekendLoadingPercent: number | null;
  isPopular: boolean;
  items: ProposalItemInput[];
}

/** Per-proposal hero background override (rendered from Phase B). */
export interface HeroOverride {
  // `| undefined` on every optional field: under exactOptionalPropertyTypes,
  // Zod's `.optional()` output type is `T | undefined`, not just an absent
  // key, so the schema's inferred type only matches this interface when the
  // fields say so explicitly.
  imagePath?: string | undefined;
  videoPath?: string | undefined;
  embedUrl?: string | undefined;
}

/** Full save payload. Every field is explicit: an omitted field would be
 *  erased by a defaulting schema, which is the bug class the couples
 *  update mutation hit. */
export interface SaveProposalInput {
  proposalId: string | null;
  coupleId: string;
  eventId: string | null;
  title: string;
  introNote: JSONContent | null;
  heroOverride: HeroOverride | null;
  expiresAt: string | null;
  depositPercent: number | null;
  paymentScheduleId: string | null;
  contractTemplateId: string | null;
  options: ProposalOptionInput[];
}

/** Which services the MC sells; drives the proposal starter design and sample packages (D12). */
export type ProposalRole = 'mc' | 'celebrant' | 'both';

/** Every {@link ProposalRole} value, in the order shown in role pickers. */
export const PROPOSAL_ROLES: readonly ProposalRole[] = ['mc', 'celebrant', 'both'];

/** Display label + one-line description for each {@link ProposalRole}. */
export const PROPOSAL_ROLE_LABELS: Record<ProposalRole, { label: string; description: string }> = {
  mc: { label: 'MC', description: 'Run sheets, speeches, keeping the night on track' },
  celebrant: { label: 'Celebrant', description: 'Ceremony writing, legal paperwork, the rehearsal' },
  both: { label: 'MC and Celebrant', description: 'The whole day, ceremony to last dance' },
};
