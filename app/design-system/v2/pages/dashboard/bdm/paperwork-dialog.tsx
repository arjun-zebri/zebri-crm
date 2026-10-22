'use client';

import { useState } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { BdmIcon } from '@/components/ui-v2/icons';

import { useAccount } from '../account';

import { useCelebrant, usePaperwork } from './bdm-store';
import { openCoupleForm, senderOf } from './couple-form-link';
import { LodgeDialog } from './lodge-dialog';
import { PaperworkSide } from './paperwork-side';
import type { Issue } from './rules';
import { useSendForm } from './send-form-dialog';
import { stepLabels, stepOf } from './status';
import { StepActions } from './step-actions';
import { StepTracker } from './step-tracker';
import { StepView } from './step-view';

/**
 * A couple's marriage paperwork, in an `xl` sheet of one height. Across
 * the top, the three steps it goes through (Couple's details, Before the
 * day, Lodge, with its date), opening on the one it is on; under them
 * only what that step needs, the couple's answers folded to a line each.
 * The button that moves it on is in the header beside Close (user,
 * 2026-10-15). On the right, past a hairline, the facts; the header runs
 * across the top on a hairline of its own, which the side's meets, as
 * Settings' bar meets its rail. Lodging
 * opens its own small dialog over this one, for the eRegistry login; See
 * what they see opens the couple's form in a new tab
 * (`couple-form-link.ts`).
 *
 * Rebuilt 2026-10-07 after the first version (the whole notice form
 * first, every check below it, seven states) was found too hard to
 * follow: three steps, one at a time, one button.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/paperwork-dialog
 */

export interface PaperworkDialogProps {
  /** The client whose paperwork is open; null keeps it shut. */
  client: string | null;
  onClose: () => void;
}

/** The paperwork dialog. See {@link PaperworkDialogProps}. */
export function PaperworkDialog({ client, onClose }: PaperworkDialogProps) {
  const p = usePaperwork(client ?? '');
  const [lodging, setLodging] = useState(false);
  const account = useAccount();
  const celebrant = useCelebrant();
  // A step looked back at; null follows the step it is on, so moving on shows the next one.
  const [looking, setLooking] = useState<number | null>(null);
  // The person whose answers an issue opened, so the step shows them.
  const [part, setPart] = useState<string | null>(null);
  // Every opening starts on the step it is on, not where the last couple was left.
  const [seen, setSeen] = useState(client);
  if (seen !== client) {
    setSeen(client);
    setLooking(null);
    setPart(null);
  }
  const sender = useSendForm();
  const current = p ? stepOf(p) : 0;
  // Moving on (a button in the step) returns the view to the step it is now on.
  const [stage, setStage] = useState(p?.stage);
  if (p && stage !== p.stage) {
    setStage(p.stage);
    setLooking(null);
    setPart(null);
  }
  const viewing = looking ?? current;
  const goto = (issue: Issue) => {
    const who = issue.key.split('.')[0] ?? null;
    // The venue and the notice are ticked Before the day.
    if (who === 'before') return (setPart(null), setLooking(1));
    if (who === 'after') return;
    // A person's answer opens under them; the two of you (related, relationship) under neither.
    setPart(who === 'p1' || who === 'p2' ? who : null);
    setLooking(0);
  };
  return (
    <Dialog open={Boolean(client && p)} onClose={onClose} size="xl" aria-labelledby="paperwork-title">
      {p ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-hairline">
            <DialogHeader
              id="paperwork-title"
              icon={BdmIcon}
              title={`Marriage paperwork · ${p.client}`}
              actions={
                <StepActions
                  paper={p}
                  step={viewing}
                  onPreview={() => openCoupleForm({ paper: p, from: senderOf(celebrant, account.business), brand: account.brand ?? null, email: account.contact?.email })}
                  onSend={() => sender.open(p.client)}
                  onLodge={() => setLodging(true)}
                />
              }
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <DialogBody underBar className="min-w-0 space-y-8">
              <StepTracker labels={stepLabels(p)} current={current} finished={p.stage === 'registered'} viewing={viewing} onView={(s) => (setPart(null), setLooking(s === current ? null : s))} />
              <StepView
                key={`${viewing}-${p.stage}-${part ?? ''}`}
                paper={p}
                step={viewing}
                openPart={part}
                onGoto={goto}
              />
            </DialogBody>
            <aside aria-label="Where it stands" className="flex shrink-0 flex-col border-t border-hairline lg:w-[22rem] lg:border-l lg:border-t-0">
              <PaperworkSide paper={p} />
            </aside>
          </div>
          <LodgeDialog key={lodging ? 'lodge-open' : 'lodge-shut'} open={lodging} paper={p} onClose={() => setLodging(false)} onGoto={goto} />
          {sender.dialog}
        </div>
      ) : null}
    </Dialog>
  );
}
