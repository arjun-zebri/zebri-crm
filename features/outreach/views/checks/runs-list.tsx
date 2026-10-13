'use client';

/**
 * Check runs, in two parts. A run that is queuing or running gets a card
 * with progress and Cancel, and is the only thing that takes space while it
 * lasts. Finished runs wait behind a "Past checks" disclosure, so the page
 * never shows an empty "Runs" heading.
 *
 * Progress uses a native `<progress>` styled with Tailwind's arbitrary
 * pseudo-element variants, so it needs no inline width and stays
 * accessible.
 *
 * @module features/outreach/views/checks/runs-list
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { StatePill, type StatePillTone } from '@/components/ui/state-pill';
import { cancelCheckRunAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { CheckRun } from '@/lib/outreach/types';

import { formatUsd, formatWhen } from './format';

/** Human name for a run kind. */
const KIND_LABELS: Record<string, string> = {
  activity: 'Activity check',
  ig_enrolment: 'Instagram lookups for new enrolments',
};

/** Pill tone and label per run status. */
const STATUS: Record<string, { tone: StatePillTone; label: string }> = {
  queuing: { tone: 'info', label: 'Starting' },
  running: { tone: 'info', label: 'Running' },
  failed: { tone: 'danger', label: 'Failed' },
  done: { tone: 'success', label: 'Done' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

/**
 * Statuses the server will cancel. A run still `queuing` has begun but has
 * not checked anyone yet, and cancelRun accepts it, so it gets Cancel too.
 */
const IN_PROGRESS = new Set(['queuing', 'running']);

/** One run row. `cancellable` is set only for the active card. */
function RunRow({ run, cancellable }: { run: CheckRun; cancellable: boolean }) {
  const cancel = useOutreachMutation(cancelCheckRunAction, 'Run cancelled');
  const status = STATUS[run.status] ?? { tone: 'neutral' as const, label: run.status };
  const total = Math.max(run.total, 1);
  const kind = KIND_LABELS[run.kind] ?? run.kind;
  return (
    <li className="py-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-medium text-text">{kind}</p>
        <StatePill label={status.label} tone={status.tone} dot="filled" />
      </div>
      <div className="flex items-center gap-3">
        <progress
          value={run.done}
          max={total}
          aria-label={`${kind} progress`}
          className="flex-1 h-1.5 appearance-none overflow-hidden rounded-pill bg-surface-muted [&::-webkit-progress-bar]:bg-surface-muted [&::-webkit-progress-value]:bg-brand-fg [&::-moz-progress-bar]:bg-brand-fg"
        />
        <span className="text-body text-text-muted whitespace-nowrap">
          {run.done} of {run.total}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body text-text-muted">
          Started {formatWhen(run.started_at)}
          {run.finished_at ? `, finished ${formatWhen(run.finished_at)}` : ''}
          {' · '}
          {formatUsd(run.cost_cents)} spent
          {run.errors > 0 && <span className="text-danger">{` · ${run.errors} ${run.errors === 1 ? 'error' : 'errors'}`}</span>}
        </p>
        {cancellable && (
          <Button variant="outline" loading={cancel.isPending} onClick={() => cancel.mutate(run.id)}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * The run(s) in flight, as one card each. Renders nothing when no run is
 * queuing or running, so an idle page carries no run chrome at all.
 *
 * @param props.runs - Most recent first, as the query returns them.
 */
export function ActiveRuns({ runs }: { runs: CheckRun[] }) {
  const active = runs.filter((r) => IN_PROGRESS.has(r.status));
  if (active.length === 0) return null;
  return (
    <section className="rounded-control border border-border px-4">
      <ul className="divide-y divide-border">
        {active.map((run) => (
          <RunRow key={run.id} run={run} cancellable />
        ))}
      </ul>
      <p className="py-3 text-body text-text-muted">
        Checking at full speed while this page is open. It keeps going slowly in the background if you leave.
      </p>
    </section>
  );
}

/**
 * Finished runs behind a disclosure. Renders nothing when there are none.
 *
 * @param props.runs - Most recent first. Runs still in flight are skipped here (see {@link ActiveRuns}).
 */
export function PastChecks({ runs }: { runs: CheckRun[] }) {
  const [open, setOpen] = useState(false);
  const past = runs.filter((r) => !IN_PROGRESS.has(r.status));
  if (past.length === 0) return null;
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-body text-text-muted hover:text-text transition-colors cursor-pointer"
      >
        <Chevron size={14} strokeWidth={1.5} aria-hidden="true" />
        Past checks ({past.length})
      </button>
      {open && (
        <ul className="divide-y divide-border">
          {past.map((run) => (
            <RunRow key={run.id} run={run} cancellable={false} />
          ))}
        </ul>
      )}
    </section>
  );
}
