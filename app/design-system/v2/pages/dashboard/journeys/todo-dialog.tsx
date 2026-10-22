'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { CalendarIcon, ClockIcon, TaskIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { Textarea } from '@/components/ui-v2/textarea';

import type { Journey, JourneyStep } from './journeys-data';
import { HOURS, sendAtOf } from './step-settings';
import { isTimed, WhenPicker, whenLabel } from './step-timing';

/**
 * A to-do step, opened from its card. It sends the client nothing, so
 * it has no page beside it: a form dialog built like New client, from the
 * dialog parts. The header is the to-do glyph and where it sits; then the
 * job as a line led by the to-do glyph ("Call to go over the night"); when it comes due (and the hour, when it is set days from
 * something) as `PropertyChip`s that say their value ("3 days after the
 * proposal", "At 9:00 am"); and the notes on what to cover as a
 * textarea under them. Remove step (the page offers Undo) and Done
 * sit in the foot; no Cancel, as changes save as they are made.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/todo-dialog
 */

export interface TodoDialogProps {
  journey: Journey;
  step: JourneyStep;
  onChange: (step: JourneyStep) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** The dialog. See {@link TodoDialogProps}. */
export function TodoDialog({ journey, step, onChange, onRemove, onClose }: TodoDialogProps) {
  const [open, setOpen] = useState<'when' | 'time' | null>(null);
  const prev = journey.steps[journey.steps.findIndex((s) => s.id === step.id) - 1];
  const number = journey.steps.filter((s) => s.kind !== 'day').findIndex((s) => s.id === step.id) + 1;
  const starts = Boolean(journey.starts);
  const toggle = (w: 'when' | 'time') => (o: boolean) => setOpen(o ? w : null);
  return (
    <Dialog open onClose={onClose} size="form" aria-labelledby="step-title">
      <DialogHeader id="step-where" icon={TaskIcon} title={`Your to-do · ${journey.name} · Step ${number}`} />
      <DialogBody className="flex flex-col gap-6">
        {/* Names the dialog; the job itself is the line under it, edited in place. */}
        <span id="step-title" className="sr-only">
          {step.name}
        </span>
        {/* The job is the step's name and its card's words, so both change together. */}
        <Input
          icon={TaskIcon}
          label="What to do"
          wide
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value, detail: e.target.value })}
          data-autofocus
        />
        <div className="-mx-2.5 flex flex-wrap gap-1">
          <PropertyChip icon={CalendarIcon} label="When" value={whenLabel(step, prev, starts)} open={open === 'when'} onOpenChange={toggle('when')} size="menu">
            <WhenPicker step={step} prev={prev} starts={starts} onChange={onChange} onPick={() => setOpen(null)} />
          </PropertyChip>
          {isTimed(step) ? (
            <PropertyChip icon={ClockIcon} label="Time" value={`At ${sendAtOf(step)}`} open={open === 'time'} onOpenChange={toggle('time')} size="menu">
              {HOURS.map((h) => (
                <MenuOption key={h} selected={h === sendAtOf(step)} onSelect={() => (setOpen(null), onChange({ ...step, sendAt: h }))}>
                  {h}
                </MenuOption>
              ))}
            </PropertyChip>
          ) : null}
        </div>
        <Textarea rows={4} label="Notes" value={step.notes ?? ''} onChange={(e) => onChange({ ...step, notes: e.target.value })} />
      </DialogBody>
      <DialogFooter>
        <Button variant="plain" onClick={onRemove}>
          Remove step
        </Button>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}
