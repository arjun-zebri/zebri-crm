'use client';

import { useState } from 'react';

import { HOVER_ON_WHITE } from '@/components/ui-v2/control-styles';
import { PlusIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { newStep, STEP_ICON, type JourneyStep, type StepKind } from './journeys-data';

/**
 * Add a step: a menu of what a step can send. Two triggers: the line's
 * last slot, a circle on the line and words (the new step lands just before
 * the event), and `onLine`,
 * a small + on the line under a step that shows when the step is
 * hovered or focused (the new step lands right there). Either way it
 * comes with sensible timing and reminders, ready to move.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/add-step-menu
 */

const KINDS: { kind: Exclude<StepKind, 'day'>; label: string }[] = [
  { kind: 'email', label: 'Email' },
  { kind: 'proposal', label: 'Proposal' },
  { kind: 'contract', label: 'Contract' },
  { kind: 'invoice', label: 'Invoice' },
  { kind: 'questionnaire', label: 'Questionnaire' },
  { kind: 'runSheet', label: 'Run sheet' },
  { kind: 'todo', label: 'To-do for you' },
];

/** The menu; `onAdd` gets the new step. */
export function AddStepMenu({ onAdd, onLine = false }: { onAdd: (step: JourneyStep) => void; onLine?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {onLine ? (
          // Centred in the 12px gap under the step: half the gap (6px) plus half the button (12px) below its bottom edge.
          // Hand-rolled: a 24px chip riding the line, smaller than any Button.
          <button
            type="button"
            aria-label="Add a step here"
            className={`absolute -bottom-4.5 left-1/2 z-20 flex size-6 -translate-x-1/2 items-center justify-center rounded-pill bg-field text-zebra-600 shadow-sm ring-1 ring-hairline transition-[opacity,background-color] duration-150 ${HOVER_ON_WHITE} hover:text-zebra-950 focus-key:opacity-100 focus-mark group-hover:opacity-100 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
          >
            <PlusIcon aria-hidden="true" className="size-3.5" />
          </button>
        ) : (
          // The line's last slot: a circle on the line and the words beside it, one button.
          <button type="button" className="group/slot flex items-center gap-4 rounded-panel text-zebra-500 transition-colors duration-150 hover:text-zebra-950 focus-mark motion-reduce:transition-none">
            <span className="flex size-10 items-center justify-center rounded-pill bg-field ring-1 ring-hairline">
              <PlusIcon aria-hidden="true" className="size-4" />
            </span>
            <span className="type-body">Add a step</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent size="menu" align="start" role="menu" aria-label="Add a step">
        {KINDS.map(({ kind, label }) => {
          const Icon = STEP_ICON[kind];
          return (
            <MenuOption key={kind} onSelect={() => (setOpen(false), onAdd(newStep(kind)))}>
              <Icon aria-hidden="true" className="size-4 text-zebra-500" />
              {label}
            </MenuOption>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
