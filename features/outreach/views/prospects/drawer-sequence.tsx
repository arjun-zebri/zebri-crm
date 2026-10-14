/**
 * Current sequence, in one line: which sequence, which campaign, and
 * whether it is running, with a stop button while it runs. Stopping
 * cancels every message still scheduled, so it asks first.
 *
 * @module features/outreach/views/prospects/drawer-sequence
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { stopSequenceAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { ProspectDetail } from '@/lib/outreach/services/queries';

import { DrawerSection } from './drawer-parts';
import { humanize } from './labels';

type Enrollment = NonNullable<ProspectDetail['enrollment']>;

const STATUS: Record<string, { label: string }> = {
  active: { label: 'Running' },
  completed: { label: 'Finished' },
  stopped: { label: 'Stopped' },
};

/** Props for {@link SequenceSection}. */
export interface SequenceSectionProps {
  prospectId: string;
  enrollment: Enrollment | null;
}

/** The person's current sequence, with a confirmed stop. */
export function SequenceSection({ prospectId, enrollment }: SequenceSectionProps) {
  const [confirming, setConfirming] = useState(false);
  const stop = useOutreachMutation(stopSequenceAction, 'Sequence stopped');
  const status = enrollment ? (STATUS[enrollment.status] ?? { label: humanize(enrollment.status) }) : null;

  return (
    <DrawerSection title="Sequence">
      {!enrollment || !status ? (
        <p className="text-body text-text-muted">Not in a sequence.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body text-text">
            {enrollment.sequence || 'Untitled'}
            <span className="text-text-muted"> in {enrollment.campaign || 'an untitled campaign'}</span>
            <span className="text-text-muted">
              {' · '}
              {status.label}
              {enrollment.stop_reason ? `, ${humanize(enrollment.stop_reason).toLowerCase()}` : ''}
            </span>
          </p>
          {enrollment.status === 'active' && (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              Stop sequence
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title="Stop this sequence?"
        description="Messages still scheduled for this person are cancelled. Anything already sent stays in the timeline."
        confirmLabel="Stop sequence"
        loading={stop.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => stop.mutate(prospectId, { onSuccess: () => setConfirming(false) })}
      />
    </DrawerSection>
  );
}
