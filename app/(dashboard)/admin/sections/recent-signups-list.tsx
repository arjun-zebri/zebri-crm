'use client';

import { Card } from '@/components/ui/card';
import type { RecentSignup } from '@/lib/admin/admin-analytics';

function formatRelative(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

/**
 * Newest signups (top 6). Pairs with the dormant list — together
 * they answer "who's just joined?" and "who joined but never
 * stuck?" in one glance.
 */
export function RecentSignupsList({
  rows,
  onOpenUser,
}: {
  rows: RecentSignup[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <Card className="flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-section font-semibold text-text">
          Recent signups
        </h2>
        <span className="text-body text-text-muted">last {rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-body text-text-subtle py-4">No signups yet.</p>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              onClick={() => onOpenUser(row.id)}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-control hover:bg-surface-emphasis cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-body text-text truncate">
                  {row.business_name || row.display_name || row.email}
                </p>
                <p className="text-caption text-text-muted truncate">{row.email}</p>
              </div>
              <span className="text-caption text-text-subtle shrink-0">
                {formatRelative(row.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
