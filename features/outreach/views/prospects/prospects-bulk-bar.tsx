'use client';

/**
 * Bulk actions for the rows ticked in the Prospects table. Appears only
 * when something is selected, so the normal list stays calm.
 *
 * @module features/outreach/views/prospects/prospects-bulk-bar
 */
import { Ban, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { setVerdictAction, startCheckRunAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';

import { useDoNotContactMany } from './use-do-not-contact-many';

/** Props for {@link ProspectsBulkBar}. */
export interface ProspectsBulkBarProps {
  selectedIds: string[];
  /** Clears the selection. Called after a bulk action succeeds. */
  onDone: () => void;
}

/** Selected count plus the four bulk actions. */
export function ProspectsBulkBar({ selectedIds, onDone }: ProspectsBulkBarProps) {
  const verdict = useOutreachMutation(setVerdictAction, 'Status updated');
  const recheck = useOutreachMutation(startCheckRunAction, 'Check run started');
  const dnc = useDoNotContactMany(onDone);
  const busy = verdict.isPending || recheck.isPending || dnc.isPending;
  const count = selectedIds.length;
  // Do-not-contact is one-way from the founder's side (turning it back on
  // is per row, in the drawer), and it reaches many people at once, so it
  // asks first and states the count.
  const [confirmingDnc, setConfirmingDnc] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface-muted p-3">
      <span className="mr-auto text-body font-medium text-text">{count} selected</span>
      <Button
        variant="outline"
        disabled={busy}
        loading={verdict.isPending}
        onClick={() => verdict.mutate({ ids: selectedIds, verdict: 'active' }, { onSuccess: onDone })}
      >
        <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden="true" />
        Mark active
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        loading={verdict.isPending}
        onClick={() => verdict.mutate({ ids: selectedIds, verdict: 'inactive' }, { onSuccess: onDone })}
      >
        <XCircle size={14} strokeWidth={1.5} aria-hidden="true" />
        Mark inactive
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        loading={recheck.isPending}
        onClick={() => recheck.mutate({ prospectIds: selectedIds }, { onSuccess: onDone })}
      >
        <RefreshCw size={14} strokeWidth={1.5} aria-hidden="true" />
        Re-check
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => setConfirmingDnc(true)}>
        <Ban size={14} strokeWidth={1.5} aria-hidden="true" />
        Do not contact
      </Button>
      <Button variant="ghost" disabled={busy} onClick={onDone}>Clear</Button>
      <ConfirmDialog
        open={confirmingDnc}
        title={`Stop contacting ${count} ${count === 1 ? 'person' : 'people'}?`}
        description="They will be marked do not contact. Zebri will not email or DM them again. You can turn this off for each person from their profile."
        confirmLabel="Do not contact"
        loading={dnc.isPending}
        onCancel={() => setConfirmingDnc(false)}
        onConfirm={() => dnc.mutate(selectedIds, { onSettled: () => setConfirmingDnc(false) })}
      />
    </div>
  );
}
