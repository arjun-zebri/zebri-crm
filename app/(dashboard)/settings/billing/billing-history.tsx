/**
 * Billing history list.
 *
 * Compact, low-chrome list view of past Stripe invoices, fetched
 * once from `/api/stripe/billing-history`. Renders nothing when
 * there are no invoices to show; the loading state shows skeleton
 * rows that mirror the final layout, so there's no jump when data
 * arrives.
 *
 * @module app/(dashboard)/settings/billing/billing-history
 */
'use client';

import { Download, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { formatUnixDate } from './plans';

interface BillingInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amount: number;
  created: number;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

interface BillingUpcoming {
  amount: number;
  nextChargeAt: number;
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  open: 'Open',
  uncollectible: 'Uncollectible',
  void: 'Void',
  draft: 'Draft',
};

function statusLabel(s: string | null): string {
  if (!s) return '-';
  return STATUS_LABEL[s] ?? s;
}

function fmtAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BillingHistory() {
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const [upcoming, setUpcoming] = useState<BillingUpcoming | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stripe/billing-history')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(true);
          return;
        }
        setInvoices(data.invoices ?? []);
        setUpcoming(data.upcoming ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <BillingHistorySkeleton />;
  }

  if (error || !invoices) return null;
  if (invoices.length === 0 && !upcoming) return null;

  return (
    <div>
      {invoices.length > 0 ? (
        // No flex-1 on individual cells, items sit tightly next to
        // each other instead of being justify-between. On mobile, if
        // the natural row width exceeds the viewport, the wrapper's
        // overflow-x-auto kicks in and the user scrolls horizontally.
        <div className="overflow-x-auto">
          <ul className="divide-y divide-border/60">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-4 py-3 text-body">
                <span className="w-28 shrink-0 text-text-muted">
                  {formatUnixDate(inv.created)}
                </span>
                <span className="w-20 shrink-0 font-medium text-text">{fmtAmount(inv.amount)}</span>
                <span className="shrink-0 text-text-muted">{statusLabel(inv.status)}</span>
                <span className="flex shrink-0 items-center gap-4 text-caption text-text-muted">
                  {inv.hostedUrl ? (
                    <a
                      href={inv.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-text"
                    >
                      View <ExternalLink size={11} strokeWidth={1.5} />
                    </a>
                  ) : null}
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-text"
                    >
                      PDF <Download size={11} strokeWidth={1.5} />
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {upcoming ? (
        <p className="mt-4 text-caption text-text-muted">
          Next charge: <span className="text-text">{fmtAmount(upcoming.amount)}</span>
          {upcoming.nextChargeAt > 0 ? (
            <>
              {' '}
              on <span className="text-text">{formatUnixDate(upcoming.nextChargeAt)}</span>
            </>
          ) : null}
          .
        </p>
      ) : null}
    </div>
  );
}

/**
 * Skeleton state: mirrors the final row layout (date · amount ·
 * status · view/pdf links) plus a "next charge" line so the
 * transition to real data doesn't jump.
 */
function BillingHistorySkeleton() {
  return (
    <div className="animate-pulse">
      <ul className="divide-y divide-border/60">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-4 py-3">
            <span className="h-3 w-24 shrink-0 rounded-control bg-surface-muted" />
            <span className="h-3 w-16 shrink-0 rounded-control bg-surface-muted" />
            <span className="h-3 flex-1 max-w-[6rem] rounded-control bg-surface-muted" />
            <span className="flex shrink-0 items-center gap-4">
              <span className="h-3 w-10 rounded-control bg-surface-muted" />
              <span className="h-3 w-8 rounded-control bg-surface-muted" />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 h-3 w-64 rounded-control bg-surface-muted" />
    </div>
  );
}
