'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import type { AdminUser } from '@/lib/admin/admin-analytics';
import {
  compareUsersByPlanThenSignIn,
  emptyUserStats,
  type UserStats,
} from '@/lib/admin/user-value';

import { UsersTableRow } from './users-table-row';

/**
 * Users tab — full-table view with a search bar at the top. Filters
 * by email / business / display name (case-insensitive substring) as
 * the user types; email stays searchable even though it's no longer a
 * column (the detail panel shows it). Rows are ordered by plan tier
 * (Max → Pro → Starter), then most recent sign-in, so the highest
 * value accounts sit at the top. Click a row → opens the user detail
 * panel.
 */
export function UsersTableView({
  users,
  stats,
  onOpenUser,
}: {
  users: AdminUser[];
  stats: Record<string, UserStats>;
  onOpenUser: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  // One clock reading per mount: relative "last sign-in" cells stay
  // stable within a render and the render itself stays pure.
  const [now] = useState(() => Date.now());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? users.filter((u) => {
          return (
            u.email.toLowerCase().includes(q) ||
            u.business_name.toLowerCase().includes(q) ||
            u.display_name.toLowerCase().includes(q)
          );
        })
      : users;
    return [...matched].sort(compareUsersByPlanThenSignIn);
  }, [query, users]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          size={14}
          strokeWidth={1.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, business, or display name"
          className="pl-9"
        />
      </div>

      <div className="bg-surface border border-border rounded-control overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <Th>Name</Th>
                <Th>Business</Th>
                <Th>Plan</Th>
                <Th>Last sign-in</Th>
                <Th align="right">Couples</Th>
                <Th align="right">Events</Th>
                <Th align="right">Invoices</Th>
                <Th align="right">Templates</Th>
                <Th align="right">Automations</Th>
                <Th>Signed up</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-text-subtle">
                    {query ? 'No matches.' : 'No users yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <UsersTableRow
                    key={user.id}
                    user={user}
                    stats={stats[user.id] ?? emptyUserStats()}
                    now={now}
                    onOpenUser={onOpenUser}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-body text-text-subtle">
        {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        {query && ` · filtered from ${users.length}`}
      </p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      className={`px-4 py-3 font-medium text-text-muted whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}
