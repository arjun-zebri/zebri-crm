'use client';

import { useState } from 'react';

import { Card } from '@/components/ui/card';
import type { EngagementSummary } from '@/lib/admin/admin-analytics';
import type { GoneQuietUser } from '@/lib/admin/user-value';
import { formatRelativeTime } from '@/lib/utils';

const PLAN_LABEL: Record<GoneQuietUser['plan'], string> = {
  max: 'Max',
  pro: 'Pro',
  starter: 'Starter',
};

/**
 * Engagement — who is actually using the product. An activity strip
 * (7d / 30d actives, dormant, new signups) next to the "gone quiet"
 * list: paying or comped users with no sign-in for 14+ days, highest
 * tier first. Dormant = never started; gone quiet = revenue at risk.
 */
export function EngagementSection({
  engagement,
  goneQuiet,
  onOpenUser,
}: {
  engagement: EngagementSummary;
  goneQuiet: GoneQuietUser[];
  onOpenUser: (userId: string) => void;
}) {
  // One clock reading per mount keeps the relative times render-pure.
  const [now] = useState(() => Date.now());
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <h2 className="text-base sm:text-section font-semibold text-text mb-4">
          Engagement
        </h2>
        <div className="space-y-3">
          <Stat label="Active last 7 days" value={engagement.activeLast7d} />
          <Stat label="Active last 30 days" value={engagement.activeLast30d} />
          <Stat label="New this week" value={engagement.newThisWeek} />
        </div>
      </Card>

      <Card className="lg:col-span-2 flex flex-col max-h-80">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-section font-semibold text-text">
            Gone quiet
          </h2>
          <span className="text-body text-text-muted">
            {goneQuiet.length} {goneQuiet.length === 1 ? 'user' : 'users'}
          </span>
        </div>
        {goneQuiet.length === 0 ? (
          <p className="text-body text-text-subtle py-4">
            Every paying account has signed in within the last 14 days.
          </p>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-2">
            {goneQuiet.map((row) => (
              <li
                key={row.id}
                onClick={() => onOpenUser(row.id)}
                className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-control hover:bg-surface-emphasis cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-body text-text truncate">
                    {row.business_name || row.email}
                  </p>
                  <p className="text-body text-text-muted truncate">
                    {PLAN_LABEL[row.plan]}
                    {row.is_comped && ' · comped'}
                  </p>
                </div>
                <span className="text-body text-text-subtle shrink-0">
                  {row.last_sign_in_at
                    ? formatRelativeTime(row.last_sign_in_at, now)
                    : 'never signed in'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-body text-text-muted">{label}</span>
      <span className="text-base font-semibold text-text tabular-nums">{value}</span>
    </div>
  );
}
