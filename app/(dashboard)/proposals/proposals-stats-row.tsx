/**
 * The account strip at the top of /proposals: acceptance rate, median time
 * to open and revenue accepted this month, from `proposal_account_summary`.
 * A figure with nothing behind it (nothing sent, nothing opened) reads as an
 * en dash with a tooltip, never "0%" or "0s": zero would claim a result.
 * Icon badges reuse the tone family of the list's status pills so a colour
 * always means the same thing.
 *
 * @module app/(dashboard)/proposals/proposals-stats-row
 */
import { CircleCheck, Clock, DollarSign, type LucideIcon } from 'lucide-react';

import { ErrorState } from '@/components/ui/error-state';
import type { StatePillTone } from '@/components/ui/state-pill';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDuration, type AccountSummary } from '@/features/proposals';

export interface ProposalsStatsRowProps {
  summary: AccountSummary | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

interface Card {
  label: string;
  icon: LucideIcon;
  tone: StatePillTone;
  /** The figure, or `null` when there is nothing to report yet. */
  value: (s: AccountSummary) => string | null;
  /** Why the figure is missing, shown on the en dash. Only on cards whose `value` can be `null`. */
  emptyHint?: string;
}

const CARDS: readonly Card[] = [
  { label: 'Acceptance rate', icon: CircleCheck, tone: 'success', emptyHint: 'Nothing sent yet', value: (s) => (s.acceptancePct === null ? null : `${s.acceptancePct}%`) },
  { label: 'Median time to open', icon: Clock, tone: 'info', emptyHint: 'No opens yet', value: (s) => (s.medianOpenSeconds === null ? null : formatDuration(s.medianOpenSeconds)) },
  { label: 'Accepted this month', icon: DollarSign, tone: 'success', value: (s) => `$${s.revenueThisMonth.toLocaleString('en-AU', { maximumFractionDigits: 0 })}` },
];

const BADGE_CLASSES: Record<StatePillTone, string> = {
  neutral: 'bg-surface-emphasis text-text-muted',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

/** See {@link ProposalsStatsRowProps}. */
export function ProposalsStatsRow({ summary, loading, error, onRetry }: ProposalsStatsRowProps) {
  // Only when there is nothing to show: a failed background refetch keeps
  // the figures already on screen rather than swapping them for an error.
  if (error && !summary) return <ErrorState title="Could not load your proposal figures" onRetry={onRetry} className="py-6" />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {CARDS.map(({ label, icon: Icon, tone, value, emptyHint }) => {
        const figure = summary ? value(summary) : null;
        return (
          <div key={label} className="flex items-center gap-3 rounded-control border border-border bg-surface p-4 sm:p-5">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${BADGE_CLASSES[tone]}`}>
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
            </span>
            {loading || !summary ? (
              <div className="min-w-0 flex-1 animate-pulse space-y-1.5">
                <div className="h-6 w-10 rounded-control bg-surface-emphasis" />
                <div className="h-3 w-14 rounded-control bg-surface-emphasis" />
              </div>
            ) : (
              <div className="min-w-0">
                <div className="text-section font-semibold text-text sm:text-2xl">
                  {figure === null ? (
                    <Tooltip label={emptyHint ?? 'Nothing yet'}>
                      <span>
                        <span aria-hidden="true">{'\u2013'}</span>
                        <span className="sr-only">{emptyHint ?? 'Nothing yet'}</span>
                      </span>
                    </Tooltip>
                  ) : (
                    figure
                  )}
                </div>
                <div className="truncate text-body text-text-muted">{label}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
