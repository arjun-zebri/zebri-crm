'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import { CoupleStep, NEW } from '../proposals/new/couple-step';
import { TemplateStep } from '../proposals/new/template-step';
import { templateOf, type TemplateId } from '../proposals/templates-data';

import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DoneView,
  EmailStep,
  useSend,
} from './dialog-parts';

/**
 * Send a proposal, from Home's quick starts: an `md` dialog (one height
 * throughout) in three steps. Who it is for and which template are the
 * same steps as New proposal on the Proposals page; the third is the
 * email Zebri has written to go with it, as ordinary fields to edit.
 * Send lands on a done view with a way through to Proposals.
 * Keyed by the caller, so each opening starts fresh.
 *
 * @module app/design-system/v2/pages/dashboard/home/send-proposal-dialog
 */

export interface SendProposalDialogProps {
  open: boolean;
  onClose: () => void;
  /** Leaves Home for the Proposals page. */
  onViewAll: () => void;
}

type Step = 'couple' | 'template' | 'message' | 'sent';
const STEP_NO: Record<Step, number> = { couple: 1, template: 2, message: 3, sent: 3 };

function draft(who: string, t: TemplateId) {
  const first = who.split(' & ')[0] ?? who;
  return {
    subject: `Your ${templateOf(t).name} proposal`,
    body: `Hi ${first},\n\nIt was lovely hearing about your plans. Here's your proposal, with the packages that suit your day. Pick the one you like and accept it right there; your date is held once the deposit is in.\n\nAny questions at all, just reply.\n\nWarmly,\nArjun`,
  };
}

/** The Send a proposal dialog. See {@link SendProposalDialogProps}. */
export function SendProposalDialog({ open, onClose, onViewAll }: SendProposalDialogProps) {
  const [step, setStep] = useState<Step>('couple');
  const [couple, setCouple] = useState<string | null>(null);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [picked, setPicked] = useState<TemplateId | null>(null);
  const [mail, setMail] = useState({ subject: '', body: '' });
  const { busy, send } = useSend();
  const who =
    couple === NEW
      ? names[0].trim() && names[1].trim()
        ? `${names[0].trim()} & ${names[1].trim()}`
        : null
      : couple;
  const toMessage = () => {
    if (!who || !picked) return;
    setMail(draft(who, picked));
    setStep('message');
  };
  return (
    <Dialog open={open} onClose={onClose} size="md" aria-labelledby="send-proposal-title">
      <DialogHeader
        id="send-proposal-title"
        title="Send a proposal"
        note={step === 'sent' ? undefined : `Step ${STEP_NO[step]} of 3`}
      />
      {step === 'sent' ? (
        <DoneView
          title={`Proposal sent to ${who}`}
          detail="Zebri will tell you when they open it, and nudge them for you if they go quiet."
        />
      ) : (
        <DialogBody>
          {step === 'couple' ? (
            <CoupleStep value={couple} onChange={setCouple} names={names} onNames={setNames} />
          ) : step === 'template' ? (
            <TemplateStep who={who} value={picked} onChange={setPicked} />
          ) : (
            <EmailStep
              intro={`${picked ? templateOf(picked).name : ''} for ${who}, with this email`}
              mail={mail}
              onChange={setMail}
              disabled={busy}
            />
          )}
        </DialogBody>
      )}
      <DialogFooter>
        {step === 'couple' ? (
          <>
            <Button variant="plain" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!who} onClick={() => setStep('template')}>
              Next
            </Button>
          </>
        ) : step === 'template' ? (
          <>
            <Button variant="plain" onClick={() => setStep('couple')}>
              Back
            </Button>
            <Button disabled={!picked} onClick={toMessage}>
              Next
            </Button>
          </>
        ) : step === 'message' ? (
          <>
            <Button variant="plain" onClick={() => setStep('template')} disabled={busy}>
              Back
            </Button>
            <Button
              loading={busy}
              disabled={!mail.subject.trim() || !mail.body.trim()}
              onClick={() => send(() => setStep('sent'))}
            >
              Send proposal
            </Button>
          </>
        ) : (
          <>
            <Button variant="plain" onClick={onViewAll}>
              Open Proposals
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
