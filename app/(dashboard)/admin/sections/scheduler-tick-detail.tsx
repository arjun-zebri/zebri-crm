'use client';

import type { SchedulerStatus } from '@/lib/admin/scheduler';
import { formatRelativeTime } from '@/lib/utils';
import { STALE_EVENT_MS } from '@/lib/workflows/heartbeat';

/**
 * The tick's health lines inside the Scheduler card: is the heartbeat
 * fresh, did the last tick truncate, have passes fail or leave reads
 * failed (and where the first one failed), and when bus events were last
 * dropped as stale.
 *
 * The stale line counts the last batch only (review M1): the record is
 * overwritten per batch, so a later small batch replaces a large one, and
 * the Slack alert is where each batch's count lives. It is here because
 * those drops used to leave no trace at all (audit M4): after an outage over a day, every enquiry that arrived
 * during it was stamped skipped. A drop inside the last day reads in the
 * warning tone; an older one is history and reads muted.
 */
export function SchedulerTickDetail({
  status,
  stale,
  clock,
}: {
  status: SchedulerStatus;
  /** Whether the heartbeat is older than the watchdog's window. */
  stale: boolean;
  /** The card's clock, so every relative time agrees. */
  clock: Date;
}) {
  const failed = status.tickFailedPasses;
  // Reads that failed inside passes that carried on. Shown here because
  // the Slack alert for them can be lost (Phase 6 review I2).
  const reads = status.tickFailedReads;
  const drop = status.staleEvents;
  const recentDrop =
    drop !== null && clock.getTime() - new Date(drop.at).getTime() < STALE_EVENT_MS;

  return (
    <>
      <p className={`text-body ${stale ? 'text-danger' : 'text-text-muted'}`}>
        {stale ? 'Tick stale' : 'Tick healthy'}
        {status.tickHeartbeat
          ? `, last ${formatRelativeTime(status.tickHeartbeat, clock.getTime())}`
          : ', never run'}
        {status.tickTruncated ? ', last tick truncated' : ''}
      </p>
      {failed.length > 0 ? (
        <p className="text-body text-danger">last tick failed: {failed.join(', ')}</p>
      ) : null}
      {reads > 0 ? (
        <p className="text-body text-danger">
          {reads} failed {reads === 1 ? 'read' : 'reads'} in the last tick
          {status.tickFailedReadSite ? `, first at ${status.tickFailedReadSite}` : ''}
        </p>
      ) : null}
      <p className={`text-body ${recentDrop ? 'text-warning' : 'text-text-muted'}`}>
        {drop
          ? `${drop.count} stale ${drop.count === 1 ? 'event' : 'events'} skipped in the last batch, ${formatRelativeTime(drop.at, clock.getTime())}`
          : 'No stale events skipped.'}
      </p>
    </>
  );
}
