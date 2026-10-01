'use client';

import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { uid, type DocKind, type Step, type StepKind } from '../model';
import { CONDITIONS } from '../triggers';

import { STEP_ICON } from './step-icons';

/**
 * The + between two lines of the story, and the menu it opens: what can
 * happen next, in four short groups. Picking one drops a ready-made step
 * in place (an email comes with a first draft, not an empty form) and
 * selects it, so the step panel opens on it. `trigger` swaps the small +
 * for the story's "Add a step" button at the end.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/insert-menu
 */

type Pick = { label: string; kind: StepKind; make: () => Step };

const doc = (d: DocKind): Pick => ({
  label: d === 'Questionnaire' ? 'Send the questionnaire' : `Send the ${d.toLowerCase()}`,
  kind: 'document',
  make: () => ({ id: uid(), kind: 'document', timing: { mode: 'after', n: 1, unit: 'days' }, doc: d, approve: false }),
});

const GROUPS: { title: string; picks: Pick[] }[] = [
  { title: 'Send', picks: [
    { label: 'Email', kind: 'email', make: () => ({ id: uid(), kind: 'email', timing: { mode: 'after', n: 2, unit: 'days' }, approve: false, subject: 'Just checking in', body: 'Hi {{first names}},\n\nJust checking in ahead of {{event date}}.\n\nSpeak soon,\nArjun' }) },
    doc('Proposal'), doc('Contract'), doc('Invoice'), doc('Questionnaire'), doc('Run sheet'),
  ] },
  { title: 'For you', picks: [
    { label: 'To-do', kind: 'todo', make: () => ({ id: uid(), kind: 'todo', timing: { mode: 'after', n: 1, unit: 'days' }, title: 'New to-do' }) },
    { label: 'Meeting', kind: 'appointment', make: () => ({ id: uid(), kind: 'appointment', timing: { mode: 'after', n: 1, unit: 'weeks' }, title: 'Planning call' }) },
  ] },
  { title: 'Logic', picks: [
    { label: 'If…', kind: 'if', make: () => ({ id: uid(), kind: 'if', timing: { mode: 'after', n: 3, unit: 'days' }, condition: CONDITIONS[4]!, then: [] }) },
    { label: 'Change stage', kind: 'stage', make: () => ({ id: uid(), kind: 'stage', timing: { mode: 'now' }, stage: 'Planning' }) },
    { label: 'Start another workflow', kind: 'start', make: () => ({ id: uid(), kind: 'start', timing: { mode: 'now' }, workflow: 'wf-fortnight' }) },
  ] },
];

export interface InsertMenuProps {
  onPick: (step: Step) => void;
  /** Where it lands, for the button's name: "after Welcome aboard!". */
  where: string;
  /** A visible trigger instead of the small +. */
  trigger?: ReactNode;
}

/** The + and its menu. See {@link InsertMenuProps}. */
export function InsertMenu({ onPick, where, trigger }: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" square round aria-label={`Add a step ${where}`} active={open}>
            <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent size="menu" align="start" role="menu" aria-label="Add a step" className="max-h-[var(--radix-popover-content-available-height)] w-60 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.title} className="py-1 first:pt-0">
            <p className="px-2 pb-1 pt-1.5 type-body text-zebra-400">{g.title}</p>
            {g.picks.map((p) => {
              const Icon = STEP_ICON[p.kind];
              return (
                <MenuOption
                  key={p.label}
                  onSelect={() => {
                    setOpen(false);
                    onPick(p.make());
                  }}
                >
                  <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-zebra-500" />
                  {p.label}
                </MenuOption>
              );
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
