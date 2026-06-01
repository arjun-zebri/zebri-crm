'use client';

import { AlertTriangle, Clock, CreditCard, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type {
  ConnectIssue,
  OpsSnapshot,
  PastDueUser,
  TrialEndingUser,
} from '@/lib/admin/ops-signals';

/**
 * Ops tab — surface "users who need human attention right now"
 * across three cards: trials ending soon, past-due subscriptions,
 * and broken Connect accounts. Clicking a row opens the user
 * detail panel via the same `onOpenUser` callback the other tabs
 * use.
 */
export function OpsTab({
  snapshot,
  onOpenUser,
}: {
  snapshot: OpsSnapshot;
  onOpenUser: (userId: string) => void;
}) {
  return (
    <div className="space-y-8 max-w-5xl">
      <TrialsEndingCard rows={snapshot.trialsEnding} onOpenUser={onOpenUser} />
      <PastDueCard rows={snapshot.pastDue} onOpenUser={onOpenUser} />
      <ConnectIssuesCard rows={snapshot.connectIssues} onOpenUser={onOpenUser} />
    </div>
  );
}

function CardShell({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-xl overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-muted">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-medium text-text">{title}</h2>
        </div>
        <span className="text-xs text-text-muted">{count}</span>
      </header>
      {children}
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-center text-sm text-text-subtle">
      {message}
    </div>
  );
}

function TrialsEndingCard({
  rows,
  onOpenUser,
}: {
  rows: TrialEndingUser[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <CardShell
      title="Trials ending in 7 days"
      count={rows.length}
      icon={<Clock size={16} strokeWidth={1.5} className="text-text-muted" />}
    >
      {rows.length === 0 ? (
        <EmptyRow message="No trials ending soon" />
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              onClick={() => onOpenUser(row.id)}
              className="px-4 py-3 border-b border-border last:border-0 hover:bg-surface-emphasis cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-text truncate">
                  {row.business_name || row.email}
                </p>
                <p className="text-xs text-text-muted truncate">{row.email}</p>
              </div>
              <Badge variant={row.daysRemaining <= 2 ? 'cancelled' : 'contacted'}>
                {row.daysRemaining}d
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function PastDueCard({
  rows,
  onOpenUser,
}: {
  rows: PastDueUser[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <CardShell
      title="Past-due subscriptions"
      count={rows.length}
      icon={<CreditCard size={16} strokeWidth={1.5} className="text-text-muted" />}
    >
      {rows.length === 0 ? (
        <EmptyRow message="No past-due subscriptions" />
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              onClick={() => onOpenUser(row.id)}
              className="px-4 py-3 border-b border-border last:border-0 hover:bg-surface-emphasis cursor-pointer flex items-center justify-between gap-3"
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
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
                >
                  Stripe
                  <ExternalLink size={12} strokeWidth={1.5} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function ConnectIssuesCard({
  rows,
  onOpenUser,
}: {
  rows: ConnectIssue[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <CardShell
      title="Connect account issues"
      count={rows.length}
      icon={<AlertTriangle size={16} strokeWidth={1.5} className="text-text-muted" />}
    >
      {rows.length === 0 ? (
        <EmptyRow message="No Connect issues — vendors can accept couple payments" />
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.user_id}
              onClick={() => onOpenUser(row.user_id)}
              className="px-4 py-3 border-b border-border last:border-0 hover:bg-surface-emphasis cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-mono text-text truncate">
                  {row.account_id ?? '(no acct)'}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  {row.charges_enabled ? null : (
                    <Badge variant="cancelled">no charges</Badge>
                  )}
                  {row.payouts_enabled ? null : (
                    <Badge variant="cancelled">no payouts</Badge>
                  )}
                </div>
              </div>
              {row.disabled_reason && (
                <p className="text-xs text-danger mt-1">
                  disabled · {row.disabled_reason}
                </p>
              )}
              {row.requirements_past_due.length > 0 && (
                <p className="text-xs text-text-muted mt-1 truncate">
                  past due · {row.requirements_past_due.join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}
