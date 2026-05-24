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
  kind: 'quote' | 'invoice';
  documentNumber: string;
  title: string;
  status: string;
  coupleName: string | null;
  businessName: string | null;
  items: PreviewLineItem[];
  taxRate: number;
  discount: PreviewDiscount | null;
  notes: string | null;
  /** Quote-only: when the quote expires. */
  expiresAt?: string | null;
  /** Invoice-only: when the invoice is due. */
  dueDate?: string | null;
  /** Invoice-only bank-transfer details (from user_metadata). */
  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  /** Used for the Payment-page email subject + share-link preview. */
  shareUrl: string;
}
