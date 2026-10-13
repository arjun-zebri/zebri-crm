'use client';

/**
 * Asks why a prospect is being marked lost, then saves the move.
 *
 * @module features/outreach/views/pipeline/lost-reason-modal
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { updateProspectAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { ProspectRow } from '@/lib/outreach/services/queries';
import { LOST_REASONS } from '@/lib/outreach/types';

import { LOST_REASON_LABELS } from './pipeline-stages';

type LostReason = (typeof LOST_REASONS)[number];

const REASON_OPTIONS = LOST_REASONS.map((r) => ({ value: r, label: LOST_REASON_LABELS[r] }));

interface LostReasonModalProps {
  row: ProspectRow;
  onClose: () => void;
}

/** Small dialog: pick a reason, then mark the prospect lost. */
export function LostReasonModal({ row, onClose }: LostReasonModalProps) {
  // Default to "Not interested" so Save always has a value; the founder can change it before saving.
  const [reason, setReason] = useState<LostReason>('not_interested');
  const move = useOutreachMutation(updateProspectAction, 'Marked as lost');

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title={`Mark ${row.full_name} as lost`}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            loading={move.isPending}
            onClick={() =>
              move.mutate({ id: row.id, patch: { stage: 'lost', lost_reason: reason } }, { onSuccess: onClose })
            }
          >
            Mark as lost
          </Button>
        </div>
      }
    >
      <Select
        label="Reason"
        ariaLabel="Lost reason"
        options={REASON_OPTIONS}
        value={reason}
        onValueChange={(v) => setReason(v as LostReason)}
      />
    </Modal>
  );
}
