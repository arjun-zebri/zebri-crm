'use client';

/**
 * What stands between a workflow and Turn on, as the MC reads it.
 *
 * The dialog a Turn on opens instead of turning on, listing the
 * pre-flight rows (`lib/workflows/preflight`): each step's name, then
 * what to do about it. The canvas banner on a workflow already on words
 * the same rows as one sentence instead (`[id]/unfinished-steps-banner`).
 *
 * @module app/(dashboard)/workflows/preflight-list
 */

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { PreflightProblem } from '@/lib/workflows/preflight';

/** The rows: the step's name, then what to do about it. */
function PreflightList({ problems }: { problems: readonly PreflightProblem[] }) {
  return (
    <ul className="space-y-2">
      {problems.map((p) => (
        <li key={p.stepId ?? 'workflow'} className="text-body">
          <span className="font-semibold text-text">{p.title}</span>
          <span className="block text-text-muted">{p.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Finish this step first" / "Finish these steps first". */
export function preflightHeading(problems: readonly PreflightProblem[]): string {
  if (problems.some((p) => p.stepId === null)) return 'Finish this workflow first';
  return problems.length === 1 ? 'Finish this step first' : 'Finish these steps first';
}

interface DialogProps {
  /** The problems the click found; null or empty keeps it closed. */
  problems: readonly PreflightProblem[] | null;
  onClose: () => void;
}

/**
 * Opened instead of turning on. There is nothing to confirm: the only
 * way forward is to finish the steps, so the one button closes it.
 */
export function PreflightDialog({ problems, onClose }: DialogProps) {
  const open = problems !== null && problems.length > 0;
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="sm"
      title={open ? preflightHeading(problems) : ''}
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>OK</Button>
        </div>
      }
    >
      <p className="mb-3 text-body text-text-muted">
        {open && problems.length === 1 ? 'Finish this, then turn it on.' : 'Finish these, then turn it on.'}
      </p>
      {open && <PreflightList problems={problems} />}
    </Modal>
  );
}
