/**
 * Status banner shown above the invoice card.
 *
 * Two variants:
 * - `paid` — success-toned ("This invoice has been paid"). Visible
 *   to the couple once the MC marks the invoice paid or the
 *   `checkout.session.completed` webhook flips status.
 * - `overdue` — danger-toned. Shown when the due date has passed
 *   without payment.
 *
 * Phase 2D.2: design-token compliance — was `bg-emerald-50` /
 * `bg-red-50` raw classes; now `bg-success/10` / `bg-danger/10` so
 * brand changes propagate without per-call overrides.
 *
 * @module app/invoice/[token]/_components/invoice-status-banner
 */
import { htmlToPlainText } from '@/lib/branding/sanitize';

import { formatDate } from './public-invoice';

export interface InvoiceStatusBannerProps {
  kind: 'paid' | 'overdue';
  /** ISO timestamp of when the invoice was marked paid. Optional. */
  paidAt?: string | null;
  /** Business name (HTML — sanitised before render) — used in the
   *  overdue banner's "contact …" copy. */
  businessName?: string | null;
}

export function InvoiceStatusBanner({
  kind,
  paidAt,
  businessName,
}: InvoiceStatusBannerProps) {
  if (kind === 'paid') {
    const datePart =
      paidAt && paidAt.split('T')[0]
        ? ` · ${formatDate(paidAt.split('T')[0] as string)}`
        : '';
    return (
      <div className="mb-3 px-5 py-4 rounded-card bg-success/10 border border-success/20">
        <p className="text-sm font-medium text-success">
          This invoice has been paid. Thank you.{datePart}
        </p>
      </div>
    );
  }

  // overdue
  return (
    <div className="mb-3 px-5 py-3 rounded-card bg-danger/10 border border-danger/20">
      <p className="text-sm font-medium text-danger">
        This invoice is overdue.
        {businessName
          ? ` Please contact ${htmlToPlainText(businessName)} if you have any questions.`
          : ''}
      </p>
    </div>
  );
}
