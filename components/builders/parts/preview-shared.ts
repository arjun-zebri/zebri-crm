/**
 * Shared shape for the live preview pane — what the editor needs to
 * pass to each of the three preview tabs (PDF / Email / Payment page).
 *
 * The parent modal collects this object from local form state on every
 * render; each tab projects it into the format its renderer expects
 * (PdfDocumentData, PublicDocData, email-template opts, etc.).
 *
 * @module components/builders/parts/preview-shared
 */

import type { PdfDocumentData } from '@/lib/pdf/generate-pdf';

export interface PreviewLineItem {
  id: string;
  description: string;
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
}

/**
 * Project a live `PreviewDoc` into the shape the PDF renderer takes.
 *
 * Shared by the PDF preview tab and the builder modals' Download PDF
 * action, so the downloaded file is byte-identical to the preview the
 * MC was looking at when they clicked.
 *
 * Totals are recomputed here rather than read off the form: the modal
 * keeps discount/tax as inputs, and the PDF needs the resolved money.
 *
 * @param doc Live builder state.
 * @returns   `PdfDocumentData` for `buildPdfHtml` / `generateAndPrintPdf`.
 */
export function toPdfDocumentData(doc: PreviewDoc): PdfDocumentData {
  const subtotal = doc.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const discountAmount =
    doc.discount && doc.discount.value > 0
      ? doc.discount.type === 'percentage'
        ? (subtotal * doc.discount.value) / 100
        : doc.discount.value
      : 0;
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * ((doc.taxRate ?? 0) / 100);
  const total = taxableAmount + tax;

  return {
    type: doc.kind,
    documentNumber: doc.documentNumber,
    title: doc.title,
    status: doc.status,
    coupleName: doc.coupleName ?? '',
    ...(doc.businessName ? { businessName: doc.businessName } : {}),
    items: doc.items.map((item) => ({
      description: item.description,
      amount: item.amount,
    })),
    subtotal,
    discountType: doc.discount?.type ?? null,
    discountValue: doc.discount?.value ?? null,
    taxRate: doc.taxRate,
    ...(doc.gstInclusive ? { gstInclusive: true } : {}),
    total,
    notes: doc.notes,
    ...(doc.kind === 'invoice' ? { dueDate: doc.dueDate ?? null } : {}),
    ...(doc.kind === 'invoice' && doc.bankAccountName
      ? { bankAccountName: doc.bankAccountName }
      : {}),
    ...(doc.kind === 'invoice' && doc.bankBsb ? { bankBsb: doc.bankBsb } : {}),
    ...(doc.kind === 'invoice' && doc.bankAccountNumber
      ? { bankAccountNumber: doc.bankAccountNumber }
      : {}),
    // Contract-only: thread the body HTML (locked snapshot wins
    // when present, otherwise the live editor render), plus signer
    // info so the PDF includes the audit trail.
    ...(doc.kind === 'contract'
      ? {
          contractHtml: doc.lockedHtml || doc.contractHtml || '',
          signerName: doc.signerName ?? null,
          signedAt: doc.signedAt ?? null,
          signerIp: doc.signerIp ?? null,
          signerUserAgent: doc.signerUserAgent ?? null,
          mcSignatureName: doc.mcSignatureName ?? null,
        }
      : {}),
  };
}
