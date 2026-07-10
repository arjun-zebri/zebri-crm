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
  discount: PreviewDiscount | null;
  notes: string | null;
  /** Contract-only: when the document expires. */
  expiresAt?: string | null;
  /** Invoice-only: when the invoice is due. */
  dueDate?: string | null;
  /** Invoice-only bank-transfer details (from user_metadata). */
  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  /** Used for the Payment-page email subject + share-link preview. */
  shareUrl: string;
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
