'use client';

import { Button } from '@/components/ui-v2/button';
import { DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EditIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { STEP_ICON, type Journey, type JourneyStep } from './journeys-data';
import { StepFollowUps } from './step-follow-ups';
import { StepKindRows } from './step-kind-rows';
import { StepTemplate } from './step-template';
import { StepTiming } from './step-timing';

/**
 * The step dialog's right-hand panel, after the founder's mockup
 * (2026-10-07), built from the dialog parts: the header is the step's
 * glyph, where it is ("Full weddings · Step 1") and Close; then the
 * step's name, typed straight onto the panel (renamed in place); its
 * settings, each a muted label on the left with a dropdown on the right
 * (the template a document step sends, When, Time, Sent by, the kind's
 * own in `StepKindRows`); then, after a gap, the Follow-ups section. The
 * emails themselves are on the page beside the panel. The foot holds
 * Remove step (Undo is offered on the page), Preview on a phone, where
 * the page is not beside the panel, and Done. No Cancel: changes apply
 * as they are made.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-panel
 */

export interface StepPanelProps {
  journey: Journey;
  step: JourneyStep;
  onChange: (step: JourneyStep) => void;
  onRemove: () => void;
  /** Shows a Remind follow-up's email on the page. */
  onPick: (item: string) => void;
  /** Shows the page, on a phone where it is not beside the panel. */
  onPreview: () => void;
  onClose: () => void;
}

/** The panel. See {@link StepPanelProps}. */
export function StepPanel({ journey, step, onChange, onRemove, onPick, onPreview, onClose }: StepPanelProps) {
  const at = journey.steps.findIndex((s) => s.id === step.id);
  // What "the step before" means for this step's timing; the wedding day marker counts.
  const prev = journey.steps[at - 1];
  // Counted as the MC sees them on the line: the wedding day marker is not a step.
  const number = journey.steps.filter((s) => s.kind !== 'day').findIndex((s) => s.id === step.id) + 1;
  // An invoice going with the contract has no timing of its own: it is on the contract's page.
  const withContract = step.kind === 'invoice' && prev?.kind === 'contract' && Boolean(step.withPrev);
  return (
    <section className="flex min-h-0 w-full flex-col md:w-96 md:shrink-0">
      <DialogHeader id="step-where" icon={STEP_ICON[step.kind]} title={`${journey.name} · Step ${number}`} size="md" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
        {/* Names the dialog; the name itself is the line under it, edited in place. */}
        <span id="step-title" className="sr-only">
          {step.name}
        </span>
        <Input icon={EditIcon} label="Step name" wide value={step.name} onChange={(e) => onChange({ ...step, name: e.target.value })} />
        <dl className="mt-4 space-y-1 type-body">
          {step.kind === 'email' ? null : <StepTemplate step={step} onChange={onChange} />}
          {withContract ? null : <StepTiming step={step} prev={prev} onChange={onChange} starts={Boolean(journey.starts)} />}
          <StepKindRows step={step} onChange={onChange} />
        </dl>
        <div className="mt-8 type-body">
          <StepFollowUps step={step} onChange={onChange} onPick={onPick} />
        </div>
      </div>
      <DialogFooter size="md">
        <Button variant="plain" onClick={onRemove}>
          Remove step
        </Button>
        <Button variant="secondary" className="md:hidden" onClick={onPreview}>
          Preview
        </Button>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </section>
  );
}
