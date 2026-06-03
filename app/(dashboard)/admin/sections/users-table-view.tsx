'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { AdminUser, SubscriptionStatus } from '@/lib/admin/admin-analytics';

const statusVariant: Record<SubscriptionStatus, 'paid' | 'contacted' | 'cancelled' | 'default'> = {
  active: 'paid',
  trialing: 'contacted',
  past_due: 'cancelled',
  cancelled: 'default',
  expired: 'default',
};

function formatDate(iso: string | null) {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function planLabel(user: AdminUser): string {
  if (user.subscription_status === 'active' && user.subscription_plan) {
    return user.subscription_plan === 'pro' ? 'Pro' : 'Max';
  }
  return 'Starter';
}

/**
 * Users tab — full-table view with a search bar at the top. Filters
 * by email / business / display name (case-insensitive substring) as
 * the user types. Click a row → opens the user detail panel.
 */
export function UsersTableView({
  users,
  onOpenUser,
}: {
  users: AdminUser[];
  onOpenUser: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.email.toLowerCase().includes(q) ||
        u.business_name.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q)
      );
    });
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
          size="sm"
        />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <Th>Name</Th>
                <Th>Business</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Plan</Th>
                <Th>Signed up</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-subtle">
                    {query ? 'No matches.' : 'No users yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => onOpenUser(user.id)}
                    className="border-b border-border last:border-0 hover:bg-surface-emphasis cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-text">
                      {user.display_name || ' - '}
                      {user.account_type === 'admin' && (
                        <span className="ml-2 text-xs bg-surface-emphasis text-text-muted px-1.5 py-0.5 rounded">
                          admin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {user.business_name || ' - '}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.subscription_status ? (
                        <Badge variant={statusVariant[user.subscription_status]}>
                          {user.subscription_status.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <span className="text-text-subtle text-xs"> - </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{planLabel(user)}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-text-subtle">
        {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        {query && ` · filtered from ${users.length}`}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 font-medium text-text-muted whitespace-nowrap">
      {children}
    </th>
  );
}
