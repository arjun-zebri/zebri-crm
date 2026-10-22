'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { BlocksIcon, CodeIcon, ImportIcon, TemplatesIcon } from '@/components/ui-v2/icons';

/**
 * New template, from the Templates toolbar: a `form` dialog asking how
 * to make it. Blocks in the MC's branding is the default; MCs who
 * already design emails elsewhere can paste their own HTML or bring a
 * Stripo export across with its design intact. Continue hands the pick
 * to the page, which opens the builder stub. Built from the dialog parts,
 * with no Cancel: Escape, a click outside or Close leave.
 *
 * @module app/design-system/v2/pages/dashboard/email/new/new-template-dialog
 */

const WAYS = [
  { label: 'Build with blocks', note: 'Drag and drop in your branding', icon: BlocksIcon },
  { label: 'Paste HTML', note: 'Bring your own code', icon: CodeIcon },
  { label: 'Import from Stripo', note: 'Paste the export, keeps your design', icon: ImportIcon },
] as const;

export interface NewTemplateDialogProps {
  open: boolean;
  /** Called with the chosen way's label. */
  onPick: (how: string) => void;
  onClose: () => void;
}

/** The dialog. See {@link NewTemplateDialogProps}. */
export function NewTemplateDialog({ open, onPick, onClose }: NewTemplateDialogProps) {
  const [how, setHow] = useState<string>(WAYS[0].label);
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="new-template-title">
      <DialogHeader id="new-template-title" icon={TemplatesIcon} title="New template" />
      <DialogBody className="space-y-6">
        <p className="type-title text-zebra-950">How do you want to make it?</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {WAYS.map(({ label, note, icon: Icon }) => (
            <ChoiceCard key={label} selected={how === label} onClick={() => setHow(label)} className="gap-2">
              <Icon aria-hidden="true" className="size-4 text-zebra-500" />
              <span className="type-label">{label}</span>
              <span className="type-body text-zebra-500">{note}</span>
            </ChoiceCard>
          ))}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => onPick(how)}>Continue</Button>
      </DialogFooter>
    </Dialog>
  );
}
