/**
 * The stat cards at the top of the merged /proposals page: total, sent,
 * viewed, accepted. Real counts from already-fetched rows — deliberately
 * no trend/delta badge (`dashboard-stats.tsx`'s pattern), since there is
 * no historical comparison data to back one yet. Icon badges reuse the
 * same tone family as the list's own status pills (`PROPOSAL_STATE_PILL`
 * in `proposals-list.tsx`) so a card's colour always means the same thing
 * as the pill it's summarising.
 *
 * @module app/(dashboard)/proposals/proposals-stats-row
 */
import { CheckCircle2, Eye, FileHeart, Send, type LucideIcon } from 'lucide-react';

import type { StatePillTone } from '@/components/ui/state-pill';

import type { ProposalStats } from './proposals-stats';

export interface ProposalsStatsRowProps {
  stats: ProposalStats;
  loading: boolean;
}

const CARDS: ReadonlyArray<{ key: keyof ProposalStats; label: string; icon: LucideIcon; tone: StatePillTone }> = [
  { key: 'total', label: 'Total', icon: FileHeart, tone: 'neutral' },
  { key: 'sent', label: 'Sent', icon: Send, tone: 'info' },
  { key: 'viewed', label: 'Viewed', icon: Eye, tone: 'info' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, tone: 'success' },
];

const BADGE_CLASSES: Record<StatePillTone, string> = {
  neutral: 'bg-surface-emphasis text-text-muted',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

/** See {@link ProposalsStatsRowProps}. */
export function ProposalsStatsRow({ stats, loading }: ProposalsStatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} className="flex items-center gap-3 rounded-control border border-border bg-surface p-4 sm:p-5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${BADGE_CLASSES[tone]}`}>
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          </span>
          {loading ? (
            <div className="min-w-0 flex-1 animate-pulse space-y-1.5">
              <div className="h-6 w-10 rounded-control bg-surface-emphasis" />
              <div className="h-3 w-14 rounded-control bg-surface-emphasis" />
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-section font-semibold text-text sm:text-2xl">{stats[key]}</div>
              <div className="truncate text-body text-text-muted">{label}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
