'use client';

/**
 * The Workflows page header, with the account-wide stop.
 *
 * While running, the stop sits in the header as a button. While stopped,
 * a banner stays under the title for as long as the stop is on, with a
 * one-click resume, because a stopped account looks exactly like a
 * quiet one and the MC must not forget they pressed it. Both directions
 * confirm through {@link AccountPauseDialog}.
 *
 * @module app/(dashboard)/workflows/workflows-header
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { PageHeader } from '@/components/ui/page-header';
import { AccountPauseDialog, type AccountPauseMode } from '@/components/workflows/account-pause-dialog';
import { useAccountPause } from '@/components/workflows/use-account-pause';

/** Title, stop button and paused banner for /workflows. */
export function WorkflowsHeader() {
  const stop = useAccountPause();
  const [mode, setMode] = useState<AccountPauseMode | null>(null);

  async function confirm() {
    if (!mode) return;
    const ok = await stop.setPaused(mode === 'pause');
    if (ok) setMode(null);
  }

  return (
    <>
      <PageHeader
        title="Workflows"
        actions={
          stop.loading || stop.failed || stop.paused ? null : (
            <Button variant="outline" onClick={() => setMode('pause')}>
              Pause all workflows
            </Button>
          )
        }
      />
      {stop.failed ? (
        // Unknown is not "running": no Pause all, and say so, so a
        // stopped account never looks like a live one.
        <Callout tone="danger">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>Could not check whether workflows are paused.</p>
            <Button variant="outline" className="shrink-0" onClick={stop.retry}>
              Try again
            </Button>
          </div>
        </Callout>
      ) : null}
      {stop.paused ? (
        <Callout tone="warning">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              All workflows are paused. Nothing automated sends or runs until you resume.
              Invoices and contracts you send yourself still go.
            </p>
            <Button variant="outline" className="shrink-0" onClick={() => setMode('resume')}>
              Resume all
            </Button>
          </div>
        </Callout>
      ) : null}
      <AccountPauseDialog
        mode={mode}
        loading={stop.busy}
        onConfirm={() => void confirm()}
        onCancel={() => setMode(null)}
      />
    </>
  );
}
