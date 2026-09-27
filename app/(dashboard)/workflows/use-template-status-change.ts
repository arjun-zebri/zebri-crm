'use client';

/**
 * The confirmation step in front of a workflow's on/off switch.
 *
 * Turning a workflow off pauses every couple running it, and turning it
 * back on can resume the couples that pause caught. Both are too
 * consequential to happen on a bare click, so both switches (the canvas
 * header and the library card) go through this one hook and say how many
 * couples the click will touch.
 *
 * The number is read from the server when the MC clicks, not from the
 * page's cached rows: it is a promise about what the click will do. At
 * zero there is nothing to promise, so the change applies with no
 * dialog.
 *
 * A Turn on also reads the pre-flight (Task 34) at the same moment. An
 * unfinished workflow gets the list of what to finish instead of a
 * confirmation, and the switch is never called. The server refuses it
 * anyway; this is so the MC sees the whole list rather than a toast.
 *
 * @module app/(dashboard)/workflows/use-template-status-change
 */

import { useRef, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import type { PreflightProblem } from '@/lib/workflows/preflight';
import type { TemplateStatus } from '@/types/workflows';

import {
  countTemplateEnrolmentsAction,
  templatePreflightAction,
  type TemplateStatusChange as ServerChange,
} from './actions';

/** The change waiting on the MC's answer. */
export interface PendingStatusChange {
  templateId: string;
  next: TemplateStatus;
  /** `off` pauses running couples; `on` can resume the ones it paused. */
  kind: 'off' | 'on';
  /**
   * Couples the click touches: running ones for `off`, ones the switch
   * paused for `on`. Null when the count could not be read, in which case
   * the dialog still asks rather than switching off unannounced.
   */
  couples: number | null;
}

/**
 * Applies a confirmed change. Throws when the server refuses it. Returns
 * what the server did when the caller has it, so a partial resume can be
 * reported.
 */
export type ApplyTemplateStatus = (
  templateId: string,
  next: TemplateStatus,
  resumePaused: boolean,
) => Promise<ServerChange | void>;

/** What {@link useTemplateStatusChange} hands its caller. */
export interface TemplateStatusChange {
  /** Ask for a change from `from` to `next`; confirms first when it must. */
  request: (templateId: string, from: string, next: TemplateStatus) => Promise<void>;
  /** True while the count is being read, before any dialog shows. */
  checking: boolean;
  /** Spread onto `TemplateStatusDialog`. */
  dialog: {
    pending: PendingStatusChange | null;
    /** What a refused Turn on found unfinished; null when nothing is. */
    blocked: PreflightProblem[] | null;
    onBlockedClose: () => void;
    resume: boolean;
    onResumeChange: (resume: boolean) => void;
    saving: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  };
}

/** One confirmation flow for every workflow on/off switch. */
export function useTemplateStatusChange(apply: ApplyTemplateStatus): TemplateStatusChange {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingStatusChange | null>(null);
  const [resume, setResume] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<PreflightProblem[] | null>(null);
  // A ref, not the state above: a double click fires both handlers
  // before React re-renders, so only a ref sees the first one in flight.
  const inFlight = useRef(false);

  async function run(templateId: string, next: TemplateStatus, resumePaused: boolean) {
    try {
      const result = await apply(templateId, next, resumePaused);
      if (result && result.stillPaused > 0) {
        const n = result.stillPaused;
        toast(
          `${n} ${n === 1 ? 'couple' : 'couples'} could not be resumed and ${n === 1 ? 'is' : 'are'} still paused. Turn it on again to retry.`,
          'error',
        );
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change the workflow.', 'error');
    }
  }

  async function request(templateId: string, from: string, next: TemplateStatus) {
    if (inFlight.current || pending || blocked) return;
    // Any move to off pauses whoever is still running, even from a
    // template already off (the server sweeps on every move to off).
    const turningOff = next !== 'active';
    const turningOn = from !== 'active' && next === 'active';
    if (!turningOff && !turningOn) return run(templateId, next, false);

    inFlight.current = true;
    setChecking(true);
    let checks;
    try {
      checks = await Promise.all([
        countTemplateEnrolmentsAction({ templateId }),
        // Only a Turn on is gated. An unreadable pre-flight falls through
        // to the switch, whose own server check refuses with the list.
        turningOn ? templatePreflightAction({ templateId }) : null,
      ]);
    } catch {
      // A server action that throws (a dropped connection) would
      // otherwise reject silently: the switch does nothing and says
      // nothing. The MC is told, and can press it again.
      toast('Could not check this workflow. Try again.', 'error');
      return;
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
    const [res, preflight] = checks;
    if (preflight?.ok && preflight.data.problems.length > 0) {
      setBlocked(preflight.data.problems);
      return;
    }
    const counts = res.ok ? res.data : null;
    const couples = counts ? (turningOff ? counts.running : counts.pausedByToggle) : null;
    // Turning on with an unreadable count simply turns on: resuming is
    // an opt-in, and without a count there is nothing honest to offer.
    if (couples === 0 || (turningOn && couples === null)) return run(templateId, next, false);

    setResume(false);
    setPending({ templateId, next, kind: turningOff ? 'off' : 'on', couples });
  }

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    await run(pending.templateId, pending.next, pending.kind === 'on' && resume);
    setSaving(false);
    setPending(null);
  }

  return {
    request,
    checking,
    dialog: {
      pending,
      blocked,
      onBlockedClose: () => setBlocked(null),
      resume,
      onResumeChange: setResume,
      saving,
      onConfirm: () => void confirm(),
      onCancel: () => setPending(null),
    },
  };
}
