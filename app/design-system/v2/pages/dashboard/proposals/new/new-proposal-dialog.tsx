'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ProposalIcon } from '@/components/ui-v2/icons';

import { useTemplateChoices } from '../../doc-builder/doc-types/proposal/template-store';

import { CoupleStep, NEW } from './couple-step';

/**
 * New proposal: one question, who it is for, then Ready to send, where
 * the template is a dropdown beside the page it makes (2026-10-08
 * review: a second step to pick a template before seeing anything was
 * one more decision in the way, and a client already named skips this
 * dialog altogether). "Use for a couple" on a template opens it with
 * that template carried through. On the v2 dialog anatomy, with no
 * Cancel (Escape, the scrim and Close leave). Keyed by the caller, so each opening
 * starts fresh.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/new/new-proposal-dialog
 */

export interface NewProposalDialogProps {
  open: boolean;
  /** A template key to start with; the first template otherwise. */
  template: string | null;
  onClose: () => void;
  /** The couple's display name and the template key, and the typed names for Someone new. */
  onCreate: (couple: string, template: string, names?: [string, string]) => void;
}

/** The New proposal dialog. See {@link NewProposalDialogProps}. */
export function NewProposalDialog({ open, template, onClose, onCreate }: NewProposalDialogProps) {
  const choices = useTemplateChoices();
  const [couple, setCouple] = useState<string | null>(null);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const who = couple === NEW ? (names[0].trim() && names[1].trim() ? `${names[0].trim()} & ${names[1].trim()}` : null) : couple;
  const key = template ?? choices[0]?.key ?? null;
  function create() {
    if (!who || !key) return;
    onCreate(who, key, couple === NEW ? [names[0].trim(), names[1].trim()] : undefined);
  }
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="new-proposal-title">
      <DialogHeader id="new-proposal-title" icon={ProposalIcon} title="New proposal" />
      <DialogBody>
        <CoupleStep value={couple} onChange={setCouple} names={names} onNames={setNames} />
      </DialogBody>
      <DialogFooter>
        <Button disabled={!who} onClick={create}>
          Continue
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
