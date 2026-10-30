/**
 * Build the `PublicDocData` a proposal TEMPLATE previews as, before any
 * proposal row exists.
 *
 * The Send a proposal modal shows the MC the page their couple will open,
 * assembled from the template alone: the template's layout carries every
 * word, and its packages section carries the cards that
 * `createProposalFromTemplateAction` will turn into real
 * `proposal_options` rows. Only the couple's own details (name, date,
 * venue) and the expiry are filled in from outside the template, because
 * those are the only things that differ between one send and the next.
 *
 * Mirrors `./preview-proposal.ts` (the same "public payload from unsaved
 * state" job for the legacy v1 builder) and `./sample-proposal.ts`
 * field for field; the difference is the source, a template layout rather
 * than a form. Pure and React-free so the modal stays thin and this
 * mapping is unit-testable on its own.
 *
 * @module lib/proposals/template-preview-doc
 */
// eslint-disable-next-line no-restricted-imports -- the layout model and its package cards live in features/proposals; this is the one adapter turning a template layout into the couple-facing payload, so the modal never learns the feature's internals.
import { layoutPackageOptions, toPublicOption, type ProposalLayout } from '@/features/proposals';
import type { PublicDocData } from '@/lib/branding/public-blocks/shared';
import type { PublicBranding } from '@/lib/branding/public-branding';

import { toPublicDoc, type PublicProposal } from './public-types';

/** Stands in for the title while no couple is chosen and the template is unnamed. Matches `preview-proposal.ts`. */
const PLACEHOLDER_TITLE = 'Untitled proposal';
/** Stands in for the proposal number: the real one is minted server-side on create. Matches `preview-proposal.ts`. */
const PLACEHOLDER_PROPOSAL_NUMBER = 'Draft';
/** Stands in for the couple's name while none is chosen. Matches `preview-proposal.ts`. */
const PLACEHOLDER_COUPLE_NAME = 'Your couple';

/** Everything {@link templatePreviewDoc} needs. See the module doc for why so little of it comes from outside the template. */
export interface TemplatePreviewDocInput {
  /** The template's layout, rendered as-is: every section, word and package card the couple will meet. */
  layout: ProposalLayout;
  /** The template's name, used as the document title until a couple is chosen. */
  templateName: string;
  /** The MC's resolved branding, spread onto the proposal (the shape a real `PublicProposal` extends `PublicBranding` with). */
  branding: PublicBranding;
  /** The chosen couple's display name, or `null` when none is chosen yet. */
  coupleName: string | null;
  /** The couple's wedding date (`YYYY-MM-DD`), for the `event_date` variable. */
  eventDate: string | null;
  /** The couple's venue, for the `venue` variable. */
  venue: string | null;
  /** The expiry the proposal would be created with (`YYYY-MM-DD`). */
  expiresAt: string | null;
  /**
   * The deposit the proposal would be created with, from the template's
   * own settings or the account's. It only feeds the `deposit_percent`
   * variable, but a template that prints "a {{ deposit_percent }}% deposit"
   * would otherwise preview with a hole in the sentence.
   */
  depositPercent: number | null;
}

/**
 * The couple-facing payload the modal's preview renders.
 *
 * @param input - See {@link TemplatePreviewDocInput}. No couple selected
 *   is a valid input: the placeholder wording matches `preview-proposal.ts`
 *   so the two previews read the same way before a couple is picked.
 */
export function templatePreviewDoc(input: TemplatePreviewDocInput): PublicDocData {
  const coupleName = input.coupleName?.trim() || null;
  const today = new Date().toISOString().slice(0, 10);
  const proposal: PublicProposal = {
    ...input.branding,
    id: 'template-preview',
    // The same title `createProposalFromTemplateAction` will store, so the
    // preview is not quietly showing something the couple never sees. With
    // no couple yet there is nothing to build it from, so the template's
    // own name stands in rather than a half-written sentence.
    title: coupleName ? `${coupleName}, your wedding` : input.templateName.trim() || PLACEHOLDER_TITLE,
    proposal_number: PLACEHOLDER_PROPOSAL_NUMBER,
    status: 'draft',
    version: 1,
    // A v2 layout authors its own words; the v1 intro note and hero
    // override are not part of a template (founder ruling 2026-09-22: the
    // note "should just come from the template").
    intro_note: null,
    hero_override: null,
    expires_at: input.expiresAt,
    // Mirrors `toPublicProposal`'s own check, so an MC who picks a past
    // expiry sees the expired copy their couple would get instead of the
    // preview silently staying on the open chooser.
    expired: input.expiresAt !== null && input.expiresAt < today,
    // The same figure `createProposalFromTemplateAction` will store: the
    // caller resolves it from the template's settings, falling back to the
    // account's, exactly as the server does.
    deposit_percent: input.depositPercent,
    // Nothing has been created, let alone accepted or declined: the
    // preview always shows the open (or expired) chooser.
    accepted_option_id: null,
    accepted_addon_selection: null,
    accepted_at: null,
    declined_at: null,
    couple_name: coupleName ?? PLACEHOLDER_COUPLE_NAME,
    event_date: input.eventDate,
    venue: input.venue,
    // `map` passes the index as the second argument, which is exactly the
    // `position` `toPublicOption` wants: cards render in canvas order.
    options: layoutPackageOptions(input.layout).map(toPublicOption),
    branding_blocks: null,
    // A preview is never a live close session (mirrors `sampleProposal`).
    pending_contract: null,
    invoice: null,
    stripe_connect_enabled: false,
  };
  return toPublicDoc(proposal);
}
