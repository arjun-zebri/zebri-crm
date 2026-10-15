'use client';

/**
 * Campaigns as rows: status, what each arm sends, pace and counts, with
 * the one action that moves the campaign forward next to Edit. Finish and
 * Delete sit in the row menu. Delete is withheld while the campaign is
 * active; the server also refuses one that has sent anything.
 *
 * @module features/outreach/views/campaigns/campaign-list
 */
import { Button } from '@/components/ui/button';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { StatePill } from '@/components/ui/state-pill';
import type { CampaignSummary } from '@/lib/outreach/services/queries';

import { STATUS_META, splitPercent } from './campaign-draft';

type CampaignStatus = 'active' | 'paused' | 'finished';

interface CampaignListProps {
  campaigns: CampaignSummary[];
  /** Sequence id to name, for the arm labels. */
  sequenceNames: Map<string, string>;
  pending: boolean;
  onEdit: (c: CampaignSummary) => void;
  /** Pause only. Activation goes through {@link onActivate} so it can be confirmed first. */
  onStatus: (c: CampaignSummary, status: Exclude<CampaignStatus, 'finished' | 'active'>) => void;
  /** Opens the Activate confirmation, which states the audience and pace. */
  onActivate: (c: CampaignSummary) => void;
  onFinish: (c: CampaignSummary) => void;
  /** Opens the Delete confirmation. */
  onDelete: (c: CampaignSummary) => void;
}

/** The campaign list. Each row shows only the actions that make sense for its status. */
export function CampaignList({ campaigns, sequenceNames, pending, onEdit, onStatus, onActivate, onFinish, onDelete }: CampaignListProps) {
  return (
    <ul className="rounded-control border border-border bg-card divide-y divide-border">
      {campaigns.map((c) => {
        const meta = STATUS_META[c.status] ?? { label: c.status, tone: 'neutral' as const };
        const split = splitPercent(c.arms);
        const arms = c.arms
          .map((a) => `${sequenceNames.get(a.sequence_id) ?? 'Deleted sequence'} ${split.get(a.sequence_id) ?? 0}%`)
          .join(', ');
        const menu = [
          ...(c.status !== 'finished' ? [{ label: 'Finish', destructive: true, onSelect: () => onFinish(c) }] : []),
          ...(c.status !== 'active' ? [{ label: 'Delete', destructive: true, onSelect: () => onDelete(c) }] : []),
        ];
        return (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-text truncate">{c.name}</p>
                <StatePill label={meta.label} tone={meta.tone} />
              </div>
              <p className="text-body text-text-muted">{arms || 'No sequences yet'}</p>
              <p className="text-body text-text-muted tabular-nums">
                {c.daily_new_enrolments} new a day · {c.enrolled} enrolled · {c.active} active
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}>Edit</Button>
              {c.status === 'active' && (
                <Button variant="outline" disabled={pending} onClick={() => onStatus(c, 'paused')}>Pause</Button>
              )}
              {(c.status === 'draft' || c.status === 'paused') && (
                <Button disabled={pending} onClick={() => onActivate(c)}>Activate</Button>
              )}
              {menu.length > 0 && <RowActionsMenu alwaysVisible label={`More actions for ${c.name}`} actions={menu} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
