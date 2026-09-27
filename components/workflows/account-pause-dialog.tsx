'use client';

/**
 * The confirmation in front of the account-wide workflow stop.
 *
 * Both directions confirm, from Settings and from the Workflows page
 * alike, so the words live here once. They are written to be impossible
 * to mistake for turning one workflow off (Task 17): this is every
 * workflow, for the whole account, and it does not touch the MC's own
 * sends.
 *
 * @module components/workflows/account-pause-dialog
 */

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/** Which way the switch is about to move. */
export type AccountPauseMode = 'pause' | 'resume';

export interface AccountPauseDialogProps {
  /** The direction being confirmed, or null when nothing is. */
  mode: AccountPauseMode | null;
  /** True while the change is in flight. */
  loading: boolean;
  /** Apply the change. */
  onConfirm: () => void;
  /** Dismiss without changing anything. */
  onCancel: () => void;
}

const COPY: Record<
  AccountPauseMode,
  { title: string; description: string; confirm: string; busy: string; tone: 'danger' | 'primary' }
> = {
  pause: {
    title: 'Pause all workflows?',
    description:
      'Pause all automated workflow emails and actions for your account. Nothing a workflow would do by itself runs until you resume, for every couple. New couples still get their workflow and to-dos. Automated invoice and contract steps stop too. Invoices and contracts you send yourself still go, as do emails you write.',
    confirm: 'Pause all',
    busy: 'Pausing...',
    tone: 'danger',
  },
  resume: {
    title: 'Resume all workflows?',
    description:
      'Automated workflow emails and actions start again from now. Steps that came due while paused will be skipped, not sent, so nobody gets a pile of late emails. Couples you paused one by one, and workflows you turned off, stay paused.',
    confirm: 'Resume',
    busy: 'Resuming...',
    tone: 'primary',
  },
};

/** Confirm pausing or resuming every workflow on the account. */
export function AccountPauseDialog({ mode, loading, onConfirm, onCancel }: AccountPauseDialogProps) {
  const copy = COPY[mode ?? 'pause'];
  return (
    <ConfirmDialog
      open={mode !== null}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      loadingLabel={copy.busy}
      tone={copy.tone}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
