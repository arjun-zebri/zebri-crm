'use client';

import type { ReactNode } from 'react';

import { DateField } from '@/components/ui-v2/date-field';

import { isoOf, married, weddingDate, weddingDay, type Paperwork } from './bdm-data';
import { setCheck, setWeddingDate } from './bdm-store';
import { CheckGroups } from './check-groups';
import { afterGroups, beforeGroups, type CheckGroup } from './checks';
import { IssuesList } from './issues-list';
import { missing } from './noim-questions';
import { issuesOf, type Issue } from './rules';
import { dueOf } from './status';
import { TheirAnswers } from './their-answers';

/**
 * What one step of a couple's paperwork shows, under the tracker: a line
 * saying what happens in it and only what that step needs. The button
 * that moves it on is in the dialog's header, beside Close
 * (`step-actions.tsx`).
 * Couple's details is their answers, folded; Before the day is the
 * notice, a person at a time; Lodge is the certificate of marriage once
 * the day has been, anything BDM won’t accept, and Lodge with BDM.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/step-view
 */

export interface StepViewProps {
  paper: Paperwork;
  step: number;
  /** Shows the answer an issue is about. */
  onGoto: (issue: Issue) => void;
  /** The person whose answers start open (`p1`, `p2`). */
  openPart?: string | null | undefined;
}

/** One step. See {@link StepViewProps}. */
export function StepView({ paper: p, step, onGoto, openPart = null }: StepViewProps) {
  const locked = p.stage === 'lodged' || p.stage === 'registered';
  // "Amelia and Jack", or just "Arjun" while the second name is blank: never "Arjun and :".
  const pair = p.names.map((n) => n.trim()).filter(Boolean).join(' and ') || 'the couple';
  const set = (id: string, v: string | string[]) => setCheck(p.client, id, v);
  const issues = locked ? [] : issuesOf(p);
  if (step === 0) {
    const left = missing(p).length;
    const line =
      p.stage === 'draft'
        ? `Send ${pair} their form. They answer what the notice asks on their phone, and it comes back here.`
        : p.stage === 'sent'
          ? `Sent to ${pair}${p.sentOn ? ` on ${p.sentOn}` : ''}. Their answers appear here as they fill them in; ${left} to go.`
          : locked
            ? `What ${pair} gave you, as it went to BDM.`
            : `${pair} sent their details back. Edit any answer that needs fixing.`;
    return (
      <Step line={line}>
        <TheirAnswers paper={p} locked={locked} initial={openPart} />
        {p.stage === 'returned' ? <IssuesList client={p.client} issues={issues.filter((i) => i.key.startsWith('p'))} onGoto={onGoto} /> : null}
      </Step>
    );
  }
  if (step === 1) {
    // Everything but the certificate, which comes after the day: a notice is not in order while its answers would be turned away.
    const before = issues.filter((i) => !i.key.startsWith('after.'));
    const groups = beforeGroups(p);
    const { problems, rest } = placed(groups, before);
    return (
      <Step line="When you meet them, tick off the notice as it is signed in front of you.">
        <CheckGroups groups={groups} values={p.checks} onChange={set} problems={problems} locked={locked} />
        <IssuesList client={p.client} issues={rest} onGoto={onGoto} />
      </Step>
    );
  }
  if (p.stage === 'checked' && !married(p)) {
    // The wedding's day is what opens lodging; a client booked without one would wait here for ever, so it is asked in place.
    const dated = weddingDate(p);
    return (
      <Step
        line={
          dated
            ? `All set for the day. After the wedding on ${weddingDay(p)}, come back to tick off the certificate of marriage and lodge it.`
            : 'All set for the day. Add the wedding date: once the day has been, you tick off the certificate of marriage here and lodge it.'
        }
      >
        <div className="max-w-md">
          <DateField row label="Wedding date" value={dated ? isoOf(dated) : ''} onChange={(iso) => setWeddingDate(p.client, iso)} />
        </div>
      </Step>
    );
  }
  const groups = afterGroups(p);
  const { problems, rest } = placed(groups, issues);
  return (
    <Step
      line={
        p.stage === 'registered'
          ? `Registered with NSW BDM${p.registration ? `, registration ${p.registration}` : '. BDM emails you the registration number'}. Nothing left to do.`
          : p.stage === 'lodged'
            ? lodgedLine(p)
            : `From the certificate of marriage signed on the day. ${dueOf(p)}.`
      }
    >
      <CheckGroups groups={groups} values={p.checks} onChange={set} problems={problems} locked={locked} />
      {locked ? null : <IssuesList client={p.client} issues={rest} onGoto={onGoto} />}
    </Step>
  );
}

/** What a lodged notice is waiting on, in the Registry's own terms. */
function lodgedLine(p: Paperwork) {
  const n = `Lodged with NSW BDM, notification ${p.notification ?? ''}.`;
  // Lodged from Zebri, it never shows in eRegistry: the Registry keeps the two apart.
  const where = 'It will not appear in your eRegistry list.';
  // statusQuery says only "Non Compliant", never why, so the line says what the celebrant can do: wait for BDM, not lodge again.
  if (p.registry === 'Non Compliant')
    return `${n} BDM has it, but its staff need to check something before registering it. BDM does not say what through Zebri: they will contact you${p.notification ? `, quoting ${p.notification}` : ''}. Do not lodge it again, or BDM will see a duplicate. If you have not heard in five working days, call NSW BDM on 13 77 88. ${where}`;
  if (p.registry === 'Suspended') return `${n} BDM has suspended it. Call the Registry to find out why.`;
  if (p.registry === 'Cancelled') return `${n} BDM cancelled it. Call the Registry before lodging again.`;
  return `${n} Registration usually takes a few days; Zebri tells you the moment it is done. ${where}`;
}

/**
 * The issues about these checks placed under their own fields, and the
 * rest, which have no field here, for the list at the foot (a problem a
 * screen away from its field was the old way; user, 2026-10-15).
 */
function placed(groups: CheckGroup[], issues: Issue[]) {
  const ids = new Set(groups.flatMap((g) => g.checks.map((c) => c.id)));
  const problems: Record<string, string> = {};
  const rest: Issue[] = [];
  issues.forEach((i) => {
    const id = i.key.replace(/^(before|after)\./, '');
    const here = i.key !== id && ids.has(id);
    if (here) problems[id] ??= i.problem;
    // One with a certain fix stays in the list too, for its one-click Fix.
    if (!here || i.fix) rest.push(i);
  });
  return { problems, rest };
}

function Step({ line, children }: { line: string; children?: ReactNode }) {
  return (
    <div className="space-y-6 motion-safe:animate-fade-in">
      <p className="max-w-xl type-body text-zebra-600">{line}</p>
      {children}
    </div>
  );
}
