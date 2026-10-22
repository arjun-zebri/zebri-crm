'use client';

import { TEMPLATES as PROPOSALS } from '../proposals/templates-data';

import type { JourneyStep, StepKind } from './journeys-data';
import { StepChoice } from './step-choice';
import { StepRow } from './step-row';

/**
 * Which template a document step sends, as the first row of the step
 * panel: a dropdown of the MC's templates for its kind, only choices.
 * Changing the template itself is Open editor, over the preview; an
 * "Edit" in the list did the same thing and read as something else
 * (founder, 2026-10-08).
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-template
 */

type DocKind = Exclude<StepKind, 'email' | 'todo' | 'day'>;

/** The MC's templates for each kind, as the demo has them. */
const CHOICES: Record<DocKind, string[]> = {
  proposal: PROPOSALS.map((t) => t.name),
  contract: ['Standard MC agreement', 'Ceremony only agreement', 'Corporate event terms'],
  invoice: ['Deposit invoice', 'Balance invoice', 'Full fee invoice'],
  questionnaire: ['Wedding day details', 'Ceremony details', 'Event details'],
  runSheet: ['Ceremony to last dance', 'Event running order'],
};

export interface StepTemplateProps {
  step: JourneyStep;
  onChange: (step: JourneyStep) => void;
}

/** The row. See {@link StepTemplateProps}. */
export function StepTemplate({ step, onChange }: StepTemplateProps) {
  const kind = step.kind as DocKind;
  // A template saved under a name the list no longer has still shows, first.
  const choices = CHOICES[kind].includes(step.detail) ? CHOICES[kind] : [step.detail, ...CHOICES[kind]];
  return (
    <StepRow label="Template">
      <StepChoice label="Template" value={step.detail} options={choices} labelOf={(v) => v} onChange={(c) => onChange({ ...step, detail: c })} />
    </StepRow>
  );
}
