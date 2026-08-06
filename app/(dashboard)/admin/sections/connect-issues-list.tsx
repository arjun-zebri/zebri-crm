'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { ConnectIssue } from '@/lib/admin/admin-analytics';

/**
 * Connect-account health list — vendors whose ability to take
 * couple payments via Stripe Connect is broken (Stripe set a
 * `disabled_reason` or flagged a `requirements_past_due` field).
 */
export function ConnectIssuesList({
  rows,
  onOpenUser,
}: {
  rows: ConnectIssue[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <Card className="flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-xl font-semibold text-text">
          Connect issues
        </h2>
        <span className="text-sm text-text-muted">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-text-subtle py-4">
          No vendors with broken payment Connect.
        </p>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-2">
          {rows.map((row) => (
            <li
              key={row.user_id}
              onClick={() => onOpenUser(row.user_id)}
              className="px-2 py-1.5 rounded-md hover:bg-surface-emphasis cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-mono text-text truncate">
                  {row.account_id ?? '(no acct)'}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!row.charges_enabled && (
                    <Badge variant="cancelled">no charges</Badge>
                  )}
                  {!row.payouts_enabled && (
                    <Badge variant="cancelled">no payouts</Badge>
                  )}
                </div>
              </div>
              {row.disabled_reason && (
                <p className="text-xs text-danger mt-0.5 truncate">
                  {row.disabled_reason}
                </p>
              )}
              {row.requirements_past_due.length > 0 && (
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  past due · {row.requirements_past_due.join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
