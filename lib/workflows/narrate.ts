/**
 * Turning one audit row into a line an MC can read.
 *
 * The feed's job is to answer "what has actually happened for this
 * couple", so every line names the thing it happened to. A column of
 * "Step done. Step done. Step started." answers nothing, which is why
 * the step's title is joined in rather than left to the `detail` blob:
 * it works for rows written before this code existed, and it survives a
 * step being renamed.
 *
 * @module lib/workflows/narrate
 */

import type { Json } from '@/types/database';

/** Read a string field out of an audit row's `detail`. */
function detailString(detail: Json | null, key: string): string | null {
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) return null;
  const value = (detail as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

/** What the row is about, joined alongside it by the feed query. */
export interface NarrationSubject {
  /** The step's title, or null when the step has since been removed. */
  stepTitle?: string | null;
  /** The instance's name, for the instance-level events. */
  instanceName?: string | null;
}

/** `label: name`, or the label alone when there is no name to add. */
function withName(label: string, name: string | null | undefined): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length > 0 ? `${label}: ${trimmed}` : label;
}

/**
 * A one-line description of one audit event.
 *
 * Unknown slugs fall back to the slug itself rather than an empty
 * string: a new event type should look odd in the feed, not vanish
 * from it.
 */
export function narrateWorkflowEvent(
  event: string,
  detail: Json | null,
  subject: NarrationSubject = {},
): string {
  const step = subject.stepTitle;
  const instance = subject.instanceName;

  switch (event) {
    case 'instance_created':
      return withName('Workflow applied', instance);
    case 'instance_completed':
      return withName('Workflow finished', instance);
    case 'instance_cancelled':
      return withName('Workflow stopped', instance);
    case 'step_started':
      return withName('Started', step);
    case 'step_completed':
      return withName('Done', step);
    case 'step_skipped': {
      const reason = detailString(detail, 'reason');
      const base = withName('Skipped', step);
      return reason ? `${base} (${reason})` : base;
    }
    case 'step_errored': {
      const message = detailString(detail, 'message');
      const base = withName('Failed', step);
      return message ? `${base}: ${message}` : base;
    }
    case 'step_waiting': {
      const reason = detailString(detail, 'reason');
      const base = withName('Waiting', step);
      // `missing_variables` is the one wait an MC has to act on: the send
      // parked because a detail it needed was blank.
      if (reason === 'missing_variables') {
        return `${base} (a detail it needs is still blank)`;
      }
      if (reason === 'quiet_hours') return `${base} (held until your sending hours)`;
      return base;
    }
    case 'step_added':
      return withName('Added', step);
    case 'step_approved':
      return withName('You approved', step);
    case 'step_rescheduled': {
      const to = detailString(detail, 'dueAt');
      const base = withName('Rescheduled', step);
      return to ? `${base} to ${to.slice(0, 10)}` : base;
    }
    case 'branch_taken': {
      const path = detailString(detail, 'path');
      const which = path === 'no' ? 'no' : 'yes';
      return step
        ? `${step} took the "${which}" path`
        : `Branch took the "${which}" path`;
    }
    default:
      return event;
  }
}
