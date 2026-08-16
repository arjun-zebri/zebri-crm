'use client';

import type { AdminUser } from '@/lib/admin/admin-analytics';
import { effectivePlan, type UserStats } from '@/lib/admin/user-value';
import { formatAUD } from '@/lib/payments/format';
import { formatRelativeTime } from '@/lib/utils';

const PLAN_LABEL: Record<ReturnType<typeof effectivePlan>, string> = {
  max: 'Max',
  pro: 'Pro',
  starter: 'Starter',
};

function formatDate(iso: string | null) {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * One row of the admin Users table: identity, effective plan, last
 * sign-in, and the per-user value metrics (couples / events /
 * invoices + $ collected / templates / automations).
 */
export function UsersTableRow({
  user,
  stats,
  now,
  onOpenUser,
}: {
  user: AdminUser;
  stats: UserStats;
  /** Clock reading captured once by the table (render purity). */
  now: number;
  onOpenUser: (userId: string) => void;
}) {
  const plan = effectivePlan(user);
  return (
    <tr
      onClick={() => onOpenUser(user.id)}
      className="border-b border-border last:border-0 hover:bg-surface-emphasis cursor-pointer"
    >
      <td className="px-4 py-3 font-medium text-text whitespace-nowrap">
        {user.display_name || ' - '}
        {user.account_type === 'admin' && (
          <span className="ml-2 text-body bg-surface-emphasis text-text-muted px-1.5 py-0.5 rounded-control">
            admin
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-text-muted">{user.business_name || ' - '}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={plan === 'starter' ? 'text-text-muted' : 'text-text font-medium'}>
          {PLAN_LABEL[plan]}
        </span>
        {user.is_comped && <span className="ml-1.5 text-text-subtle">comped</span>}
      </td>
      <td className="px-4 py-3 text-text-muted whitespace-nowrap">
        {user.last_sign_in_at ? formatRelativeTime(user.last_sign_in_at, now) : 'never'}
      </td>
      <NumberCell value={stats.couples} />
      <NumberCell value={stats.events} />
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
        <span className={stats.invoices === 0 ? 'text-text-subtle' : 'text-text'}>
          {stats.invoices}
        </span>
        {stats.paidTotal > 0 && (
          <span className="ml-1.5 text-text-muted">{formatAUD(stats.paidTotal)}</span>
        )}
      </td>
      <NumberCell value={stats.templates} />
      <NumberCell value={stats.automations} />
      <td className="px-4 py-3 text-text-muted whitespace-nowrap">
        {formatDate(user.created_at)}
      </td>
    </tr>
  );
}

/** Right-aligned count cell; zeroes fade so the real usage stands out. */
function NumberCell({ value }: { value: number }) {
  return (
    <td
      className={`px-4 py-3 text-right tabular-nums ${
        value === 0 ? 'text-text-subtle' : 'text-text'
      }`}
    >
      {value}
    </td>
  );
}
