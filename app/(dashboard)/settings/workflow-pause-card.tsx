'use client';

/**
 * Settings → Account → the account-wide workflow stop.
 *
 * The MC's emergency brake: if a workflow misfires, one switch stops
 * every automated workflow email and action on the account. The switch
 * shows the server's state and never flips on a bare click; both
 * directions go through {@link AccountPauseDialog}. The same stop is on
 * the Workflows page header, through the same hook.
 *
 * @module app/(dashboard)/settings/workflow-pause-card
 */

import { useState } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { Toggle } from '@/components/ui/toggle';
import {
  AccountPauseDialog,
  type AccountPauseMode,
} from '@/components/workflows/account-pause-dialog';
import { useAccountPause } from '@/components/workflows/use-account-pause';

/** The account-wide workflow stop switch. */
export function WorkflowPauseCard() {
  const stop = useAccountPause();
  const [mode, setMode] = useState<AccountPauseMode | null>(null);

  async function confirm() {
    if (!mode) return;
    const ok = await stop.setPaused(mode === 'pause');
    if (ok) setMode(null);
  }

  return (
    <section className="border-t border-border pt-8">
      <h3 className="mb-4 text-body font-medium text-text">Workflow automation</h3>
      {/* A failed read is unknown, not "running": a switch showing off
          on a stopped account would invite pressing it again. */}
      {stop.failed ? (
        <ErrorState title="Could not check whether workflows are paused" onRetry={stop.retry} />
      ) : (
        <Toggle
          checked={stop.paused}
          disabled={stop.loading || stop.busy}
          onChange={(next) => setMode(next ? 'pause' : 'resume')}
          label="Pause all automated workflow emails and actions"
          description={
            stop.paused
              ? 'Paused. Nothing a workflow would do by itself runs until you turn this off. Invoices and contracts you send yourself still go.'
              : 'An emergency stop for every workflow on your account, automated invoice and contract steps included. Invoices and contracts you send yourself are not affected.'
          }
        />
      )}
      <AccountPauseDialog
        mode={mode}
        loading={stop.busy}
        onConfirm={() => void confirm()}
        onCancel={() => setMode(null)}
      />
    </section>
  );
}
