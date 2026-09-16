/**
 * Pure mapping helpers between the proposal builder's form state and the
 * database row shape (and vice versa).
 *
 * Kept free of React so `use-proposal-form.ts` (the hook that owns the
 * form's state + mutations) stays under the file-size guideline and this
 * mapping logic is independently unit-testable without rendering anything.
 *
 * @module lib/proposals/form-mapping
 */
import { toPlainJSON } from '@/lib/utils';
import type { Tables } from '@/types/database';

import type {
  ProposalItemInput,
  ProposalOptionInput,
  ProposalPricingMode,
  ProposalStatus,
  SaveProposalInput,
} from './types';

/** Editable form plus the read-only bits the shell and footer display. */
export interface ProposalFormState extends SaveProposalInput {
  status: ProposalStatus;
  proposalNumber: string | null;
  shareToken: string | null;
  shareTokenEnabled: boolean;
  emailSentAt: string | null;
  version: number;
}

/** Generated row shape for one option's item. */
export type ProposalOptionItemRow = Tables<'proposal_option_items'>;

/** Generated row shape for one option, with its items embedded. */
export type ProposalOptionRow = Tables<'proposal_options'> & {
  proposal_option_items: ProposalOptionItemRow[];
};

/**
 * Generated row shape for a proposal, with its options (and their items)
 * embedded, the shape `useProposalForm`'s detail query selects.
 */
export type ProposalRow = Tables<'proposals'> & {
  proposal_options: ProposalOptionRow[];
};

/** Map a fetched DB row into editable form state. */
export function fromRow(r: ProposalRow): ProposalFormState {
  return {
    proposalId: r.id,
    coupleId: r.couple_id,
    eventId: r.event_id,
    title: r.title,
    // `Json` (the generated column type) is deliberately broader than the
    // domain-specific `JSONContent` / `HeroOverride` shapes; the schema
    // validates the narrower shape on write, so it is safe to narrow here.
    introNote: r.intro_note as SaveProposalInput['introNote'],
    heroOverride: r.hero_override as SaveProposalInput['heroOverride'],
    expiresAt: r.expires_at,
    depositPercent: r.deposit_percent === null ? null : Number(r.deposit_percent),
    paymentScheduleId: r.payment_schedule_id,
    contractTemplateId: r.contract_template_id,
    options: [...r.proposal_options]
      .sort((a, b) => a.position - b.position)
      .map(
        (o): ProposalOptionInput => ({
          id: o.id,
          position: o.position,
          title: o.title,
          description: o.description,
          sourcePackageId: o.source_package_id,
          // The generated column type is the bare `string` Postgres reports;
          // the check constraint is what actually limits it to these two.
          pricingMode: o.pricing_mode as ProposalPricingMode,
          fixedPrice: o.fixed_price === null ? null : Number(o.fixed_price),
          gstInclusive: o.gst_inclusive,
          weekendLoadingPercent: o.weekend_loading_percent === null ? null : Number(o.weekend_loading_percent),
          isPopular: o.is_popular,
          items: [...o.proposal_option_items]
            .sort((a, b) => a.position - b.position)
            .map(
              (i): ProposalItemInput => ({
                id: i.id,
                description: i.description,
                note: i.note,
                amount: Number(i.amount),
                quantity: Number(i.quantity),
                isAddon: i.is_addon,
                defaultIncluded: i.default_included,
                position: i.position,
              }),
            ),
        }),
      ),
    status: r.status as ProposalStatus,
    proposalNumber: r.proposal_number,
    shareToken: r.share_token,
    shareTokenEnabled: r.share_token_enabled,
    emailSentAt: r.email_sent_at,
    version: r.version,
  };
}

/** Map editable form state to the server action's save payload. */
export function toInput(f: ProposalFormState): SaveProposalInput {
  return {
    proposalId: f.proposalId,
    coupleId: f.coupleId,
    eventId: f.eventId,
    title: f.title,
    // TipTap attrs are null-prototype objects; server actions drop them.
    introNote: f.introNote ? toPlainJSON(f.introNote) : null,
    heroOverride: f.heroOverride,
    expiresAt: f.expiresAt,
    depositPercent: f.depositPercent,
    paymentScheduleId: f.paymentScheduleId,
    contractTemplateId: f.contractTemplateId,
    // A blank add-on row (added then left untouched) has an empty
    // description; the schema requires min(1), so it must be dropped
    // here rather than surfacing as an opaque validation error on save.
    // An empty option title would fail the same way, so it falls back
    // to a placeholder instead of blocking the whole save.
    options: f.options.map((o) => ({
      ...o,
      title: o.title.trim() === '' ? 'Untitled option' : o.title,
      items: o.items.filter((it) => !it.isAddon || it.description.trim() !== ''),
    })),
  };
}
