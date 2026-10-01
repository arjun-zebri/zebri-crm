'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import type { TemplateId } from '../templates-data';

import { CoupleStep, NEW } from './couple-step';
import { TemplateStep } from './template-step';

/**
 * New proposal: a `form` dialog in two short steps, who it is for and
 * which template to start from, then Create. In this preview Create
 * lands on the builder stub, which names the couple and template, so
 * the first real step of the flow is here without the builder.
 * "Use for a couple" on a template opens it with that template already
 * picked. For an account that can send, Create opens the proposal
 * editor instead, where the brand, words and price are set.
 * Keyed by the caller, so each opening starts fresh.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/new/new-proposal-dialog
 */

export interface NewProposalDialogProps {
  open: boolean;
  /** A template to start with picked. */
  template: TemplateId | null;
  /** A client to start with picked, by display name. */
  couple?: string | null | undefined;
  onClose: () => void;
  /** The couple's display name and the template, and the typed names for Someone new. */
  onCreate: (couple: string, template: TemplateId, names?: [string, string]) => void;
}

type Step = 'couple' | 'template';

/** The New proposal dialog. See {@link NewProposalDialogProps}. */
export function NewProposalDialog({ open, template, couple: startCouple = null, onClose, onCreate }: NewProposalDialogProps) {
  // A client picked by the caller skips straight to the look.
  const [step, setStep] = useState<Step>(startCouple ? 'template' : 'couple');
  const [couple, setCouple] = useState<string | null>(startCouple);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [picked, setPicked] = useState<TemplateId | null>(template);
  const who = couple === NEW ? (names[0].trim() && names[1].trim() ? `${names[0].trim()} & ${names[1].trim()}` : null) : couple;
  function create() {
    if (!who || !picked) return;
    onCreate(who, picked, couple === NEW ? [names[0].trim(), names[1].trim()] : undefined);
  }
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="new-proposal-title">
      <header className="flex items-baseline justify-between gap-4 border-b border-zebra-950/5 px-6 py-4">
        <h2 id="new-proposal-title" className="type-subheading text-zebra-950">
          New proposal
        </h2>
        <p className="type-body text-zebra-500">
          Step {step === 'couple' ? 1 : 2} of 2
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {step === 'couple' ? (
          <CoupleStep value={couple} onChange={setCouple} names={names} onNames={setNames} />
        ) : (
          <TemplateStep who={who} value={picked} onChange={setPicked} />
        )}
      </div>
      <footer className="flex items-center justify-end gap-3 border-t border-zebra-950/5 px-6 py-4">
        {step === 'couple' ? (
          <>
            <Button variant="plain" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!who} onClick={() => setStep('template')}>
              Next
            </Button>
          </>
        ) : (
          <>
            <Button variant="plain" onClick={() => setStep('couple')}>
              Back
            </Button>
            <Button disabled={!picked} onClick={create}>
              Create proposal
            </Button>
          </>
        )}
      </footer>
    </Dialog>
  );
}
