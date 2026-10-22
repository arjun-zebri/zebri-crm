'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { LayoutTemplateIcon, TemplatesIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { useTemplateChoices } from '../../doc-builder/doc-types/proposal/template-store';
import type { TemplateId } from '../templates-data';

import { TemplateChoiceCard } from './template-choice-card';

/**
 * New template: a name and the page to start from (one of Zebri's four,
 * as the MC has them), then Create, which opens it in the editor. A
 * template is never built from a blank page: a premium start is a page
 * that already reads well. On the v2 dialog anatomy: the name is an
 * option G line (its icon, then the words), the starting pages are picture cards under a group
 * label, and there is no Cancel.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates/new-template-dialog
 */

export interface NewTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  /** The name typed and the layout it starts from. */
  onCreate: (name: string, base: TemplateId) => void;
}

/** The dialog. Keyed by the caller, so each opening starts fresh. See {@link NewTemplateDialogProps}. */
export function NewTemplateDialog({ open, onClose, onCreate }: NewTemplateDialogProps) {
  const builtIn = useTemplateChoices().filter((c) => !c.custom);
  const [name, setName] = useState('');
  const [base, setBase] = useState<TemplateId>('full-day');
  const ok = name.trim().length > 0;
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="new-template-title">
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onCreate(name.trim(), base);
        }}
      >
        <DialogHeader id="new-template-title" icon={TemplatesIcon} title="New template" />
        <DialogBody className="space-y-6">
          <Input icon={LayoutTemplateIcon} label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div role="radiogroup" aria-labelledby="new-template-base" className="space-y-2">
            <GroupLabel id="new-template-base">Start from</GroupLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {builtIn.map((c) => (
                <TemplateChoiceCard key={c.key} choice={c} selected={base === c.template.id} onSelect={() => setBase(c.template.id)} />
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="submit" disabled={!ok}>
            Create template
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
