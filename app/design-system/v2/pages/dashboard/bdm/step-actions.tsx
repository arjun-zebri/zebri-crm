'use client';

import { Button } from '@/components/ui-v2/button';

import { married, type Paperwork } from './bdm-data';
import { checkStatus, markChecked, remind, simulateMeeting, simulateReturn, simulateWedding } from './bdm-store';
import { issuesOf } from './rules';
import { checksLeft, solemnisationLeft } from './status';

/**
 * The paperwork dialog's actions for the step on screen, in its header
 * beside Close (user, 2026-10-15: the call to action at the top right,
 * next to the X), the way `DialogHeader actions` places every dialog's:
 * the primary last, nearest Close, anything secondary before it (See
 * what they see), and a quiet line on what a disabled button waits for
 * ("3 to go"). Before, each step's button sat at the foot of the step,
 * floating mid-dialog under a short list.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/step-actions
 */

export interface StepActionsProps {
  paper: Paperwork;
  /** The step on screen (0 Couple's details, 1 Before the day, 2 Lodge). */
  step: number;
  /** Opens the couple's form as they see it. */
  onPreview: () => void;
  /** Opens the send confirm. */
  onSend: () => void;
  /** Opens the lodge dialog. */
  onLodge: () => void;
}

/** A quiet line before the button, on what it waits for; hidden on phones, where the row is short. */
function Note({ text }: { text: string | null }) {
  return text ? <span className="hidden whitespace-nowrap type-body text-zebra-500 md:inline">{text}</span> : null;
}

/** The step's actions. See {@link StepActionsProps}. */
export function StepActions({ paper: p, step, onPreview, onSend, onLodge }: StepActionsProps) {
  const locked = p.stage === 'lodged' || p.stage === 'registered';
  const issues = locked ? [] : issuesOf(p);
  if (step === 0)
    return (
      <>
        {/* Demo only (user, 2026-10-15): the couple's answers, back at once. */}
        {p.stage === 'draft' || p.stage === 'sent' ? (
          <Button variant="plain" onClick={() => simulateReturn(p.client)}>
            Simulate their answers
          </Button>
        ) : null}
        <Button variant="plain" onClick={onPreview}>
          See what they see
        </Button>
        {p.stage === 'draft' ? <Button onClick={onSend}>Send to couple</Button> : null}
        {p.stage === 'sent' ? (
          <Button variant="secondary" onClick={() => remind(p.client)}>
            {p.remindedOn ? 'Remind again' : 'Remind'}
          </Button>
        ) : null}
      </>
    );
  if (step === 1) {
    if (p.stage !== 'returned') return null;
    const left = checksLeft(p);
    const before = issues.filter((i) => !i.key.startsWith('after.'));
    return (
      <>
        <Note text={left ? `${left} to go` : before.length ? 'Fix what BDM won’t accept first' : null} />
        {/* Demo only (user, 2026-10-16): the notice signed in front of them, every tick in. */}
        {left > 0 ? (
          <Button variant="plain" onClick={() => simulateMeeting(p.client)}>
            Simulate the meeting
          </Button>
        ) : null}
        <Button disabled={left > 0 || before.length > 0} onClick={() => markChecked(p.client)}>
          {/* What it records, in the words the history uses (user, 2026-10-15: "Notice is in order makes no sense"). */}
          Mark notice signed
        </Button>
      </>
    );
  }
  if (p.stage === 'checked' && !married(p))
    return (
      // Demo only (user, 2026-10-15): the day has been, the certificate signed, so lodging can be tried.
      <Button variant="plain" onClick={() => simulateWedding(p.client)}>
        Simulate the wedding
      </Button>
    );
  if (p.stage === 'lodged' && p.registry === 'Non Compliant')
    return (
      <Button variant="secondary" onClick={() => checkStatus(p.client)}>
        Check with BDM
      </Button>
    );
  if (locked) return null;
  const signed = solemnisationLeft(p);
  return (
    <>
      <Note text={signed ? `${signed} to go on the certificate` : issues.length ? 'Fix what BDM won’t accept first' : null} />
      <Button disabled={signed > 0 || issues.length > 0} onClick={onLodge}>
        Lodge with BDM
      </Button>
    </>
  );
}
