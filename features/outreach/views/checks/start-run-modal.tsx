'use client';

/**
 * Start an activity check: pick which status groups to re-check.
 *
 * Each group shows how many people it holds and the modal totals the
 * selection, so the scope is known before anything starts. "Not checked yet"
 * is the default because it is the cheap first pass. Checks run from the
 * Prospects page and only while that page stays open.
 *
 * @module features/outreach/views/checks/start-run-modal
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import { startCheckRunAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { ChecksData } from '@/lib/outreach/services/queries';

import { formatUsd } from './format';

/** Status groups a run can cover, in display order. Labels match the Status column. */
const GROUPS = [
  { id: 'unchecked', label: 'Not checked yet' },
  { id: 'needs_review', label: 'Needs a look' },
  { id: 'inactive', label: 'Not active' },
  { id: 'active', label: 'Active' },
] as const;

type Group = (typeof GROUPS)[number]['id'];

/** Celebrants per group, from the checks query. */
function countFor(counts: ChecksData['counts'], id: Group): number {
  switch (id) {
    case 'unchecked':
      return counts.unchecked;
    case 'needs_review':
      return counts.needsReview;
    case 'inactive':
      return counts.inactive;
    case 'active':
      return counts.active;
  }
}

/**
 * @param props.counts - People per status, shown beside each group.
 * @param props.spentCentsThisMonth - Instagram spend so far this month.
 * @param props.budgetCents - The monthly Instagram cap.
 * @param props.onClose - Called on cancel, or after the run starts.
 */
export function StartRunModal({
  counts,
  spentCentsThisMonth,
  budgetCents,
  onClose,
}: {
  counts: ChecksData['counts'];
  spentCentsThisMonth: number;
  budgetCents: number;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Group[]>(['unchecked']);
  const start = useOutreachMutation(startCheckRunAction, (d: { total: number }) =>
    d.total === 0 ? 'Nobody in those groups to check' : `Checking ${d.total} celebrants`,
  );
  const selectedTotal = picked.reduce((sum, id) => sum + countFor(counts, id), 0);

  function toggle(id: Group, on: boolean) {
    setPicked((prev) => (on ? [...prev, id] : prev.filter((g) => g !== id)));
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title="Run activity check"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={picked.length === 0}
            loading={start.isPending}
            onClick={() => start.mutate({ verdicts: picked }, { onSuccess: onClose })}
          >
            Start check
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-body text-text-muted">
          Checks run while this page stays open. Instagram lookups used {formatUsd(spentCentsThisMonth)} of{' '}
          {formatUsd(budgetCents)} this month.
        </p>
        <fieldset className="space-y-3">
          <legend className="text-body font-medium text-text mb-3">Who to check</legend>
          {GROUPS.map((g) => (
            <Checkbox
              key={g.id}
              checked={picked.includes(g.id)}
              onChange={(on) => toggle(g.id, on)}
              label={`${g.label} (${countFor(counts, g.id)})`}
            />
          ))}
        </fieldset>
        <p className="text-body text-text">
          This run covers <span className="font-semibold">{selectedTotal}</span>{' '}
          {selectedTotal === 1 ? 'celebrant' : 'celebrants'}.
        </p>
      </div>
    </Modal>
  );
}
