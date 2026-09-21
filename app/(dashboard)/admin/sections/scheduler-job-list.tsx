'use client';

import type { SchedulerJob } from '@/lib/admin/scheduler';
import { formatRelativeTime } from '@/lib/utils';

/**
 * `lastStatus` label for the list. pg_cron's `succeeded` / `failed` is
 * whether `cron_call` handed the request to pg_net, not whether the
 * route it called returned 200 - the five daily jobs have no HTTP
 * signal at all today (only the tick's heartbeat carries one). "queued"
 * says what actually happened instead of implying the route succeeded.
 */
function enqueuedLabel(lastStatus: string | null): string {
  if (lastStatus === 'failed') return 'queue failed';
  if (lastStatus === 'succeeded') return 'queued';
  return lastStatus ?? 'never';
}

/**
 * The pg_cron jobs inside the Scheduler card: name, schedule, when it
 * last started and whether pg_cron enqueued that run to pg_net. A
 * failed enqueue reads in the danger tone; a job that has never run
 * says so rather than showing a blank.
 */
export function SchedulerJobList({ jobs, now }: { jobs: SchedulerJob[]; now: Date }) {
  if (jobs.length === 0) {
    return (
      <p className="text-body text-text-subtle py-4">
        No jobs registered. The scheduler migration has not run here.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-1">
      {jobs.map((job) => (
        <li
          key={job.name}
          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 px-2 py-1.5 rounded-control hover:bg-surface-emphasis"
        >
          <span className="text-body font-mono text-text truncate sm:flex-1">{job.name}</span>
          <span className="text-body text-text-subtle shrink-0">{job.schedule}</span>
          <span className="text-body text-text-subtle shrink-0">
            {job.lastStart ? formatRelativeTime(job.lastStart, now.getTime()) : 'never run'}
          </span>
          <span
            className={`text-body shrink-0 ${job.lastStatus === 'failed' ? 'text-danger' : 'text-text-muted'}`}
            title={job.lastMessage ?? undefined}
          >
            {enqueuedLabel(job.lastStatus)}
          </span>
        </li>
      ))}
    </ul>
  );
}
