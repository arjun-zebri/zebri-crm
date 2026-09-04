/**
 * Shared shape for the live preview pane — what the editor needs to
 * pass to each of the three preview tabs (PDF / Email / Payment page).
 *
 * The parent modal collects this object from local form state on every
 * render; each tab projects it into the format its renderer expects
 * (PublicContract, PublicInvoice, PublicDocData, email-template opts, etc.).
 *
 * @module components/builders/parts/preview-shared
 */

import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import type {
  ContractSigner,
  PublicContract,
} from '@/app/contract/[token]/_components/public-contract';
import type { PublicInvoice } from '@/app/invoice/[token]/_components/public-invoice';
import type { PublicBranding } from '@/lib/branding/public-branding';

export interface PreviewLineItem {
  id: string;
  description: string;
  /** Optional per-line note, shown under the description on the preview. */
  note?: string | null;
  amount: number;
}

export interface PreviewDiscount {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface PreviewDoc {
  kind: 'invoice' | 'contract';
  documentNumber: string;
  title: string;
  status: string;
  coupleName: string | null;
  businessName: string | null;
  items: PreviewLineItem[];
  taxRate: number;
  /** Invoice-only display flag: renders a "Prices include GST" note
   *  under the total. Never affects a computed amount. */
  gstInclusive?: boolean;
  discount: PreviewDiscount | null;
  notes: string | null;
  /** Contract-only: when the document expires. */
  expiresAt?: string | null;
  /** Invoice-only: when the invoice is due. */
  dueDate?: string | null;
  /** Invoice-only: payment stages when the MC enabled them. */
  paymentSchedule?: {
    stages: Array<{
      label: string;
      amountCents: number;
      dueDate: string | null;
      paidAt: string | null;
    }>;
  } | null;
  /** Invoice-only bank-transfer details (from user_metadata). */
  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  /** Public share link for the document. `null` until the document has
   *  been saved and given a share token — the email preview renders its
   *  CTA inert in that case rather than pointing at a URL that 404s. */
  shareUrl: string | null;
  /** Invoice-only: whether the Pay-with-card action will render on
   *  the public page. Controls the action block in the preview. */
  stripePaymentEnabled?: boolean;

  /* ── Contract-only fields ─────────────────────────────────── */
  /** Contract HTML rendered live from the editor (draft) OR the
   *  locked snapshot (sent+). Used by all three preview tabs. */
  contractHtml?: string;
  /** Server-side `locked_content_html` snapshot — when present,
   *  this is what couples actually see; PDF/Link tabs prefer it
   *  over the live `contractHtml`. */
  lockedHtml?: string | null;
  /** Signer info — surfaced in the PDF + Link tabs once signed. */
  signerName?: string | null;
  signedAt?: string | null;
  signerIp?: string | null;
  signerUserAgent?: string | null;
  /** MC's typed countersignature name (Caveat cursive). */
  mcSignatureName?: string | null;
  /**
   * The contract's real signers. Put on the DOC rather than passed per call
   * site because there are two of them (the right-pane preview and the PDF),
   * and when only one was given the roster they rendered different documents.
   */
  signers?: ContractSigner[];
  /**
   * The couple's two contacts, for the fallback roster on a contract whose
   * signer rows have not loaded. Kept separate from `coupleName`, which is the
   * COMBINED display name: using that put both people in one signature slot.
   */
  primaryName?: string | null;
  secondaryName?: string | null;
  /**
   * Contract meta the signature page and title block read. On the doc so the
   * right-pane preview and the PDF show identical values; the preview used to
   * hardcode nulls here while the PDF passed the real ones, which is why the
   * two documents did not match.
   */
  eventDate?: string | null;
  venue?: string | null;
  declinedAt?: string | null;
  declinedReason?: string | null;
  emailSentAt?: string | null;
}


/**
 * Project a builder `PreviewDoc` into the `PublicContract` shape the public
 * page renders from, so the modal's print and PDF preview go through the same
 * `ContractBrandedCard` as the signed link. One projection, not one per
 * consumer, so the two cannot disagree about a field.
 *
 * Fields the modal cannot know (signer roster, viewer) are empty: a draft has
 * no signatures to show, and a sent contract's roster only means something on
 * the public page.
 */
export function toPublicContract(
  doc: PreviewDoc,
  branding: PublicBranding,
  blocks: Block[],
  extra: {
    id: string;
    expiresAt: string | null;
    declinedAt: string | null;
    declinedReason: string | null;
    emailSentAt: string | null;
    eventDate: string | null;
    venue: string | null;
    /**
     * The contract's real signers, when the builder has loaded them. Without
     * these the per-party signature panels have nobody to render and the
     * preview would show an empty signature page, which is precisely the part
     * the MC is trying to lay out.
     */
    signers?: ContractSigner[];
    primaryName?: string | null;
    secondaryName?: string | null;
  },
): PublicContract {
  // Fill the roster PER PARTY rather than all-or-nothing.
  //
  // A draft has client signer rows from creation but no supplier row until it
  // is published, so an all-or-nothing fallback made the MC's own signature
  // block vanish from the preview the moment the real client rows loaded.
  // Every party the contract will eventually have is represented here, using
  // the real row wherever one exists.
  const emailSentAt = doc.emailSentAt ?? extra.emailSentAt
  const realSigners = doc.signers ?? extra.signers
  const primaryName = doc.primaryName ?? extra.primaryName
  const secondaryName = doc.secondaryName ?? extra.secondaryName

  const clients = (realSigners ?? [])
    .filter((s) => s.role === 'client')
    .slice()
    .sort((a, b) => a.signing_order - b.signing_order);

  const previewSigner = (
    id: string,
    role: 'vendor' | 'client',
    name: string,
    signingOrder: number,
    signedAt: string | null = null,
  ): ContractSigner => ({
    id,
    role,
    name,
    signer_name_typed: null,
    signing_order: signingOrder,
    required: true,
    signed_at: signedAt,
    declined_at: null,
  });

  // The supplier commits when the contract is issued, so the preview shows
  // that signature already in place.
  const vendorSigner =
    (realSigners ?? []).find((s) => s.role === 'vendor') ??
    previewSigner('preview-vendor', 'vendor', doc.mcSignatureName || 'You', 0, emailSentAt);

  // The couple's FIRST contact, never the combined display name.
  const primarySigner =
    clients[0] ??
    previewSigner('preview-primary', 'client', primaryName?.trim() || 'Primary contact', 1);

  // Only when the couple actually names a second contact, matching what
  // seed_contract_signers does on a real contract.
  const secondarySigner =
    clients[1] ??
    (secondaryName?.trim()
      ? previewSigner('preview-secondary', 'client', secondaryName.trim(), 2)
      : null);

  const signers: ContractSigner[] = [
    vendorSigner,
    primarySigner,
    ...(secondarySigner ? [secondarySigner] : []),
  ];

  return {
    ...branding,
    id: extra.id,
    title: doc.title,
    contract_number: doc.documentNumber,
    status: doc.status,
    locked_content_html: doc.lockedHtml || doc.contractHtml || null,
    expires_at: extra.expiresAt,
    signed_at: doc.signedAt ?? null,
    signer_name: doc.signerName ?? null,
    signer_ip: doc.signerIp ?? null,
    signer_user_agent: doc.signerUserAgent ?? null,
    declined_at: doc.declinedAt ?? extra.declinedAt,
    declined_reason: doc.declinedReason ?? extra.declinedReason,
    mc_signature_name: doc.mcSignatureName ?? null,
    email_sent_at: emailSentAt,
    couple_name: doc.coupleName ?? '',
    event_date: doc.eventDate ?? extra.eventDate,
    venue: doc.venue ?? extra.venue,
    branding_blocks: blocks,
    signers,
    viewer_signer_id: null,
  };
}

/**
 * Project a builder `PreviewDoc` into the `PublicInvoice` shape the public
 * page renders from. Same rationale as {@link toPublicContract}.
 */
export function toPublicInvoice(
  doc: PreviewDoc,
  branding: PublicBranding,
  blocks: Block[],
  extra: { id: string; paidAt: string | null; eventDate: string | null; venue: string | null },
): PublicInvoice {
  const subtotal = doc.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    ...branding,
    id: extra.id,
    invoice_number: doc.documentNumber,
    title: doc.title,
    status: doc.status,
    subtotal,
    tax_rate: doc.taxRate ?? 0,
    gst_inclusive: doc.gstInclusive ?? false,
    due_date: doc.dueDate ?? null,
    notes: doc.notes,
    paid_at: extra.paidAt,
    couple_name: doc.coupleName ?? '',
    event_date: extra.eventDate,
    venue: extra.venue,
    bank_account_name: doc.bankAccountName ?? null,
    bank_bsb: doc.bankBsb ?? null,
    bank_account_number: doc.bankAccountNumber ?? null,
    items: doc.items.map((item, i) => ({
      id: item.id,
      description: item.description,
      note: item.note ?? null,
      // The builder tracks a flat amount per line; the public shape also
      // carries qty/unit for tax invoices that itemise them. One-of-one.
      quantity: 1,
      unit_price: item.amount,
      amount: item.amount,
      position: i,
    })),
    stages: (doc.paymentSchedule?.stages ?? []).map((s, i) => ({
      id: `stage-${i}`,
      position: i,
      label: s.label,
      amount_cents: s.amountCents,
      due_date: s.dueDate,
      paid_at: s.paidAt,
    })),
    stripe_payment_enabled: false,
    stripe_connect_enabled: false,
    share_token: '',
    branding_blocks: blocks,
  };
}
