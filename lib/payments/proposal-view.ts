/**
 * Shared types + pure helpers for every surface that renders a
 * proposal the way the couple sees it: the public page
 * (`/proposal/[token]`), the composer's live preview, and the
 * branding editor's Proposal surface.
 *
 * The shape is the JSONB payload from `get_public_proposal(token)`:
 * proposal fields + ordered options (each with ordered items) +
 * scalar branding merged via `_user_branding`. Block-tree custom
 * layouts are deliberately NOT supported for proposals — a block tree
 * can't express the option chooser — so every surface renders the
 * same scalar-branded layout ({@link ProposalPageView} in
 * `components/proposal/`).
 *
 * @module lib/payments/proposal-view
 */
import type { ProposalLabels } from '@/lib/branding/proposal-labels';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { isPastDue } from '@/lib/utils';

export interface PublicProposalItem {
  id: string;
  description: string;
  amount: number;
  is_addon: boolean;
  default_included: boolean;
  position: number;
}

export interface PublicProposalOption {
  id: string;
  title: string;
  description: string | null;
  deposit_percent: number | null;
  gst_inclusive: boolean;
  /** "Most popular" highlight — badged in the chooser, but only when
   *  the proposal offers more than one option. */
  is_popular: boolean;
  /** Base (non-add-on) items total. */
  subtotal: number;
  position: number;
  items: PublicProposalItem[];
}

export interface PublicProposal extends PublicBranding {
  id: string;
  title: string;
  proposal_number: string;
  status: string;
  notes: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_option_id: string | null;
  accepted_addon_selection: Record<string, boolean> | null;
  couple_name: string;
  options: PublicProposalOption[];
}

export type PageState =
  | 'loading'
  | 'not_found'
  | 'active'
  | 'expired'
  | 'accepted'
  | 'declined';

export function deriveState(proposal: PublicProposal | null): PageState {
  if (!proposal) return 'not_found';
  if (proposal.status === 'accepted') return 'accepted';
  if (proposal.status === 'declined') return 'declined';
  if (isPastDue(proposal.expires_at)) return 'expired';
  return 'active';
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(n);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Base items of an option, in position order. */
export function baseItems(option: PublicProposalOption): PublicProposalItem[] {
  return option.items.filter((i) => !i.is_addon);
}

/** Add-on items of an option, in position order. */
export function addOnItems(option: PublicProposalOption): PublicProposalItem[] {
  return option.items.filter((i) => i.is_addon);
}

/** The MC's pre-ticks as the couple's starting selection. */
export function defaultSelection(option: PublicProposalOption): Record<string, boolean> {
  const selection: Record<string, boolean> = {};
  for (const addOn of addOnItems(option)) selection[addOn.id] = addOn.default_included;
  return selection;
}

/** Live total for an option under a selection: base + ticked add-ons. */
export function selectionTotal(
  option: PublicProposalOption,
  selection: Record<string, boolean>,
): number {
  return option.items.reduce(
    (sum, item) => sum + (!item.is_addon || selection[item.id] ? Number(item.amount) : 0),
    0,
  );
}

/** The scalar branding a proposal view renders from — the subset of
 *  {@link PublicBranding} the layout actually uses, resolved to
 *  ready-to-apply values (font stacks, not font names). */
export interface ProposalViewBranding {
  pageBg: string;
  textColor: string;
  mutedColor: string;
  brand: string;
  /** Secondary highlight — the "most popular" badge + that card's tint. */
  accent: string;
  /** Surface + text for the price summary panel. */
  secondaryColor: string;
  secondaryTextColor: string;
  radius: number;
  headingFontFamily: string | undefined;
  bodyFontFamily: string | undefined;
  headingWeight: number;
  /** Multiplies every text size on the page (0.85–1.2). */
  fontScale: number;
  /** Extra horizontal inset (px) on top of the surface's base padding. */
  docPadding: number;
  logoUrl: string | null;
  headerImageUrl: string | null;
  /** Plain text (public payloads may carry HTML — strip before passing). */
  businessName: string | null;
  tagline: string | null;
  abn: string | null;
  /** Editable section wording (resolved with defaults). */
  labels: ProposalLabels;
}
