'use client';

import { Card } from '@/components/ui/card';
import type { DormantUser } from '@/lib/admin/admin-analytics';

/**
 * Dormant accounts — signed up > 30 days ago, never created a
 * single couple. Strong "not actually using the product" signal.
 * Useful for support nudges / churn-prevention outreach.
 */
export function DormantList({
  rows,
  onOpenUser,
}: {
  rows: DormantUser[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <Card className="flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-xl font-semibold text-text">
          Dormant accounts
        </h2>
        <span className="text-sm text-text-muted">
          {rows.length} {rows.length === 1 ? 'user' : 'users'}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-text-subtle py-4">
          Every active account has at least one couple.
        </p>
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
                <p className="text-xs text-text-muted truncate">{row.email}</p>
              </div>
              <span className="text-xs text-text-subtle shrink-0">
                {row.daysSinceSignup}d ago
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
