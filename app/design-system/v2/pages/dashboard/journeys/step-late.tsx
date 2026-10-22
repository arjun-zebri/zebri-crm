'use client';

import type { JourneyStep } from './journeys-data';
import { StepChoice } from './step-choice';
import { StepRow } from './step-row';

/**
 * For a step timed before the wedding: what happens for a couple who
 * book after its moment has passed (a questionnaire "8 weeks before"
 * for a couple booking 5 weeks out). It goes straight away by default,
 * or is skipped for them.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-late
 */

const LATE = { send: 'Send it straight away', skip: 'Skip it for them' } as const;

/** The row. */
export function StepLate({ step, onChange }: { step: JourneyStep; onChange: (step: JourneyStep) => void }) {
  return (
    <StepRow label="If they book later than that">
      <StepChoice label="If they book later than that" value={step.late ?? 'send'} options={['send', 'skip'] as const} labelOf={(k) => LATE[k]} onChange={(k) => onChange({ ...step, late: k })} />
    </StepRow>
  );
}
