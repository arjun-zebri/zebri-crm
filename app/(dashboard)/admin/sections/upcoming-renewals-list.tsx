'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { UpcomingRenewals } from '@/lib/admin/admin-analytics';

const formatAUD = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Upcoming renewals (next 30 days). Header shows the $ value of
 * future-billed renewals; the list itself shows next-7-day rows
 * (so the founder can see the very-near-term schedule). Pending
 * cancellations are flagged so the dollar value isn't misread as
 * incoming revenue.
 */
export function UpcomingRenewalsList({
  renewals,
  onOpenUser,
}: {
  renewals: UpcomingRenewals;
  onOpenUser: (userId: string) => void;
}) {
  return (
    <Card className="flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base sm:text-xl font-semibold text-text">
          Upcoming renewals
        </h2>
        <span className="text-sm text-text-muted">
          {formatAUD(renewals.next30dValue)} · 30d
        </span>
      </div>
      <p className="text-xs text-text-muted mb-4">
        Next 7 days · {renewals.next7d.length}
      </p>
      {renewals.next7d.length === 0 ? (
        <p className="text-sm text-text-subtle py-4">
          No renewals in the next week.
        </p>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-2">
          {renewals.next7d.map((row) => (
            <li
              key={row.userId}
              onClick={() => onOpenUser(row.userId)}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-surface-emphasis cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm text-text truncate">
                  {row.business_name || row.email}
                </p>
                <p className="text-xs text-text-muted truncate">
                  <span className="capitalize">{row.plan ?? 'starter'}</span>
                  {' · '}
                  {formatAUD(row.amount)}
                </p>
              </div>
              <Badge
                variant={
                  row.cancel_at_period_end
                    ? 'cancelled'
                    : row.daysUntil <= 2
                      ? 'contacted'
                      : 'default'
                }
              >
                {row.cancel_at_period_end ? 'ends' : `${row.daysUntil}d`}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
