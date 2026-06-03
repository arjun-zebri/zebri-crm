'use client';

import { ExternalLink } from 'lucide-react';

import type { PastDueUser } from '@/lib/admin/admin-analytics';

/**
 * Past-due subscription list — users whose Stripe payment retry is
 * failing. Needs human outreach (typically a card-update email).
 * Click a row → user detail panel.
 */
export function PastDueList({
  rows,
  onOpenUser,
}: {
  rows: PastDueUser[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-6 flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-xl font-semibold text-text">Past-due</h2>
        <span className="text-sm text-text-muted">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-text-subtle py-4">No past-due subscriptions.</p>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              onClick={() => onOpenUser(row.id)}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-surface-emphasis cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm text-text truncate">
                  {row.business_name || row.email}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {row.email} · <span className="capitalize">{row.subscription_plan ?? 'starter'}</span>
                </p>
              </div>
              {row.stripe_customer_id && (
                <a
                  href={`https://dashboard.stripe.com/customers/${row.stripe_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text shrink-0"
                >
                  Stripe
                  <ExternalLink size={12} strokeWidth={1.5} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
