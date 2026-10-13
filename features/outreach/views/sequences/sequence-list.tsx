'use client';

/**
 * Sequences as rows: name, a one-line summary of the steps, how many
 * campaigns use it, and the Edit and Archive actions.
 *
 * Archive is withheld while a campaign uses the sequence, because the
 * server refuses that. The row says why instead of offering a button
 * that fails.
 *
 * @module features/outreach/views/sequences/sequence-list
 */
import { Button } from '@/components/ui/button';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import type { SequenceWithSteps } from '@/lib/outreach/services/queries';

import { summarizeSteps } from './sequence-summary';

interface SequenceListProps {
  sequences: SequenceWithSteps[];
  onEdit: (seq: SequenceWithSteps) => void;
  onArchive: (seq: SequenceWithSteps) => void;
}

/** Plain-language campaign usage for one sequence. */
export function usageLabel(campaignCount: number): string {
  if (campaignCount === 0) return 'Not used by a campaign yet';
  return `Used by ${campaignCount} ${campaignCount === 1 ? 'campaign' : 'campaigns'}`;
}

/** The list of live (non-archived) sequences. */
export function SequenceList({ sequences, onEdit, onArchive }: SequenceListProps) {
  return (
    <ul className="rounded-control border border-border bg-card divide-y divide-border">
      {sequences.map((seq) => {
        const inUse = seq.campaign_count > 0;
        return (
          <li key={seq.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <p className="text-body font-medium text-text truncate">{seq.name}</p>
              <p className="text-body text-text-muted">
                {seq.steps.length} {seq.steps.length === 1 ? 'step' : 'steps'}: {summarizeSteps(seq.steps)}
              </p>
              <p className="text-body text-text-muted">
                {usageLabel(seq.campaign_count)}
                {inUse && '. Remove it from those campaigns before you can archive it.'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" onClick={() => onEdit(seq)} aria-label={`Edit ${seq.name}`}>
                Edit
              </Button>
              {!inUse && (
                <RowActionsMenu
                  alwaysVisible
                  actions={[{ label: 'Archive', destructive: true, onSelect: () => onArchive(seq) }]}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
