'use client';

import { RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';

import { refreshSchedulerStatusAction, syncSchedulerAction } from '@/app/admin/scheduler-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SchedulerStatus } from '@/lib/admin/scheduler';
import { formatRelativeTime } from '@/lib/utils';
import { isHeartbeatStale, TICK_STALE_MS } from '@/lib/workflows/heartbeat';

import { SchedulerJobList } from './scheduler-job-list';

/** A line of feedback under the Sync button. */
interface Notice {
  text: string;
  tone: 'info' | 'error';
}

/**
 * Scheduler health: are the Vault secrets set, what did each pg_cron job
 * do last, and is the tick heartbeat fresh. The one place the founder
 * configures the scheduler; nothing is typed, Sync pushes the
 * deployment's own env values.
 */
export function SchedulerCard({
  status: initial,
  error: initialError = null,
  now,
}: {
  status: SchedulerStatus;
  /** Why the page could not read the status; shown in place of the data. */
  error?: string | null;
  /** Clock reading for staleness; tests pass a fixed instant. */
  now?: Date;
}) {
  const [status, setStatus] = useState(initial);
  const [message, setMessage] = useState<Notice | null>(
    initialError ? { text: initialError, tone: 'error' } : null,
  );
  const [pending, startTransition] = useTransition();
  // Captured once so a re-render does not move the clock (render purity);
  // the prop wins when a caller needs a deterministic instant.
  const [mountedAt] = useState(() => new Date());
  const clock = now ?? mountedAt;

  const stale = isHeartbeatStale(status.tickHeartbeat, clock, TICK_STALE_MS);

  // Server actions throw on an expired session (`assertAdmin`); inside a
  // transition that would be an unhandled rejection, so surface it here.
  function fail(e: unknown, fallback: string) {
    setMessage({ text: e instanceof Error ? e.message : fallback, tone: 'error' });
  }

  async function reload() {
    try {
      setStatus(await refreshSchedulerStatusAction());
    } catch (e) {
      fail(e, 'Could not read scheduler status.');
    }
  }

  function sync() {
    startTransition(async () => {
      try {
        const result = await syncSchedulerAction();
        setMessage(
          result.ok ? { text: 'Secrets synced.', tone: 'info' } : { text: result.error, tone: 'error' },
        );
        if (result.ok) await reload();
      } catch (e) {
        fail(e, 'Could not sync the scheduler.');
      }
    });
  }

  function refresh() {
    startTransition(async () => {
      setMessage(null);
      await reload();
    });
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-section font-semibold text-text">Scheduler</h2>
        <div className="flex items-center gap-2">
          <Badge variant={status.configured ? 'confirmed' : 'cancelled'}>
            {status.configured ? 'Configured' : 'Not configured'}
          </Badge>
          <Button
            variant="secondary"
            iconOnly
            aria-label="Refresh"
            loading={pending}
            onClick={refresh}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <p className="text-body text-text-muted font-mono truncate">
        {status.baseUrl ?? 'No base URL in Vault.'}
      </p>
      <p className={`text-body ${stale ? 'text-danger' : 'text-text-muted'}`}>
        {stale ? 'Tick stale' : 'Tick healthy'}
        {status.tickHeartbeat
          ? `, last ${formatRelativeTime(status.tickHeartbeat, clock.getTime())}`
          : ', never run'}
        {status.tickTruncated ? ', last tick truncated' : ''}
      </p>

      <SchedulerJobList jobs={status.jobs} now={clock} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button loading={pending} onClick={sync}>
          Sync scheduler
        </Button>
        {message ? (
          <span className={`text-body ${message.tone === 'error' ? 'text-danger' : 'text-text-muted'}`}>
            {message.text}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
