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

import { partialSendFailure, partialSendFailureLabel } from './send-outcome';

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
    case 'instance_cancelled': {
      // Stopped because the MC deleted the workflow, not on this couple,
      // because applying it failed part way (lib/workflows/interrupted-applies),
      // or because the couple moved into one of its exit stages.
      const base = withName('Workflow stopped', instance);
      const workflow = detailString(detail, 'workflow');
      const reason = detailString(detail, 'reason');
      if (reason === 'setup_interrupted') return `${base} (its setup did not finish)`;
      // An exit rule (lib/workflows/exit-dispatch) names the stage, so the
      // MC sees the move that ended it rather than a bare "stopped".
      const stage = detailString(detail, 'stage');
      if (reason === 'exit_rule') return stage ? `${base} (couple moved to ${stage})` : base;
      return reason === 'template_deleted' && workflow
        ? `${base} (${workflow} was deleted)`
        : base;
    }
    case 'instance_paused': {
      // A pause made by turning the whole workflow off names it, so the
      // MC can tell it from a pause they made on this couple.
      const base = withName('Workflow paused', instance);
      const workflow = detailString(detail, 'workflow');
      return detailString(detail, 'reason') === 'template_off' && workflow
        ? `${base} (${workflow} was turned off)`
        : base;
    }
    case 'instance_resumed':
      return withName('Workflow resumed', instance);
    case 'step_started':
      return withName('Started', step);
    case 'step_completed': {
      const base = withName('Done', step);
      // A send that reached only some of its recipients is still done
      // (re-running it would double-send), so the line says what went
      // wrong rather than reading as a clean finish (audit M6). The
      // executor writes the step's output as this row's detail.
      const partial = partialSendFailure(detail);
      if (!partial) return base;
      const label = partialSendFailureLabel(partial);
      const summary = `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
      return `${base} (${summary}${partial.reason ? `: ${partial.reason}` : ''})`;
    }
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
      if (reason === 'quiet_hours') return `${base} (held until your quiet hours end)`;
      // A wait the old recompute left with no wake time; the deploy-time
      // repair could not work one out safely, so the MC decides.
      if (reason === 'wake_lost') {
        return `${base} (its timer was lost in an update; skip it to carry on)`;
      }
      // The tenant send-volume guard (Task 15) parked this step; it
      // resumes on its own once the window it hit resets, no action
      // needed from the MC.
      if (reason === 'send_rate_limited') return `${base} (send limit reached, resuming automatically)`;
      // The daily send count could not be read (Task 30), so the send is
      // held rather than risk the cap. No limit was reached; it retries
      // every minute on its own.
      if (reason === 'send_check_unavailable') {
        return `${base} (sending check unavailable, retrying automatically)`;
      }
      // The account-wide stop (Task 18) held an automated send back. It
      // does not resume by itself: when the stop lifts it is skipped.
      if (reason === 'account_paused') return `${base} (held while all workflows are paused)`;
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
