'use client';

import { Blocks, Code, Import } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Dialog } from '@/components/ui-v2/dialog';

/**
 * New template, from the Templates toolbar: a `form` dialog asking how
 * to make it. Blocks in the MC's branding is the default; MCs who
 * already design emails elsewhere can paste their own HTML or bring a
 * Stripo export across with its design intact. Continue hands the pick
 * to the page, which opens the builder stub.
 *
 * @module app/design-system/v2/pages/dashboard/email/new/new-template-dialog
 */

const WAYS = [
  { label: 'Build with blocks', note: 'Drag and drop in your branding', icon: Blocks },
  { label: 'Paste HTML', note: 'Bring your own code', icon: Code },
  { label: 'Import from Stripo', note: 'Paste the export, keeps your design', icon: Import },
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
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 id="new-template-title" className="type-title text-zebra-950">
            New template
          </h2>
          <p className="type-body text-zebra-500">How do you want to make it?</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {WAYS.map(({ label, note, icon: Icon }) => (
            <ChoiceCard key={label} selected={how === label} onClick={() => setHow(label)} className="gap-2">
              <Icon aria-hidden="true" strokeWidth={1.5} className="size-5 text-zebra-600" />
              <span className="type-label">{label}</span>
              <span className="type-body text-zebra-500">{note}</span>
            </ChoiceCard>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onPick(how)}>Continue</Button>
        </div>
      </div>
    </Dialog>
  );
}
