/**
 * Map the proposal builder's live, in-progress form state into a
 * `PublicProposal`, so the builder modal can render the exact same
 * `ProposalPage` the couple will see, before anything is saved or sent.
 *
 * Mirrors `toPublicProposal` (`lib/proposals/to-public.ts`, the saved-row to
 * public-payload mapping) field for field, but reads from the camelCase
 * `ProposalFormState` instead of a fetched DB row, and never needs a couple
 * lookup of its own (the caller already has the couple selector's name).
 *
 * @module lib/proposals/preview-proposal
 */
import type { PublicBranding } from '@/lib/branding/public-branding';

import type { ProposalFormState } from './form-mapping';
import { optionBaseSubtotal } from './pricing';
import type { PublicProposal, PublicProposalItem, PublicProposalOption } from './public-types';
import type { ProposalItemInput, ProposalOptionInput } from './types';

/** Shown instead of a blank title for a draft the MC hasn't named yet. */
const PLACEHOLDER_TITLE = 'Untitled proposal';
/** Shown instead of a blank proposal number: unsaved drafts have none yet. */
const PLACEHOLDER_PROPOSAL_NUMBER = 'Draft';
/** Shown instead of a blank couple name when no couple is selected yet. */
const PLACEHOLDER_COUPLE_NAME = 'Your couple';

/** One form item to the public shape. */
function previewItem(item: ProposalItemInput): PublicProposalItem {
  return {
    id: item.id,
    description: item.description,
    note: item.note,
    amount: item.amount,
    quantity: item.quantity,
    is_addon: item.isAddon,
    default_included: item.defaultIncluded,
    position: item.position,
  };
}

/**
 * One form option to the public shape, items sorted by position.
 *
 * `subtotal` is denormalised on the DB row rather than derived by the
 * renderer, so this recomputes it with the exact same formula the save path
 * uses (`app/(dashboard)/proposals/write-options.ts`): a `single`-priced
 * option's subtotal is its fixed price, an `itemised` option's is the sum of
 * its non add-on lines.
 */
function previewOption(option: ProposalOptionInput): PublicProposalOption {
  return {
    id: option.id,
    position: option.position,
    title: option.title,
    description: option.description,
    pricing_mode: option.pricingMode,
    fixed_price: option.fixedPrice,
    gst_inclusive: option.gstInclusive,
    weekend_loading_percent: option.weekendLoadingPercent,
    is_popular: option.isPopular,
    subtotal: option.pricingMode === 'single' ? (option.fixedPrice ?? 0) : optionBaseSubtotal(option.items),
    items: [...option.items].sort((a, b) => a.position - b.position).map(previewItem),
  };
}

/**
 * Build the `PublicProposal` the builder's preview pane renders, from the
 * form's current (possibly unsaved) state.
 *
 * @param form - The builder's live form state.
 * @param branding - The MC's resolved branding, spread onto the proposal
 *   (the shape a real `PublicProposal` extends `PublicBranding` with).
 * @param coupleName - The selected couple's display name, or null when no
 *   couple is chosen yet.
 */
export function previewProposal(
  form: ProposalFormState,
  branding: PublicBranding,
  coupleName: string | null,
): PublicProposal {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...branding,
    id: form.proposalId ?? 'draft',
    title: form.title.trim() || PLACEHOLDER_TITLE,
    proposal_number: form.proposalNumber ?? PLACEHOLDER_PROPOSAL_NUMBER,
    status: form.status,
    version: form.version,
    intro_note: form.introNote,
    hero_override: form.heroOverride,
    expires_at: form.expiresAt,
    // Mirrors `toPublicProposal`'s own check, so an MC who sets a past
    // expiry sees the same "expired" copy the couple would see instead of
    // the preview silently staying on the open chooser.
    expired: form.expiresAt !== null && form.expiresAt < today,
    deposit_percent: form.depositPercent,
    // Nothing in the form tracks acceptance/decline: a draft being edited
    // never carries that state, so the preview always shows the open (or
    // expired) chooser, never a locked accepted/declined screen.
    accepted_option_id: null,
    accepted_addon_selection: null,
    accepted_at: null,
    declined_at: null,
    couple_name: coupleName?.trim() ? coupleName.trim() : PLACEHOLDER_COUPLE_NAME,
    // Not collected by this form (only `coupleId`); the couple's event date
    // and venue live on the couple record itself, not the proposal draft.
    event_date: null,
    venue: null,
    options: [...form.options].sort((a, b) => a.position - b.position).map(previewOption),
    branding_blocks: null,
    // A preview is never a live close session (mirrors `sampleProposal`).
    pending_contract: null,
    invoice: null,
    stripe_connect_enabled: false,
  };
}
